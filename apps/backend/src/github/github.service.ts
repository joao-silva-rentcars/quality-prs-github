import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import {
  GithubRepoDto,
  GithubUserDto,
  GithubUserWithReposDto,
} from './dto/github.dto';

@Injectable()
export class GithubService {
  private readonly octokit: Octokit;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    this.octokit = new Octokit(token ? { auth: token } : undefined);
  }

  async getUserWithRepos(login: string): Promise<GithubUserWithReposDto> {
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
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('Usuário do GitHub não encontrado.');
      }
      throw error;
    }
  }

  private mapUser(user: {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    public_repos: number;
    followers: number;
    following: number;
    html_url: string;
  }): GithubUserDto {
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

  private mapRepo(repo: {
    name: string;
    description: string | null;
    stargazers_count: number;
    html_url: string;
    language: string | null;
    updated_at: string;
  }): GithubRepoDto {
    return {
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      url: repo.html_url,
      language: repo.language,
      updatedAt: repo.updated_at,
    };
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: number }).status === 404
    );
  }
}
