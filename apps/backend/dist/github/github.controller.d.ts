import { GithubService } from './github.service';
import { GithubUserWithReposDto, PullRequestResponseDto } from './dto/github.dto';
interface PullRequestSearchQuery {
    org?: string;
    user?: string;
    repo?: string;
    state?: 'open' | 'closed' | 'merged';
    labels?: string;
    environment?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    format?: string;
}
export declare class GithubController {
    private readonly githubService;
    constructor(githubService: GithubService);
    getUser(login: string): Promise<GithubUserWithReposDto>;
    getPullRequests(format?: string): Promise<PullRequestResponseDto>;
    getPullRequestsBySearch(query: PullRequestSearchQuery): Promise<PullRequestResponseDto>;
}
export {};
