import { ConfigService } from '@nestjs/config';
import { GithubUserWithReposDto, PullRequestResponseDto } from './dto/github.dto';
export declare class GithubService {
    private readonly configService;
    private readonly octokit;
    constructor(configService: ConfigService);
    getUserWithRepos(login: string): Promise<GithubUserWithReposDto>;
    getPullRequests(query?: Record<string, unknown> | null, format?: boolean): Promise<PullRequestResponseDto>;
    private mapUser;
    private mapRepo;
    private isNotFound;
    private buildPullRequestBody;
    private formatPullRequestResult;
    private formatValidMessage;
    private isValidPullRequest;
    private isPullRequestEdge;
}
