import { useState } from 'react'
import './App.css'

function App() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  const [pullRequests, setPullRequests] = useState([])
  const [pullError, setPullError] = useState('')
  const [pullLoading, setPullLoading] = useState(false)
  const [pullLoaded, setPullLoaded] = useState(false)
  const [screen, setScreen] = useState('qualified')
  const [org, setOrg] = useState('Rentcars')
  const [repo, setRepo] = useState('')
  const [state, setState] = useState('closed')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [environment, setEnvironment] = useState('')
  const [selectedLabels, setSelectedLabels] = useState([])

  const labelOptions = ['bug', 'bugfix', 'tested', 'special case']
  const repoOptions = [
    { value: '', label: 'Todos os repositórios' },
    { value: 'rentcars', label: 'rentcars' },
    { value: 'site', label: 'site' },
    { value: 'front-mobile', label: 'front-mobile' },
    { value: 'rentcars-site', label: 'rentcars-site' },
    { value: 'qa-automation-web', label: 'qa-automation-web' },
    { value: 'app-android', label: 'app-android' },
    { value: 'components', label: 'components' },
    { value: 'app-ios', label: 'app-ios' },
    { value: 'booking-api', label: 'booking-api' },
    { value: 'responsive-entrypages', label: 'responsive-entrypages' },
  ]

  const parsePullRequestMessage = (text) => {
    const urlMatch = text.match(/https?:\/\/\S+/)
    const url = urlMatch ? urlMatch[0] : ''
    const titleMatch = text.match(/\*Title:\*\s(.+)\n\*PullRequest:\*/s)
    const createdMatch = text.match(/\*Created\*:\s(.+?)(?:\n|$)/s)
    const mergedMatch = text.match(/\*Merged\*:\s(.+?)(?:\n|$)/s)
    const taskMatch = text.match(/\*Task\*:\s([\s\S]*?)\n\*Description:\*/s)
    const descriptionMatch = text.match(/\*Description:\*\s([\s\S]*)/s)

    return {
      title: titleMatch ? titleMatch[1].trim() : 'Pull request',
      url,
      createdAt: createdMatch ? createdMatch[1].trim() : '',
      mergedAt: mergedMatch ? mergedMatch[1].trim() : '',
      task: taskMatch ? taskMatch[1].trim() : '',
      description: descriptionMatch ? descriptionMatch[1].trim() : '',
    }
  }

  const normalizeLabels = (labels) =>
    Array.isArray(labels) ? labels.filter(Boolean) : []

  const formatDate = (iso) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  const toggleLabel = (label) => {
    setSelectedLabels((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    )
  }

  const buildSearchParams = () => {
    const params = new URLSearchParams()
    if (org) params.set('org', org)
    if (repo) params.set('repo', repo)
    if (state) params.set('state', state)
    if (selectedLabels.length > 0) {
      params.set('labels', selectedLabels.join(','))
    }
    if (createdFrom) params.set('createdFrom', createdFrom)
    if (createdTo) params.set('createdTo', createdTo)
    if (environment) params.set('environment', environment)
    return params.toString()
  }

  const fetchPullRequests = async (mode) => {
    setPullLoading(true)
    setPullError('')
    try {
      const endpoint =
        mode === 'search'
          ? `${apiBaseUrl}/github/pull-requests/search?${buildSearchParams()}`
          : `${apiBaseUrl}/github/pull-requests`
      const response = await fetch(endpoint)
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
      setPullLoaded(true)
    }
  }

  return (
    <div className="app">
      <header>
        <p className="eyebrow">GitHub Explorer</p>
        <h1>Consulta de Pull Requests do GitHub</h1>
        <p className="subtitle">
          Backend NestJS consumindo a API do GitHub com token.
        </p>
        <div className="screen-toggle">
          <button
            type="button"
            className={screen === 'qualified' ? 'active' : ''}
            onClick={() => {
              setScreen('qualified')
              setPullRequests([])
              setPullLoaded(false)
              setPullError('')
            }}
          >
            PRs qualificados
          </button>
          <button
            type="button"
            className={screen === 'search' ? 'active' : ''}
            onClick={() => {
              setScreen('search')
              setPullRequests([])
              setPullLoaded(false)
              setPullError('')
            }}
          >
            Busca avançada
          </button>
        </div>
      </header>

      {screen === 'qualified' ? (
        <section className="panel pr-panel">
          <div className="panel-header">
            <div>
              <h2>Pull requests qualificados</h2>
              <p className="muted">
                Mostra PRs que passam nos critérios para realização do deploy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchPullRequests('qualified')}
              disabled={pullLoading}
            >
              {pullLoading ? 'Carregando...' : 'Carregar PRs'}
            </button>
          </div>
          {pullError && <p className="error">{pullError}</p>}
          {!pullLoading &&
            pullLoaded &&
            pullRequests.length === 0 &&
            !pullError && (
              <p className="muted">Não há PRs disponíveis no momento.</p>
            )}
        </section>
      ) : (
        <section className="panel pr-panel">
          <div className="panel-header">
            <div>
              <h2>Filtros</h2>
              <p className="muted">
                Todas as opções são selecionáveis. Sem digitação manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchPullRequests('search')}
              disabled={pullLoading}
            >
              {pullLoading ? 'Carregando...' : 'Buscar PRs'}
            </button>
          </div>
          <div className="filter-grid">
            <div className="field">
              <label>Organização</label>
              <select
                value={org}
                onChange={(event) => setOrg(event.target.value)}
              >
                <option value="Rentcars">Rentcars</option>
              </select>
            </div>
            <div className="field">
              <label>Repositório</label>
              <select
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
              >
                {repoOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="merged">Merged</option>
              </select>
            </div>
            <div className="field">
              <label>Ambiente</label>
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="Production">Production</option>
                <option value="Stage">Stage</option>
                <option value="Integration">Integration</option>
              </select>
            </div>
            <div className="field">
              <label>
                {state === 'merged'
                  ? 'Data de merge (de)'
                  : state === 'closed'
                    ? 'Data de fechamento (de)'
                    : 'Data de criação (de)'}
              </label>
              <input
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
              />
            </div>
            <div className="field">
              <label>
                {state === 'merged'
                  ? 'Data de merge (até)'
                  : state === 'closed'
                    ? 'Data de fechamento (até)'
                    : 'Data de criação (até)'}
              </label>
              <input
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
              />
            </div>
          </div>
          <div className="labels-group">
            <p className="muted">Labels</p>
            <div className="labels-options">
              {labelOptions.map((label) => (
                <label key={label} className="label-pill">
                  <input
                    type="checkbox"
                    checked={selectedLabels.includes(label)}
                    onChange={() => toggleLabel(label)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {pullError && <p className="error">{pullError}</p>}
          {!pullLoading &&
            pullLoaded &&
            pullRequests.length === 0 &&
            !pullError && (
              <p className="muted">Não há PRs disponíveis no momento.</p>
            )}
        </section>
      )}

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
                    const labels = normalizeLabels(item.labels)
                    const baseBranch = item.baseBranch
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
                            {(item.mergedAt || parsed.mergedAt) && (
                              <p className="muted">
                                Mergeado em{' '}
                                {formatDate(item.mergedAt || parsed.mergedAt)}
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
                            {baseBranch && (
                              <p className="muted">
                                Base: <strong>{baseBranch}</strong>
                              </p>
                            )}
                            {labels.length > 0 && (
                              <div className="label-badges">
                                {labels.map((label) => (
                                  <span key={label} className="label-chip">
                                    {label}
                                  </span>
                                ))}
                              </div>
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
    </div>
  )
}

export default App
