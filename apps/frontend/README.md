# Frontend - Quality PRs GitHub

Interface React + Vite para consulta de Pull Requests do GitHub.

## Pré-requisitos

- Node.js
- Backend rodando (por padrão em `http://localhost:3000`)

## Configuração

Crie o arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

Variáveis:
- `VITE_API_BASE_URL` - URL da API backend (padrão: `http://localhost:3000`)

## Como rodar

**Instalar dependências:**
```bash
npm install
```

**Modo desenvolvimento:**
```bash
npm run dev
```

O app ficará disponível em `http://localhost:5173`.

**Build para produção:**
```bash
npm run build
```

**Preview do build:**
```bash
npm run preview
```
