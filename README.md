# quality-prs-github

Projeto monorepo com backend NestJS e frontend React para consumir a API do
GitHub.

## Visão geral

- Backend NestJS expõe `/github/user/:login` e consome o GitHub REST v3.
- Frontend React+Vite consulta o backend e exibe perfil + repositórios.
- Token do GitHub via `GITHUB_TOKEN` (PAT).

## Estrutura

- `apps/backend` - API NestJS
- `apps/frontend` - Frontend React+Vite

## Configuração

1. Backend:
   - Copie `apps/backend/.env.example` para `apps/backend/.env`
   - Configure `GITHUB_TOKEN` (opcional, mas recomendado para rate limit)
2. Frontend:
   - Copie `apps/frontend/.env.example` para `apps/frontend/.env`
   - Ajuste `VITE_API_BASE_URL` se necessário

## Como rodar

```bash
npm install
npm run dev
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Endpoint de exemplo

```bash
curl http://localhost:3000/github/user/octocat
```
