import { Controller, Get, Param } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubUserWithReposDto } from './dto/github.dto';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('user/:login')
  getUser(@Param('login') login: string): Promise<GithubUserWithReposDto> {
    return this.githubService.getUserWithRepos(login);
  }
}
