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
                repos: reposResponse.data.map(this.mapRepo),
            };
        }
        catch (error) {
            if (this.isNotFound(error)) {
                throw new common_1.NotFoundException('Usuário do GitHub não encontrado.');
            }
            throw error;
        }
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
    mapRepo(repo) {
        return {
            name: repo.name,
            description: repo.description,
            stars: repo.stargazers_count,
            url: repo.html_url,
            language: repo.language,
            updatedAt: repo.updated_at,
        };
    }
    isNotFound(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            error.status === 404);
    }
};
exports.GithubService = GithubService;
exports.GithubService = GithubService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GithubService);
//# sourceMappingURL=github.service.js.map