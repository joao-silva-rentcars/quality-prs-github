import { Controller, Get, Param, Query } from '@nestjs/common';
import { GithubService } from './github.service';
import {
  GithubUserWithReposDto,
  PullRequestResponseDto,
} from './dto/github.dto';

interface PullRequestSearchQuery {
  org?: string;
  user?: string;
  repo?: string;
  squad?: string;
  state?: 'open' | 'closed' | 'merged';
  labels?: string;
  environment?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  format?: string;
}

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

  @Get('pull-requests/search')
  getPullRequestsBySearch(
    @Query() query: PullRequestSearchQuery,
  ): Promise<PullRequestResponseDto> {
    const shouldFormat = query.format !== 'false';
    const labels = query.labels?.trim()
      ? query.labels
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
      : undefined;

    return this.githubService.getPullRequestsBySearch(
      {
        org: query.org,
        user: query.user,
        repo: query.repo,
        squad: query.squad,
        state: query.state,
        labels,
        environment: query.environment,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        updatedFrom: query.updatedFrom,
        updatedTo: query.updatedTo,
      },
      shouldFormat,
    );
  }
}
