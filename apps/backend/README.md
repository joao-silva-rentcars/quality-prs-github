# Backend - Quality PRs GitHub

API NestJS que consome a API GraphQL do GitHub para consulta de Pull Requests.

## Pré-requisitos

- Node.js
- Token do GitHub (PAT) para `GITHUB_TOKEN` (opcional, recomendado para rate limit)

## Configuração

Crie o arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

Variáveis:
- `GITHUB_TOKEN` - Personal Access Token do GitHub (recomendado)
- `PORT` - Porta do servidor (padrão: 3000)

## Como rodar

**Instalar dependências:**
```bash
npm install
```

**Modo desenvolvimento:**
```bash
npm run start:dev
```

**Modo produção:**
```bash
npm run build
npm run start:prod
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/github/user/:login` | Perfil e repositórios do usuário |
| GET | `/github/pull-requests` | PRs qualificados para deploy |
| GET | `/github/pull-requests/search` | Busca avançada com filtros |

**Parâmetros da busca avançada:** `org`, `repo`, `state`, `environment`, `labels`, `createdFrom`, `createdTo`.
