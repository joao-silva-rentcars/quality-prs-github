import { ConfigService } from '@nestjs/config';
import { GithubUserWithReposDto } from './dto/github.dto';
export declare class GithubService {
    private readonly configService;
    private readonly octokit;
    constructor(configService: ConfigService);
    getUserWithRepos(login: string): Promise<GithubUserWithReposDto>;
    private mapUser;
    private mapRepo;
    private isNotFound;
}
