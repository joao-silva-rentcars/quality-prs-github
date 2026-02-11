import { useState } from 'react'
import './App.css'

function App() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  const [login, setLogin] = useState('octocat')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pullRequests, setPullRequests] = useState([])
  const [pullError, setPullError] = useState('')
  const [pullLoading, setPullLoading] = useState(false)

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

  const parsePullRequestMessage = (text) => {
    const urlMatch = text.match(/https?:\/\/\S+/)
    const url = urlMatch ? urlMatch[0] : ''
    const titleMatch = text.match(/\*Title:\*\s(.+)\n\*PullRequest:\*/s)
    const createdMatch = text.match(/\*Created\*:\s(.+)\n\*Task\*:/s)
    const taskMatch = text.match(/\*Task\*:\s([\s\S]*?)\n\*Description:\*/s)
    const descriptionMatch = text.match(/\*Description:\*\s([\s\S]*)/s)

    return {
      title: titleMatch ? titleMatch[1].trim() : 'Pull request',
      url,
      createdAt: createdMatch ? createdMatch[1].trim() : '',
      task: taskMatch ? taskMatch[1].trim() : '',
      description: descriptionMatch ? descriptionMatch[1].trim() : '',
    }
  }

  const fetchPullRequests = async () => {
    setPullLoading(true)
    setPullError('')
    try {
      const response = await fetch(`${apiBaseUrl}/github/pull-requests`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.message ?? 'Erro ao buscar pull requests.')
      }
      const payload = await response.json()
      setPullRequests(payload)
    } catch (err) {
      setPullRequests([])
      setPullError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setPullLoading(false)
    }
  }

  return (
    <div className="app">
      <header>
        <p className="eyebrow">GitHub Explorer</p>
        <h1>Consulta de Pull Requests do GitHub</h1>
        <p className="subtitle">
          Backend NestJS consumindo a API do GitHub com token opcional.
        </p>
      </header>

      <section className="panel pr-panel">
        <div className="panel-header">
          <div>
            <h2>Pull requests qualificados</h2>
            <p className="muted">
              Mostra PRs que passam nos critérios de qualidade do backend.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPullRequests}
            disabled={pullLoading}
          >
            {pullLoading ? 'Carregando...' : 'Carregar PRs'}
          </button>
        </div>
        {pullError && <p className="error">{pullError}</p>}
        {!pullLoading && pullRequests.length === 0 && !pullError && (
          <p className="muted">Sem PRs para exibir.</p>
        )}
      </section>

      {pullRequests.length > 0 && (
        <section className="pr-section">
          <div className="pr-grid">
            {pullRequests.map((group) => (
              <article className="repo-card" key={group.repository}>
                <div className="repo-card-header">
                  <h3>{group.repository}</h3>
                  <span className="badge">
                    {group.pullRequests.length} PRs
                  </span>
                </div>
                <ul>
                  {group.pullRequests.map((item) => {
                    const parsed = parsePullRequestMessage(item.pullRequest)
                    return (
                      <li key={`${group.repository}-${item.number}`}>
                        <div className="pr-item">
                          <div>
                            <h4>{parsed.title}</h4>
                            {parsed.createdAt && (
                              <p className="muted">
                                Criado em {parsed.createdAt}
                              </p>
                            )}
                            {parsed.task && (
                              <p>
                                <strong>Task:</strong> {parsed.task}
                              </p>
                            )}
                            {parsed.description && (
                              <p className="muted">
                                {parsed.description}
                              </p>
                            )}
                          </div>
                          <div className="pr-actions">
                            <span className="pr-number">#{item.number}</span>
                            <a
                              href={parsed.url}
                              target="_blank"
                              rel="noreferrer"
                              className="button-link"
                            >
                              Abrir PR
                            </a>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

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
