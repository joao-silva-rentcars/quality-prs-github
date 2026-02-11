export interface GithubUserDto {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  profileUrl: string;
}

export interface GithubRepoDto {
  name: string;
  description: string | null;
  stars: number;
  url: string;
  language: string | null;
  updatedAt: string;
}

export interface GithubUserWithReposDto {
  user: GithubUserDto;
  repos: GithubRepoDto[];
}
