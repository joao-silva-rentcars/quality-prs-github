import { Controller, Get, Param, Query } from '@nestjs/common';
import { GithubService } from './github.service';
import {
  GithubUserWithReposDto,
  PullRequestResponseDto,
} from './dto/github.dto';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('user/:login')
  getUser(@Param('login') login: string): Promise<GithubUserWithReposDto> {
    return this.githubService.getUserWithRepos(login);
  }

  @Get('pull-requests')
  getPullRequests(
    @Query('format') format?: string,
  ): Promise<PullRequestResponseDto> {
    const shouldFormat = format !== 'false';
    return this.githubService.getPullRequests(null, shouldFormat);
  }
}
