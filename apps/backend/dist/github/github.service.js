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
let GithubService = class GithubService {
    configService;
    octokit;
    constructor(configService) {
        this.configService = configService;
        const token = process.env.GITHUB_TOKEN;
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
        const configuredUrl = process.env.GITHUB_URL;
        const url = configuredUrl && configuredUrl.trim().length > 0
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
        }).then((res) => res.json()));
        const rawResult = result;
        return format ? this.formatPullRequestResult(result) : rawResult;
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