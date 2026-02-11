"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rest_1 = require("@octokit/rest");
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
let GithubService = class GithubService {
    configService;
    octokit;
    constructor(configService) {
        this.configService = configService;
        const token = this.configService.get('GITHUB_TOKEN');
        this.octokit = new rest_1.Octokit(token ? { auth: token } : undefined);
    }
    async getUserWithRepos(login) {
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
        }
        catch (error) {
            if (this.isNotFound(error)) {
                throw new common_1.NotFoundException('Usuário do GitHub não encontrado.');
            }
            throw error;
        }
    }
    async getPullRequests(query = null, format = true) {
        const result = await this.executeGraphqlQuery(query ?? this.buildPullRequestBody());
        const rawResult = result;
        return format ? this.formatPullRequestResult(result) : rawResult;
    }
    async getPullRequestsBySearch(filters, format = true) {
        const query = this.buildPullRequestBodyFromFilters(filters);
        const result = await this.executeGraphqlQuery(query);
        const rawResult = result;
        return format ? this.formatSearchResult(result, filters) : rawResult;
    }
    mapUser(user) {
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
    mapRepo = (repo) => {
        return {
            name: repo.name,
            description: repo.description,
            stars: repo.stargazers_count ?? 0,
            url: repo.html_url,
            language: repo.language ?? null,
            updatedAt: repo.updated_at ?? '',
        };
    };
    isNotFound(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            error.status === 404);
    }
    buildPullRequestBody() {
        return {
            query: '{ search(query: "org:Rentcars is:pr is:open user:Rentcars label:tested", type: ISSUE, last: 50) ' +
                '{ edges { node { ... on PullRequest { number createdAt url title bodyText baseRepository { name } labels(first: 10) ' +
                '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
        };
    }
    buildPullRequestBodyFromFilters(filters) {
        const queryString = this.buildSearchQuery(filters);
        return {
            query: `{ search(query: "${queryString}", type: ISSUE, last: 50) ` +
                '{ edges { node { ... on PullRequest { number createdAt url title bodyText baseRepository { name } labels(first: 10) ' +
                '{ edges { node { name } } } files { totalCount } reviews { totalCount } mergeable mergeStateStatus } } } } }',
        };
    }
    async executeGraphqlQuery(query) {
        const configuredUrl = this.configService.get('GITHUB_URL');
        const url = configuredUrl && configuredUrl.trim().length > 0
            ? configuredUrl
            : 'https://api.github.com/graphql';
        const token = this.configService.get('GITHUB_TOKEN');
        return (await fetch(url, {
            body: JSON.stringify(query),
            method: 'POST',
            headers: {
                Authorization: token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
            },
        }).then((res) => res.json()));
    }
    buildSearchQuery(filters) {
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
            }
            else {
                parts.push(`repo:${orgValue}/${normalizedRepo}`);
            }
        }
        if (filters.state === 'open') {
            parts.push('is:open');
        }
        else if (filters.state === 'merged') {
            parts.push('is:merged');
        }
        else if (filters.state === 'closed') {
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
        const createdRange = this.buildDateRange('created', filters.createdFrom, filters.createdTo);
        if (createdRange) {
            parts.push(createdRange);
        }
        const updatedRange = this.buildDateRange('updated', filters.updatedFrom, filters.updatedTo);
        if (updatedRange) {
            parts.push(updatedRange);
        }
        return parts.join(' ');
    }
    buildDateRange(field, start, end) {
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
    escapeQueryValue(value) {
        return value.replace(/"/g, '\\"');
    }
    formatPullRequestResult(result) {
        const edges = result.data
            ?.search?.edges ?? [result.data?.repository?.pullRequest ?? null];
        const pullRequestsMap = new Map();
        for (const edge of edges) {
            if (!edge) {
                continue;
            }
            const info = this.isPullRequestEdge(edge)
                ? edge.node
                : edge;
            const message = this.formatValidMessage(info);
            if (!message) {
                continue;
            }
            const repository = info.baseRepository.name;
            if (pullRequestsMap.has(repository)) {
                pullRequestsMap.get(repository)?.push(message);
            }
            else {
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
    formatSearchResult(result, filters) {
        const edges = result.data
            ?.search?.edges ?? [result.data?.repository?.pullRequest ?? null];
        const pullRequestsMap = new Map();
        const allowedRepos = new Set(ALLOWED_REPOS.map((repo) => repo.toLowerCase()));
        const selectedRepo = this.normalizeRepoFilter(filters.repo);
        for (const edge of edges) {
            if (!edge) {
                continue;
            }
            const info = this.isPullRequestEdge(edge)
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
            if (pullRequestsMap.has(repository)) {
                pullRequestsMap.get(repository)?.push(message);
            }
            else {
                pullRequestsMap.set(repository, [message]);
            }
        }
        return Array.from(pullRequestsMap, ([repository, pullRequests]) => ({
            repository,
            pullRequests,
        }));
    }
    formatValidMessage(info) {
        if (!this.isValidPullRequest(info)) {
            return false;
        }
        if (!info.bodyText.includes('Task') ||
            !info.bodyText.includes('Description')) {
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
    formatSearchMessage(info) {
        let message = `*Title:* ${info.title}\n*PullRequest:* ${info.url}\n*Created*: ${info.createdAt}`;
        if (info.bodyText.includes('Task') &&
            info.bodyText.includes('Description')) {
            const [taskPart, descPart] = info.bodyText
                .split('Task')[1]
                .split('Description');
            message += `\n*Task*: ${taskPart}\n*Description:* ${descPart}`;
        }
        return {
            number: info.number,
            pullRequest: message,
            labels: info.labels.edges.map((edge) => edge.node.name),
        };
    }
    normalizeRepoFilter(repo) {
        if (!repo) {
            return null;
        }
        const repoValue = repo.includes('/') ? repo.split('/')[1] : repo;
        return repoValue.toLowerCase();
    }
    isValidPullRequest(info) {
        if (info.reviews.totalCount < 2 ||
            info.mergeable !== PULL_REQUEST_MERGEABLE ||
            info.mergeStateStatus === PULL_REQUEST_BLOCKED) {
            return false;
        }
        const hasTested = info.labels.edges.some((label) => label.node.name.toLowerCase() === TESTED_LABEL);
        const hasSpecialCase = info.labels.edges.some((label) => SPECIAL_CASE_LABELS.includes(label.node.name.toLowerCase()));
        return hasTested && !hasSpecialCase;
    }
    isPullRequestEdge(edge) {
        return 'node' in edge;
    }
};
exports.GithubService = GithubService;
exports.GithubService = GithubService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GithubService);
//# sourceMappingURL=github.service.js.map