# quality-prs-github

Projeto monorepo com backend NestJS e frontend React para consultar Pull Requests do GitHub e análise de qualidade.

## Visão geral

- **Backend NestJS**: consome a API GraphQL do GitHub para listar PRs qualificados e buscas avançadas com filtros.
- **Frontend React + Vite**: interface para visualizar PRs qualificados e filtrar por organização, repositório, status, ambiente, datas e labels.
- Token do GitHub via `GITHUB_TOKEN` (PAT) para maior limite de requisições.

## Estrutura

- `apps/backend` - API NestJS
- `apps/frontend` - Interface React + Vite

## Configuração

1. **Backend**:
   - Copie `apps/backend/.env.example` para `apps/backend/.env`
   - Configure `GITHUB_TOKEN` (opcional, mas recomendado para rate limit)

2. **Frontend**:
   - Copie `apps/frontend/.env.example` para `apps/frontend/.env`
   - Ajuste `VITE_API_BASE_URL` se o backend rodar em outra porta (padrão: `http://localhost:3000`)

## Como rodar

**Instalar dependências:**
```bash
npm install
```

**Rodar backend e frontend juntos:**
```bash
npm run dev
```

**Rodar separadamente:**
```bash
# Backend
npm run dev:backend

# Frontend
npm run dev:frontend
```

**URLs:**
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Sobe backend e frontend em paralelo |
| `npm run dev:backend` | Sobe apenas o backend |
| `npm run dev:frontend` | Sobe apenas o frontend |
| `npm run build` | Build de backend e frontend |
| `npm run lint` | Executa lint em ambos os projetos |

## Endpoints principais

- `GET /github/user/:login` - Perfil e repositórios do usuário
- `GET /github/pull-requests` - PRs qualificados (prontos para deploy)
- `GET /github/pull-requests/search` - Busca avançada com filtros (org, repo, state, environment, labels, datas)
