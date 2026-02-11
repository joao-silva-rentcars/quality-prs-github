import { GithubService } from './github.service';
import { GithubUserWithReposDto } from './dto/github.dto';
export declare class GithubController {
    private readonly githubService;
    constructor(githubService: GithubService);
    getUser(login: string): Promise<GithubUserWithReposDto>;
}
