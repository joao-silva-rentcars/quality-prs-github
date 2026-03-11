import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  'admin-produto',
  'app-android',
  'app-ios',
  'back-commercial',
  'bidw',
  'booking-api',
  'components',
  'design-system',
  'facade-mobile',
  'fortune-back',
  'fortune-front',
  'front-commercial',
  'front-mobile',
  'integrator-node',
  'loyalty',
  'marketplace',
  'operation-front',
  'partner-integrator',
  'partners',
  'qa-automation-web',
  'rentcars',
  'rentcars-site',
  'responsive-entrypages',
  'responsive-entrypages-backend',
  'site',
  'vehicle-search',
];

/** Repositórios por Squad (conforme planilha) */
const SQUAD_REPOS: Record<string, string[]> = {
  Backoffice: [
    'marketplace',
    'rentcars',
    'operation-front',
    'admin-produto',
    'bidw',
    'loyalty',
  ],
  Partners: [
    'back-commercial',
    'front-commercial',
    'booking-api',
    'partners',
    'vehicle-search',
    'fortune-front',
    'rentcars',
    'integrator-node',
    'partner-integrator',
    'site',
    'front-mobile',
    'components',
  ],
  Pay: [
    'site',
    'front-mobile',
    'rentcars',
    'components',
    'facade-mobile',
    'fortune-back',
    'fortune-front',
    'operation-front',
  ],
  Catalog: [
    'rentcars',
    'site',
    'components',
    'front-mobile',
    'design-system',
    'responsive-entrypages',
    'responsive-entrypages-backend',
    'rentcars-site',
  ],
  APPs: ['app-android', 'app-ios'],
};

/** Label do GitHub correspondente a cada Squad */
const SQUAD_LABELS: Record<string, string> = {
  Backoffice: 'Squad BackOffice',
  Partners: 'Squad Partners',
  Pay: 'Squad Pay',
  Catalog: 'Squad Catalog',
  APPs: 'Squad Apps',
};

interface SearchPageInfo {
  endCursor?: string | null;
  hasNextPage?: boolean;
}

