import { GithubService } from './github.service';
import { GithubUserWithReposDto, PullRequestResponseDto } from './dto/github.dto';
export declare class GithubController {
    private readonly githubService;
    constructor(githubService: GithubService);
    getUser(login: string): Promise<GithubUserWithReposDto>;
    getPullRequests(format?: string): Promise<PullRequestResponseDto>;
}
