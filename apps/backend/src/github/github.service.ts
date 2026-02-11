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
const DEFAULT_ORG = 'Rentcars';
const ALLOWED_REPOS = [
  'rentcars',
  'site',
  'front-mobile',
  'rentcars-site',
  'qa-automation-web',
  'app-android',
  'components',
  'app-ios',
  'booking-api',
];

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
  baseRefName: string;
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
  baseBranch?: string;
}

interface SearchPullRequest {
  number: number;
  pullRequest: string;
  labels: string[];
  baseBranch: string;
}

interface PullRequestSearchFilters {
  org?: string;
  user?: string;
  repo?: string;
  state?: 'open' | 'closed' | 'merged';
  labels?: string[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

@Injectable()
export class GithubService {
  private readonly octokit: Octokit;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
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
    const result = await this.executeGraphqlQuery(
      query ?? this.buildPullRequestBody(),
    );
    const rawResult = result as Record<string, unknown>;

    return format ? this.formatPullRequestResult(result) : rawResult;
  }

  async getPullRequestsBySearch(
    filters: PullRequestSearchFilters,
    format = true,
  ): Promise<PullRequestResponseDto> {
    const query = this.buildPullRequestBodyFromFilters(filters);
    const result = await this.executeGraphqlQuery(query);
    const rawResult = result as Record<string, unknown>;

    return format ? this.formatSearchResult(result, filters) : rawResult;
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
        '{ edges { node { ... on PullRequest { number createdAt url title bodyText baseRefName baseRepository { name } labels(first: 10) ' +
        '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
    };
  }

  private buildPullRequestBodyFromFilters(filters: PullRequestSearchFilters): {
    query: string;
  } {
    const queryString = this.escapeGraphqlQuery(this.buildSearchQuery(filters));
    return {
      query:
        `{ search(query: "${queryString}", type: ISSUE, last: 50) ` +
        '{ edges { node { ... on PullRequest { number createdAt url title bodyText baseRefName baseRepository { name } labels(first: 10) ' +
        '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
    };
  }

  private async executeGraphqlQuery(
    query: Record<string, unknown>,
  ): Promise<GraphqlSearchResponse> {
    const configuredUrl = this.configService.get<string>('GITHUB_URL');
    const url =
      configuredUrl && configuredUrl.trim().length > 0
        ? configuredUrl
        : 'https://api.github.com/graphql';
    const token = this.configService.get<string>('GITHUB_TOKEN');

    return (await fetch(url, {
      body: JSON.stringify(query),
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json())) as GraphqlSearchResponse;
  }

  private buildSearchQuery(filters: PullRequestSearchFilters): string {
    const parts = ['is:pr'];
    const orgValue = filters.org ?? DEFAULT_ORG;

    if (orgValue) {
      parts.push(`org:${orgValue}`);
    }

    if (filters.repo) {
      const repoValue = filters.repo.includes('/')
        ? filters.repo.split('/')[1]
        : filters.repo;
      const normalizedRepo = repoValue.toLowerCase();

      if (!ALLOWED_REPOS.includes(normalizedRepo)) {
        parts.push(`repo:${orgValue}/__invalid__`);
      } else {
        parts.push(`repo:${orgValue}/${normalizedRepo}`);
      }
    }

    if (filters.state === 'open') {
      parts.push('is:open');
    } else if (filters.state === 'merged') {
      parts.push('is:merged');
    } else if (filters.state === 'closed') {
      parts.push('is:closed');
    }

    if (filters.labels && filters.labels.length > 0) {
      for (const label of filters.labels) {
        if (label) {
          const safeLabel = this.escapeQueryValue(label);
          parts.push(`label:"${safeLabel}"`);
        }
      }
    }

    const createdRange = this.buildDateRange(
      'created',
      filters.createdFrom,
      filters.createdTo,
    );
    if (createdRange) {
      parts.push(createdRange);
    }

    const updatedRange = this.buildDateRange(
      'updated',
      filters.updatedFrom,
      filters.updatedTo,
    );
    if (updatedRange) {
      parts.push(updatedRange);
    }

    return parts.join(' ');
  }

  private buildDateRange(
    field: 'created' | 'updated',
    start?: string,
    end?: string,
  ): string | null {
    if (start && end) {
      return `${field}:${start}..${end}`;
    }
    if (start) {
      return `${field}:>=${start}`;
    }
    if (end) {
      return `${field}:<=${end}`;
    }
    return null;
  }

  private escapeQueryValue(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  private escapeGraphqlQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

    if (pullRequestsMap.size === 0) {
      return [];
    }

    return Array.from(pullRequestsMap, ([repository, pullRequests]) => ({
      repository,
      pullRequests,
    }));
  }

  private formatSearchResult(
    result: GraphqlSearchResponse,
    filters: PullRequestSearchFilters,
  ): PullRequestGroupDto[] {
    const edges: Array<PullRequestEdge | PullRequestNode | null> = result.data
      ?.search?.edges ?? [result.data?.repository?.pullRequest ?? null];
    const pullRequestsMap = new Map<string, SearchPullRequest[]>();
    const allowedRepos = new Set(
      ALLOWED_REPOS.map((repo) => repo.toLowerCase()),
    );
    const selectedRepo = this.normalizeRepoFilter(filters.repo);
    const selectedLabels = (filters.labels ?? []).map((label) =>
      label.toLowerCase(),
    );

    for (const edge of edges) {
      if (!edge) {
        continue;
      }

      const info: PullRequestNode = this.isPullRequestEdge(edge)
        ? edge.node
        : edge;
      const message = this.formatSearchMessage(info);
      const repository = info.baseRepository.name;
      const repositoryKey = repository.toLowerCase();

      if (selectedRepo && repositoryKey !== selectedRepo) {
        continue;
      }

      if (!selectedRepo && !allowedRepos.has(repositoryKey)) {
        continue;
      }

      if (selectedLabels.length > 0) {
        const prLabels = info.labels.edges.map((label) =>
          label.node.name.toLowerCase(),
        );
        const hasLabel = selectedLabels.some((label) =>
          prLabels.includes(label),
        );
        if (!hasLabel) {
          continue;
        }
      }

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
      baseBranch: info.baseRefName,
    };
  }

  private formatSearchMessage(info: PullRequestNode): SearchPullRequest {
    let message = `*Title:* ${info.title}\n*PullRequest:* ${info.url}\n*Created*: ${info.createdAt}`;

    if (
      info.bodyText.includes('Task') &&
      info.bodyText.includes('Description')
    ) {
      const [taskPart, descPart] = info.bodyText
        .split('Task')[1]
        .split('Description');
      message += `\n*Task*: ${taskPart}\n*Description:* ${descPart}`;
    }

    return {
      number: info.number,
      pullRequest: message,
      labels: info.labels.edges.map((edge) => edge.node.name),
      baseBranch: info.baseRefName,
    };
  }

  private normalizeRepoFilter(repo?: string): string | null {
    if (!repo) {
      return null;
    }

    const repoValue = repo.includes('/') ? repo.split('/')[1] : repo;
    return repoValue.toLowerCase();
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
