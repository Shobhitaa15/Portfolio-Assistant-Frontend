import { useState, useEffect, useCallback } from 'react'
import './index.css'
import Portfolio from './Portfolio'
import { apiUrl } from './api'
import Analytics from './Analytics'

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const summarizePortfolio = (holdings = []) => {
  const normalizedHoldings = holdings.map((holding) => {
    const entryPrice = toNumber(holding.entryPrice)
    const currentValue = toNumber(holding.currentValue)
    const returnPercentage = entryPrice > 0
      ? Number((((currentValue - entryPrice) / entryPrice) * 100).toFixed(2))
      : 0

    return {
      ...holding,
      entryPrice,
      currentValue,
      returnPercentage,
    }
  })

  const totalValue = normalizedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0)
  const avgReturn = normalizedHoldings.length > 0
    ? Number((normalizedHoldings.reduce((sum, holding) => sum + holding.returnPercentage, 0) / normalizedHoldings.length).toFixed(2))
    : 0

  return {
    holdings: normalizedHoldings,
    totalValue,
    avgReturn,
    updatedAt: new Date().toISOString(),
  }
}

function App({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [portfolioData, setPortfolioData] = useState(null)
  const [recentActivity] = useState([
    { icon: '📈', name: 'TCS Buy Order', sub: 'Tata Consultancy · IT Equity', status: 'SETTLED', date: 'Mar 15, 2026', impact: '+₹12,400', growth: '+4.2% GROWTH', positive: true },
    { icon: '💰', name: 'Quarterly Dividend', sub: 'HDFC Bank · Banking', status: 'PENDING', date: 'Mar 12, 2026', impact: '+₹3,120', growth: 'AUTO-INVESTED', positive: true },
    { icon: '🏷️', name: 'Tata Motors Sell', sub: 'Tata Motors · Automotive', status: 'SETTLED', date: 'Mar 10, 2026', impact: '-₹8,500', growth: '-1.1% EXIT', positive: false },
  ])

  const [marketRows, setMarketRows] = useState([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketSector, setMarketSector] = useState('All')

  const firstName = user?.name?.split(' ')[0] || 'Investor'

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning,'
    if (hour < 17) return 'Good afternoon,'
    return 'Good evening,'
  }

  const fetchPortfolio = useCallback(async () => {
    try {
      const params = new URLSearchParams({ userId: user?.id || 'demo' })
      const res = await fetch(`${apiUrl('/api/portfolio/get')}?${params.toString()}`)
      const data = await res.json()
      setPortfolioData(data.portfolio || null)
    } catch (e) {
      console.log('Portfolio fetch error:', e)
    }
  }, [user?.id])

  const fetchMarkets = useCallback(async () => {
    setMarketLoading(true)
    setMarketError('')
    try {
      const params = new URLSearchParams({ limit: '60' })
      const cleanSearch = marketSearch.trim()
      if (cleanSearch) params.set('search', cleanSearch)
      if (marketSector !== 'All') params.set('sector', marketSector)

      const res = await fetch(`${apiUrl('/api/chat/markets')}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to load market fields')

      setMarketRows(Array.isArray(data.markets) ? data.markets : [])
    } catch (e) {
      console.log('Markets fetch error:', e)
      setMarketError('Unable to load market fields right now.')
    }
    setMarketLoading(false)
  }, [marketSearch, marketSector])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPortfolio()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchPortfolio])

  useEffect(() => {
    if (activeNav !== 'Markets') return
    const timer = setTimeout(() => {
      fetchMarkets()
    }, 0)
    return () => clearTimeout(timer)
  }, [activeNav, fetchMarkets])

  useEffect(() => {
    if (activeNav !== 'Analytics') return
    fetchPortfolio()
    const intervalId = setInterval(() => {
      fetchPortfolio()
    }, 12000)
    return () => clearInterval(intervalId)
  }, [activeNav, fetchPortfolio])

  const sendMessage = async (text) => {
    const messageText = text || input
    if (!messageText.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: messageText }])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          sessionHistory: messages.map(m => ({ role: m.role, content: m.content })),
          userId: user?.id || 'demo'
        })
      })
      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        offerings: data.offerings,
        suggestions: data.suggestions
      }])
    } catch (error) {
      console.log('Error:', error)
    }
    setLoading(false)
  }

  if (showPortfolio) return (
    <Portfolio
      userId={user?.id || 'demo'}
      setPortfolio={(nextPortfolio) => {
        if (Array.isArray(nextPortfolio)) {
          setPortfolioData((prev) => ({ ...(prev || {}), ...summarizePortfolio(nextPortfolio) }))
          return
        }
        if (nextPortfolio && typeof nextPortfolio === 'object') {
          setPortfolioData(nextPortfolio)
        }
      }}
      onBack={() => { setShowPortfolio(false); setActiveNav('Dashboard'); fetchPortfolio() }}
    />
  )

  const totalValue = portfolioData?.totalValue || 124500
  const avgReturn = portfolioData?.avgReturn || 2.4
  const marketSectors = ['All', ...Array.from(new Set([marketSector, ...marketRows.map((row) => row.sector).filter(Boolean)])).filter(Boolean).sort()]

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="shell-sidebar">
        <div className="shell-logo">
          <div className="shell-logo-icon">⚖️</div>
          <div>
            <div className="shell-logo-name">PROFITLY</div>
            <div className="shell-logo-sub">SOVEREIGN LEDGER</div>
          </div>
        </div>

        <nav className="shell-nav">
          {[
            { icon: '▦', label: 'Dashboard' },
            { icon: '💼', label: 'Portfolio' },
            { icon: '📊', label: 'Markets' },
            { icon: '📉', label: 'Analytics' },
            { icon: '🔒', label: 'Vault' },
          ].map(item => (
            <button
              key={item.label}
              className={`shell-nav-item ${activeNav === item.label ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.label)
                if (item.label === 'Portfolio') setShowPortfolio(true)
              }}
            >
              <span className="shell-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <button className="shell-new-btn" onClick={() => setShowPortfolio(true)}>
          <span>+</span> NEW INVESTMENT
        </button>

        <div className="shell-sidebar-bottom">
          <button className="shell-nav-item" onClick={() => setActiveNav('Settings')}>
            <span className="shell-nav-icon">⚙️</span> Settings
          </button>
          <button className="shell-nav-item" onClick={onLogout}>
            <span className="shell-nav-icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="shell-main">
        {/* Top bar */}
        <header className="shell-topbar">
          <div className="shell-search">
            <span>🔍</span>
            <input
              value={activeNav === 'Markets' ? marketSearch : searchInput}
              onChange={(e) => {
                if (activeNav === 'Markets') {
                  setMarketSearch(e.target.value)
                } else {
                  setSearchInput(e.target.value)
                }
              }}
              placeholder={activeNav === 'Markets' ? 'Search ticker or company...' : 'Search markets, assets, or reports...'}
            />
          </div>
          <nav className="shell-topnav">
            {['Overview', 'History', 'Reports'].map(t => (
              <button key={t} className="shell-topnav-item">{t}</button>
            ))}
            <button className="shell-deposit-btn">Deposit</button>
          </nav>
          <div className="shell-user">
            <div className="shell-user-info">
              <span className="shell-user-name">{firstName}</span>
              <span className="shell-user-role">PRIVATE BANKING</span>
            </div>
            <div className="shell-user-avatar">{firstName[0]}</div>
          </div>
        </header>

        {/* Dashboard content */}
        <div className="shell-content">
          {activeNav === 'Markets' ? (
            <div className="markets-view">
              <div className="markets-heading">
                <p className="shell-briefing-label">MARKETS</p>
                <h2 className="markets-title">Live Market Fields</h2>
                <p className="markets-sub">
                  Track core fields for each stock: price, range, volume, return, risk and liquidity.
                </p>
              </div>

              <div className="markets-controls">
                <select
                  className="markets-select"
                  value={marketSector}
                  onChange={(e) => setMarketSector(e.target.value)}
                >
                  {marketSectors.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>

                <button className="markets-refresh" onClick={fetchMarkets}>
                  Refresh Fields
                </button>
              </div>

              {marketLoading && <p className="markets-loading">Loading market fields...</p>}
              {!marketLoading && marketError && <p className="markets-error">{marketError}</p>}

              {!marketLoading && !marketError && (
                <div className="markets-table-wrap">
                  <div className="markets-table-head">
                    <span>Ticker</span>
                    <span>Company</span>
                    <span>Sector</span>
                    <span>Price</span>
                    <span>Day Range</span>
                    <span>Volume</span>
                    <span>Return</span>
                    <span>Risk</span>
                    <span>Liquidity</span>
                  </div>

                  {marketRows.length === 0 && (
                    <div className="markets-empty">No matching stocks found for the selected filters.</div>
                  )}

                  {marketRows.map((row) => (
                    <div key={row.ticker} className="markets-table-row">
                      <span className="markets-ticker">{row.ticker}</span>
                      <span className="markets-company">{row.company}</span>
                      <span>{row.sector || 'N/A'}</span>
                      <span>₹{Number(row.latestClose || 0).toLocaleString('en-IN')}</span>
                      <span>₹{Number(row.lowPrice || 0).toLocaleString('en-IN')} - ₹{Number(row.highPrice || 0).toLocaleString('en-IN')}</span>
                      <span>{Number(row.volume || 0).toLocaleString('en-IN')}</span>
                      <span className={Number(row.returnPercent) >= 0 ? 'markets-positive' : 'markets-negative'}>
                        {Number(row.returnPercent) >= 0 ? '+' : ''}{Number(row.returnPercent || 0).toFixed(2)}%
                      </span>
                      <span className={`markets-pill ${row.risk || 'medium'}`}>{row.risk || 'medium'}</span>
                      <span className={`markets-pill ${row.liquidity || 'medium'}`}>{row.liquidity || 'medium'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeNav === 'Analytics' ? (
            <Analytics portfolio={portfolioData} />
          ) : (
            <>
          {/* Morning briefing */}
          <div className="shell-briefing">
            <div className="shell-briefing-left">
              <p className="shell-briefing-label">MORNING BRIEFING</p>
              <h1 className="shell-greeting">
                {getGreeting()}<br />
                <span className="shell-greeting-name">{firstName}.</span>
              </h1>
              <p className="shell-briefing-text">
                Your sovereign ledger has grown by {avgReturn}% since last week. The Nifty 50 markets are showing strong momentum in IT and Banking sectors.
              </p>
            </div>
            <div className="shell-wealth">
              <p className="shell-wealth-label">AGGREGATE WEALTH</p>
              <p className="shell-wealth-value">
                ₹{totalValue.toLocaleString('en-IN')}
                <span className="shell-wealth-decimal">.00</span>
              </p>
              <p className="shell-wealth-change">
                📈 +₹{Math.round(totalValue * 0.024).toLocaleString('en-IN')} ({avgReturn}%)
              </p>
            </div>
          </div>

{/* Middle cards row */}
<div className="shell-cards-row">
  {/* Left column — stats */}
  <div className="shell-left-col">
    {/* Fit Score card */}
    <div className="shell-card">
      <p className="shell-card-label">PORTFOLIO FIT SCORE</p>
      <div className="shell-card-header-row">
        <h2 className="shell-fit-score">94.2</h2>
        <div className="shell-verified">🏅</div>
      </div>
      <div className="shell-score-bar-bg">
        <div className="shell-score-bar" style={{ width: '94.2%' }} />
      </div>
      <p className="shell-card-sub">
        Optimization level is currently in the <span className="gold-text">top 5%</span> of peer benchmarks.
      </p>
    </div>

    {/* Projected Yield */}
    <div className="shell-card">
      <p className="shell-card-label">PROJECTED ANNUAL YIELD</p>
      <h3 className="shell-yield-value">
        ₹{Math.round(totalValue * 0.1).toLocaleString('en-IN')}
        <span className="shell-yield-change"> +0.8%</span>
      </h3>
      <div className="shell-quick-btns" style={{marginTop: '12px'}}>
        {['FIXED', 'EQUITY', 'ALT'].map(b => (
          <button key={b} className="shell-quick-btn"
            onClick={() => sendMessage(`Show me ${b} investments`)}>
            {b}
          </button>
        ))}
      </div>
    </div>

    {/* Market Alerts */}
    <div className="shell-card">
      <p className="shell-card-label">MARKET ALERT 🔔</p>
      <p className="shell-alert-text">Nifty 50 is up 1.2% today. IT sector showing strong momentum. Consider increasing tech exposure.</p>
    </div>
  </div>

  {/* Center — AI + Chat unified */}
  <div className="shell-card shell-card-dark shell-ai-chat">
    <div className="shell-insight-header">
      <div className="shell-ai-badge">AI</div>
      <p className="shell-card-label">PROFITLY INSIGHT ENGINE</p>
    </div>

    <h3 className="shell-insight-title">
      Strategic intelligence<br />
      for your <em>Nifty 50</em> assets.
    </h3>

    {/* Chat messages */}
    <div className="shell-chat-messages">
      {messages.length === 0 && (
        <div className="shell-empty-chat">
          <p>🤖 Ask me anything about your investments, risk levels, or market opportunities.</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`shell-chat-bubble ${msg.role}`}>
          {msg.role === 'assistant' && (
            <span className="shell-bubble-label">PROFITLY AI</span>
          )}
          <p>{msg.content}</p>
          {msg.offerings && msg.offerings.slice(0, 2).map((o, j) => (
            <div key={j} className="shell-inline-stock">
              <div>
                <span className="shell-stock-name">{o.company}</span>
                <span className="shell-stock-meta"> · {o.sector} · ₹{o.latestClose}</span>
              </div>
              <span className="shell-stock-score">{o.fitScore?.score}/100</span>
            </div>
          ))}
          {msg.suggestions && (
            <div className="shell-bubble-chips">
              {msg.suggestions.slice(0, 3).map((s, j) => (
                <button key={j} className="shell-chip" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
      ))}
      {loading && (
        <div className="shell-chat-bubble assistant">
          <span className="shell-bubble-label">PROFITLY AI</span>
          <div className="shell-typing">
            <span/><span/><span/>
          </div>
        </div>
      )}
    </div>

    {/* Chat input */}
    <div className="shell-chat-input-wrap">
      <span>💬</span>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && sendMessage()}
        placeholder="Ask Profitly AI about your investments..."
      />
      <button className="shell-send" onClick={() => sendMessage()}>→</button>
    </div>

    {/* Quick asks */}
    <div className="shell-quick-asks">
      {['📊 Analyze my portfolio', '⚠️ Check risk levels', '💡 Best opportunities', '📈 Top IT stocks'].map((q, i) => (
        <button key={i} className="shell-quick-ask" onClick={() => sendMessage(q)}>{q}</button>
      ))}
    </div>

    <button className="shell-rebalance-btn" onClick={() => sendMessage('Should I rebalance my portfolio?')}>
      Execute Rebalance →
    </button>
  </div>

  {/* Right — Vault Protection */}
  <div className="shell-right-col">
    <div className="shell-card">
      <p className="shell-card-label">VAULT PROTECTION 🔒</p>
      <p className="shell-alert-text">Auto-liquidity buffer engaged. ₹12k moved to reserve for upcoming margin calls.</p>
    </div>
    <div className="shell-card">
      <p className="shell-card-label">PORTFOLIO HEALTH</p>
      <div className="shell-health-items">
        {[
          { label: 'Diversification', value: '85%', color: 'var(--green)' },
          { label: 'Risk Balance', value: '72%', color: 'var(--amber)' },
          { label: 'Liquidity', value: '91%', color: 'var(--green)' },
        ].map((h, i) => (
          <div key={i} className="shell-health-item">
            <div className="shell-health-row">
              <span className="shell-health-label">{h.label}</span>
              <span className="shell-health-val" style={{color: h.color}}>{h.value}</span>
            </div>
            <div className="shell-score-bar-bg">
              <div className="shell-score-bar" style={{width: h.value, background: h.color}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="shell-card">
      <p className="shell-card-label">SECTORS 📊</p>
      {portfolioData?.holdings ? (
        [...new Set(portfolioData.holdings.map(h => h.sector))].map((s, i) => (
          <div key={i} className="shell-sector-item">
            <span className="shell-sector-name">{s}</span>
            <span className="shell-sector-count gold-text">
              {portfolioData.holdings.filter(h => h.sector === s).length} stocks
            </span>
          </div>
        ))
      ) : (
        <p className="shell-alert-text">Upload portfolio to see sector breakdown</p>
      )}
    </div>
  </div>
</div>
{/* Recent Activity */}
          <div className="shell-activity">
            <div className="shell-activity-header">
              <h3 className="shell-activity-title">Recent Activity Ledger</h3>
              <button className="shell-view-all">View All Statements</button>
            </div>
            <div className="shell-activity-table">
              <div className="shell-table-header">
                <span>ASSET / TRANSACTION</span>
                <span>STATUS</span>
                <span>DATE</span>
                <span>IMPACT</span>
              </div>
              {recentActivity.map((item, i) => (
                <div key={i} className="shell-table-row">
                  <div className="shell-table-asset">
                    <div className="shell-asset-icon">{item.icon}</div>
                    <div>
                      <p className="shell-asset-name">{item.name}</p>
                      <p className="shell-asset-sub">{item.sub}</p>
                    </div>
                  </div>
                  <div>
                    <span className={`shell-status ${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>
                  <span className="shell-date">{item.date}</span>
                  <div className="shell-impact">
                    <p className={`shell-impact-value ${item.positive ? 'positive' : 'negative'}`}>{item.impact}</p>
                    <p className="shell-impact-sub">{item.growth}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
