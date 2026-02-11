import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import {
  GithubRepoDto,
  GithubUserDto,
  GithubUserWithReposDto,
  PullRequestGroupDto,
  PullRequestResponseDto,
} from './dto/github.dto';

const PULL_REQUEST_MERGEABLE = 'MERGEABLE';
const PULL_REQUEST_BLOCKED = 'BLOCKED';
const TESTED_LABEL = 'tested';
const SPECIAL_CASE_LABELS = ['special case'];

interface GraphqlSearchResponse {
  data?: {
    search?: {
      edges?: Array<PullRequestEdge | PullRequestNode | null>;
    };
    repository?: {
      pullRequest?: PullRequestNode;
    };
  };
}

interface PullRequestLabelEdge {
  node: {
    name: string;
  };
}

interface PullRequestNode {
  number: number;
  createdAt: string;
  url: string;
  title: string;
  bodyText: string;
  baseRepository: {
    name: string;
  };
  labels: {
    edges: PullRequestLabelEdge[];
  };
  files: {
    totalCount: number;
  };
  reviews: {
    totalCount: number;
  };
  mergeable: string;
  mergeStateStatus: string;
}

interface PullRequestEdge {
  node: PullRequestNode;
}

interface RepoApiResult {
  name: string;
  description: string | null;
  stargazers_count?: number;
  html_url: string;
  language?: string | null;
  updated_at?: string | null;
}

interface FormattedPullRequest {
  number: number;
  pullRequest: string;
}

@Injectable()
export class GithubService {
  private readonly octokit: Octokit;

  constructor(private readonly configService: ConfigService) {
    const token = process.env.GITHUB_TOKEN;
    this.octokit = new Octokit(token ? { auth: token } : undefined);
  }

  async getUserWithRepos(login: string): Promise<GithubUserWithReposDto> {
    try {
      const [userResponse, reposResponse] = await Promise.all([
        this.octokit.rest.users.getByUsername({ username: login }),
        this.octokit.rest.repos.listForUser({
          username: login,
          per_page: 50,
          sort: 'updated',
        }),
      ]);

      return {
        user: this.mapUser(userResponse.data),
        repos: reposResponse.data.map((repo) => this.mapRepo(repo)),
      };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('Usuário do GitHub não encontrado.');
      }
      throw error;
    }
  }

  async getPullRequests(
    query: Record<string, unknown> | null = null,
    format = true,
  ): Promise<PullRequestResponseDto> {
    const configuredUrl = process.env.GITHUB_URL;
    const url =
      configuredUrl && configuredUrl.trim().length > 0
        ? configuredUrl
        : 'https://api.github.com/graphql';
    const token = process.env.GITHUB_TOKEN;

    const result = (await fetch(url, {
      body: JSON.stringify(query ?? this.buildPullRequestBody()),
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json())) as GraphqlSearchResponse;

    const rawResult = result as Record<string, unknown>;

    return format ? this.formatPullRequestResult(result) : rawResult;
  }

  private mapUser(user: {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    public_repos: number;
    followers: number;
    following: number;
    html_url: string;
  }): GithubUserDto {
    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      profileUrl: user.html_url,
    };
  }

  private mapRepo = (repo: RepoApiResult): GithubRepoDto => {
    return {
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count ?? 0,
      url: repo.html_url,
      language: repo.language ?? null,
      updatedAt: repo.updated_at ?? '',
    };
  };

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: number }).status === 404
    );
  }

  private buildPullRequestBody(): { query: string } {
    return {
      query:
        '{ search(query: "org:Rentcars is:pr is:open user:Rentcars label:tested", type: ISSUE, last: 50) ' +
        '{ edges { node { ... on PullRequest { number createdAt url title bodyText baseRepository { name } labels(first: 10) ' +
        '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
    };
  }

  private formatPullRequestResult(
    result: GraphqlSearchResponse,
  ): PullRequestGroupDto[] {
    const edges: Array<PullRequestEdge | PullRequestNode | null> = result.data
      ?.search?.edges ?? [result.data?.repository?.pullRequest ?? null];
    const pullRequestsMap = new Map<string, FormattedPullRequest[]>();

    for (const edge of edges) {
      if (!edge) {
        continue;
      }

      const info: PullRequestNode = this.isPullRequestEdge(edge)
        ? edge.node
        : edge;
      const message: FormattedPullRequest | false =
        this.formatValidMessage(info);

      if (!message) {
        continue;
      }

      const repository = info.baseRepository.name;
      if (pullRequestsMap.has(repository)) {
        pullRequestsMap.get(repository)?.push(message);
      } else {
        pullRequestsMap.set(repository, [message]);
      }
    }

    return Array.from(pullRequestsMap, ([repository, pullRequests]) => ({
      repository,
      pullRequests,
    }));
  }

  private formatValidMessage(
    info: PullRequestNode,
  ): FormattedPullRequest | false {
    if (!this.isValidPullRequest(info)) {
      return false;
    }

    if (
      !info.bodyText.includes('Task') ||
      !info.bodyText.includes('Description')
    ) {
      return false;
    }

    const [taskPart, descPart] = info.bodyText
      .split('Task')[1]
      .split('Description');
    return {
      number: info.number,
      pullRequest: `*Title:* ${info.title}\n*PullRequest:* ${info.url}\n*Created*: ${info.createdAt}\n*Task*: ${taskPart}\n*Description:* ${descPart}`,
    };
  }

  private isValidPullRequest(info: PullRequestNode): boolean {
    if (
      info.reviews.totalCount < 2 ||
      info.mergeable !== PULL_REQUEST_MERGEABLE ||
      info.mergeStateStatus === PULL_REQUEST_BLOCKED
    ) {
      return false;
    }

    const hasTested = info.labels.edges.some(
      (label: { node: { name: string } }) =>
        label.node.name.toLowerCase() === TESTED_LABEL,
    );
    const hasSpecialCase = info.labels.edges.some(
      (label: { node: { name: string } }) =>
        SPECIAL_CASE_LABELS.includes(label.node.name.toLowerCase()),
    );

    return hasTested && !hasSpecialCase;
  }

  private isPullRequestEdge(
    edge: PullRequestEdge | PullRequestNode,
  ): edge is PullRequestEdge {
    return 'node' in edge;
  }
}
