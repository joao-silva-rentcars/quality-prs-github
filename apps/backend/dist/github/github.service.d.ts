import { ConfigService } from '@nestjs/config';
import { GithubUserWithReposDto, PullRequestResponseDto } from './dto/github.dto';
interface PullRequestSearchFilters {
    org?: string;
    user?: string;
    repo?: string;
    state?: 'open' | 'closed' | 'merged';
    labels?: string[];
    environment?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
}
export declare class GithubService {
    private readonly configService;
    private octokitPromise;
    constructor(configService: ConfigService);
    getUserWithRepos(login: string): Promise<GithubUserWithReposDto>;
    private getOctokit;
    getPullRequests(query?: Record<string, unknown> | null, format?: boolean): Promise<PullRequestResponseDto>;
    getPullRequestsBySearch(filters: PullRequestSearchFilters, format?: boolean): Promise<PullRequestResponseDto>;
    private fetchSearchWithPagination;
    private searchByRepo;
    private mergeSearchResults;
    private mapUser;
    private mapRepo;
    private isNotFound;
    private buildPullRequestBody;
    private buildPullRequestBodyFromFilters;
    private executeGraphqlQuery;
    private buildSearchQuery;
    private buildDateRange;
    private escapeQueryValue;
    private escapeGraphqlQuery;
    private formatPullRequestResult;
    private formatSearchResult;
    private formatValidMessage;
    private formatSearchMessage;
    private normalizeRepoFilter;
    private isValidPullRequest;
    private isPullRequestEdge;
}
export {};