interface GraphqlSearchResponse {
  data?: {
    search?: {
      edges?: Array<PullRequestEdge | PullRequestNode | null>;
      pageInfo?: SearchPageInfo;
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
  mergedAt?: string | null;
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
  mergedAt?: string | null;
}

interface SearchPullRequest {
  number: number;
  pullRequest: string;
  labels: string[];
  baseBranch: string;
  mergedAt?: string | null;
}

const ENVIRONMENT_BRANCHES: Record<string, string[]> = {
  Production: ['main', 'master', 'Production', 'Master'],
  Stage: ['staging', 'stage'],
  Integration: ['integration', 'develop', 'dev'],
};

/** Base branch usada na query do GitHub (uma por ambiente, a API não aceita OR) */
const ENVIRONMENT_QUERY_BRANCH: Record<string, string> = {
  Production: 'master',
  Stage: 'staging',
  Integration: 'integration',
};

interface PullRequestSearchFilters {
  org?: string;
  user?: string;
  repo?: string;
  squad?: string;
  state?: 'open' | 'closed' | 'merged';
  labels?: string[];
  environment?: string;
  /** Sobrescreve o branch da query (ex: busca Production com main e master) */
  environmentBaseBranch?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

@Injectable()
export class GithubService {
  private octokitPromise: Promise<import('@octokit/rest').Octokit> | null =
    null;

  constructor(private readonly configService: ConfigService) {}

  async getUserWithRepos(login: string): Promise<GithubUserWithReposDto> {
    try {
      const octokit = await this.getOctokit();
      const [userResponse, reposResponse] = await Promise.all([
        octokit.rest.users.getByUsername({ username: login }),
        octokit.rest.repos.listForUser({
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

  private async getOctokit(): Promise<import('@octokit/rest').Octokit> {
    if (!this.octokitPromise) {
      const token = this.configService.get<string>('GITHUB_TOKEN');
      this.octokitPromise = import('@octokit/rest').then(
        ({ Octokit }) => new Octokit(token ? { auth: token } : undefined),
      );
    }

    return this.octokitPromise;
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
    const squadSelected = !!filters.squad?.trim();
    const repoSelected = !!filters.repo?.trim();
    const noLabelsSelected = !filters.labels || filters.labels.length === 0;

    const squadRepos = squadSelected
      ? (SQUAD_REPOS[filters.squad!] ?? []).filter((r) =>
          ALLOWED_REPOS.includes(r),
        )
      : null;

    if (squadSelected && squadRepos && squadRepos.length > 0) {
      const squadLabel = SQUAD_LABELS[filters.squad!];
      const filtersWithSquadLabel = squadLabel
        ? { ...filters, labels: [...(filters.labels ?? []), squadLabel] }
        : filters;
      const results = await Promise.all(
        squadRepos.map((repo) =>
          this.searchByRepo({ ...filtersWithSquadLabel, repo }),
        ),
      );
      const merged = this.mergeSearchResults(results);
      const rawResult = merged as Record<string, unknown>;
      return format ? this.formatSearchResult(merged, filters) : rawResult;
    }

    if (repoSelected || !noLabelsSelected) {
      const result = await this.fetchSearchWithPagination(filters);
      const rawResult = result as Record<string, unknown>;
      return format ? this.formatSearchResult(result, filters) : rawResult;
    }

    const results = await Promise.all(
      ALLOWED_REPOS.map((repo) => this.searchByRepo({ ...filters, repo })),
    );
    const merged = this.mergeSearchResults(results);
    const rawResult = merged as Record<string, unknown>;
    return format ? this.formatSearchResult(merged, filters) : rawResult;
  }

  private async fetchSearchWithPagination(
    filters: PullRequestSearchFilters,
  ): Promise<GraphqlSearchResponse> {
    const isProduction = filters.environment === 'Production';
    const branchesToQuery: (string | null)[] = isProduction
      ? ['main', 'master']
      : [null];

    const allEdges: Array<PullRequestEdge | PullRequestNode | null> = [];
    const seenPrKeys = new Set<string>();

    for (const branch of branchesToQuery) {
      const branchFilters = branch
        ? { ...filters, environmentBaseBranch: branch }
        : filters;
      let after: string | null = null;

      for (let page = 0; page < 5; page++) {
        const query = this.buildPullRequestBodyFromFilters(
          branchFilters,
          after,
        );
        const result = await this.executeGraphqlQuery(query);
        const edges = result.data?.search?.edges ?? [];

        for (const edge of edges) {
          if (!edge) continue;
          const info = this.isPullRequestEdge(edge) ? edge.node : edge;
          const key = `${info.baseRepository?.name}-${info.number}`;
          if (!seenPrKeys.has(key)) {
            seenPrKeys.add(key);
            allEdges.push(edge);
          }
        }

        const hasNextPage = result.data?.search?.pageInfo?.hasNextPage;
        const endCursor = result.data?.search?.pageInfo?.endCursor;

        if (!hasNextPage || !endCursor || edges.length < 100) {
          break;
        }
        after = endCursor;
      }
    }

    return { data: { search: { edges: allEdges } } };
  }

  private async searchByRepo(
    filters: PullRequestSearchFilters,
  ): Promise<GraphqlSearchResponse> {
    return this.fetchSearchWithPagination(filters);
  }

  private mergeSearchResults(
    responses: GraphqlSearchResponse[],
  ): GraphqlSearchResponse {
    const allEdges: Array<PullRequestEdge | PullRequestNode | null> = [];
    for (const res of responses) {
      const edges = res.data?.search?.edges ?? [];
      allEdges.push(...edges);
    }
    return {
      data: {
        search: { edges: allEdges },
      },
    };
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
        '{ edges { node { ... on PullRequest { number createdAt mergedAt url title bodyText baseRefName baseRepository { name } labels(first: 10) ' +
        '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
    };
  }

  private buildPullRequestBodyFromFilters(
    filters: PullRequestSearchFilters,
    after?: string | null,
  ): { query: string } {
    const queryString = this.escapeGraphqlQuery(this.buildSearchQuery(filters));
    const afterArg = after
      ? `, after: "${this.escapeGraphqlQuery(after)}"`
      : '';
    return {
      query:
        `{ search(query: "${queryString}", type: ISSUE, first: 100${afterArg}) ` +
        '{ edges { node { ... on PullRequest { number createdAt mergedAt url title bodyText baseRefName baseRepository { name } labels(first: 10) ' +
        '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } pageInfo { endCursor hasNextPage } } }',
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

    if (filters.environment) {
      const queryBranch =
        filters.environmentBaseBranch ??
        ENVIRONMENT_QUERY_BRANCH[filters.environment];
      if (queryBranch) {
        parts.push(`base:${queryBranch}`);
      }
    }

    if (filters.labels && filters.labels.length > 0) {
      for (const label of filters.labels) {
        if (label) {
          const safeLabel = this.escapeQueryValue(label);
          parts.push(`label:"${safeLabel}"`);
        }
      }
    }

    const dateField =
      filters.state === 'merged'
        ? 'merged'
        : filters.state === 'closed'
          ? 'closed'
          : 'created';
    const dateRange = this.buildDateRange(
      dateField,
      filters.createdFrom,
      filters.createdTo,
    );
    if (dateRange) {
      parts.push(dateRange);
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
    field: 'created' | 'updated' | 'merged' | 'closed',
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
      const rawRepoName = info.baseRepository?.name ?? '';
      const repository = rawRepoName.includes('/')
        ? (rawRepoName.split('/').pop() ?? rawRepoName)
        : rawRepoName;
      const repositoryKey = (repository || '').toLowerCase().trim();

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

      if (filters.environment) {
        const allowedBranches = ENVIRONMENT_BRANCHES[filters.environment];
        if (allowedBranches) {
          const baseBranch = info.baseRefName?.toLowerCase() ?? '';
          const matchesEnvironment = allowedBranches.some(
            (branch) => branch.toLowerCase() === baseBranch,
          );
          if (!matchesEnvironment) {
            continue;
          }
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
      mergedAt: info.mergedAt ?? null,
    };
  }

  private formatSearchMessage(info: PullRequestNode): SearchPullRequest {
    let message = `*Title:* ${info.title}\n*PullRequest:* ${info.url}\n*Created*: ${info.createdAt}`;
    if (info.mergedAt) {
      message += `\n*Merged*: ${info.mergedAt}`;
    }

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
      mergedAt: info.mergedAt ?? null,
    };
  }

  private normalizeRepoFilter(repo?: string): string | null {
    if (!repo || typeof repo !== 'string') {
      return null;
    }

    const repoValue = repo.includes('/') ? repo.split('/').pop() : repo;
    const normalized = (repoValue || '').trim().toLowerCase();
    return normalized || null;
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
