import { useState } from 'react'
import './App.css'

function App() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  const [login, setLogin] = useState('octocat')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchUser = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${apiBaseUrl}/github/user/${encodeURIComponent(login)}`
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.message ?? 'Erro ao buscar usuário.')
      }
      const payload = await response.json()
      setData(payload)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header>
        <p className="eyebrow">GitHub Explorer</p>
        <h1>Consultar perfil do GitHub</h1>
        <p className="subtitle">
          Backend NestJS consumindo a API do GitHub com token opcional.
        </p>
      </header>

      <section className="panel">
        <label htmlFor="login">Login do GitHub</label>
        <div className="input-row">
          <input
            id="login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="octocat"
          />
          <button type="button" onClick={fetchUser} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        <p className="hint">
          API: <span>{apiBaseUrl}</span>
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      {data && (
        <section className="results">
          <div className="profile">
            <img src={data.user.avatarUrl} alt={data.user.login} />
            <div>
              <h2>{data.user.name ?? data.user.login}</h2>
              <p className="muted">{data.user.bio ?? 'Sem bio.'}</p>
              <div className="stats">
                <span>{data.user.publicRepos} repos</span>
                <span>{data.user.followers} seguidores</span>
                <span>{data.user.following} seguindo</span>
              </div>
              <a href={data.user.profileUrl} target="_blank" rel="noreferrer">
                Ver perfil no GitHub
              </a>
            </div>
          </div>

          <div className="repos">
            <h3>Repositórios recentes</h3>
            {data.repos.length === 0 && (
              <p className="muted">Sem repositórios públicos.</p>
            )}
            <ul>
              {data.repos.map((repo) => (
                <li key={repo.url}>
                  <div>
                    <strong>{repo.name}</strong>
                    <span className="muted">
                      {repo.language ?? 'Sem linguagem'}
                    </span>
                  </div>
                  <p>{repo.description ?? 'Sem descrição.'}</p>
                  <div className="repo-meta">
                    <span>⭐ {repo.stars}</span>
                    <span>Atualizado: {new Date(repo.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <a href={repo.url} target="_blank" rel="noreferrer">
                    Abrir
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
