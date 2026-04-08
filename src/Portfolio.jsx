import { useRef, useState } from 'react'
import { apiUrl } from './api'

const SECTORS = ['Fintech', 'Healthcare', 'Clean Energy', 'Edtech', 'Retail Tech', 'SaaS', 'Real Estate', 'Manufacturing', 'Other']

const emptyHolding = { company: '', sector: '', entryPrice: '', currentValue: '' }

const normalizeAmount = (value) => {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  const cleaned = String(value).replace(/[^\d.-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? String(parsed) : ''
}

const normalizeHolding = (holding = {}) => ({
  company: String(
    holding.company
    ?? holding.name
    ?? holding.stock
    ?? holding.symbol
    ?? holding.ticker
    ?? ''
  ).trim(),
  sector: String(holding.sector ?? holding.category ?? holding.industry ?? '').trim() || 'Other',
  entryPrice: normalizeAmount(
    holding.entryPrice
    ?? holding.entry_price
    ?? holding.buyPrice
    ?? holding.buy_price
    ?? holding.purchasePrice
    ?? holding.costPrice
    ?? holding.avgBuyPrice
    ?? holding.avg_price
    ?? holding.averagePrice
  ),
  currentValue: normalizeAmount(
    holding.currentValue
    ?? holding.current_value
    ?? holding.marketValue
    ?? holding.market_value
    ?? holding.currentPrice
    ?? holding.current_price
    ?? holding.ltp
    ?? holding.lastPrice
    ?? holding.price
  ),
})

const getHoldingsFromJson = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.holdings)) return data.holdings
  if (Array.isArray(data?.portfolio?.holdings)) return data.portfolio.holdings
  if (Array.isArray(data?.data?.holdings)) return data.data.holdings
  if (Array.isArray(data?.positions)) return data.positions
  return []
}

function Portfolio({ userId, onBack, setPortfolio, theme = 'light', onToggleTheme }) {
  const pageRef = useRef(null)
  const quickJsonInputRef = useRef(null)
  const [tab, setTab] = useState('manual')
  const [jsonUploaded, setJsonUploaded] = useState(false)
  const [holdings, setHoldings] = useState([{ ...emptyHolding }])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const updateHolding = (index, field, value) => {
    const updated = [...holdings]
    updated[index][field] = value
    setHoldings(updated)
  }

  const addRow = () => setHoldings([...holdings, { ...emptyHolding }])

  const removeRow = (index) => {
    if (holdings.length === 1) return
    setHoldings(holdings.filter((_, i) => i !== index))
  }

  const scrollToHoldings = () => {
    window.requestAnimationFrame(() => {
      const table = pageRef.current?.querySelector('.holdings-table')
      if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      const container = pageRef.current
      if (container && container.scrollHeight > container.clientHeight) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        return
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    })
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = String(ev.target.result || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const rows = lines.slice(1).map((line) => {
        const [company, sector, entryPrice, currentValue] = line.split(',')
        return {
          company: company?.trim() || '',
          sector: sector?.trim() || '',
          entryPrice: normalizeAmount(entryPrice?.trim()),
          currentValue: normalizeAmount(currentValue?.trim()),
        }
      }).filter((row) => row.company && row.sector && row.entryPrice && row.currentValue)

      if (!rows.length) {
        setError('No valid rows found in CSV.')
        return
      }

      setJsonUploaded(false)
      setHoldings(rows)
      scrollToHoldings()
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleJSON = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = String(ev.target.result || '').replace(/^\uFEFF/, '').trim()
        const data = JSON.parse(raw)

        const rows = getHoldingsFromJson(data)
          .map(normalizeHolding)
          .filter((row) => row.company)

        if (!rows.length) {
          setError('No holdings found. Include at least company/name/symbol/ticker for each row.')
          return
        }

        setJsonUploaded(true)
        setHoldings(rows)
        scrollToHoldings()
      } catch {
        setError('Invalid JSON format')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const savePortfolio = async () => {
    const valid = holdings.every((h) => h.company && h.sector && h.entryPrice && h.currentValue)
    if (!valid) {
      setError('Please fill in all fields for each holding')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/portfolio/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          holdings: holdings.map((h) => ({
            ...h,
            entryPrice: Number.parseFloat(h.entryPrice),
            currentValue: Number.parseFloat(h.currentValue),
          })),
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSaved(true)
        setPortfolio(data.portfolio || holdings)
        setTimeout(() => onBack(), 1500)
      } else {
        setError(data.error || 'Failed to save portfolio')
      }
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="portfolio-page" ref={pageRef}>
      <div className="portfolio-header">
        <div className="portfolio-header-main">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div>
            <h2 className="portfolio-title">💼 My Portfolio</h2>
            <p className="portfolio-sub">Upload your holdings for personalized AI analysis</p>
          </div>
        </div>
        <div className="portfolio-header-actions">
          {jsonUploaded && (
            <>
              <input
                ref={quickJsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJSON}
                hidden
              />
              <button
                className="quick-json-btn"
                onClick={() => quickJsonInputRef.current?.click()}
              >
                + JSON Upload
              </button>
            </>
          )}
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {!jsonUploaded && (
        <div className="upload-tabs">
          {[
            { key: 'manual', label: '✏️ Manual Entry' },
            { key: 'csv', label: '📄 CSV Upload' },
            { key: 'json', label: '📦 JSON Upload' },
          ].map((t) => (
            <button
              key={t.key}
              className={`upload-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!jsonUploaded && tab === 'csv' && (
        <div className="upload-zone">
          <div className="upload-icon">📄</div>
          <p className="upload-title">Upload CSV File</p>
          <p className="upload-hint">Format: company, sector, entryPrice, currentValue</p>
          <a className="upload-sample" href="data:text/csv;charset=utf-8,company,sector,entryPrice,currentValue%0AGreenTech Solar,Clean Energy,10000,13500%0AHealthAI Labs,Healthcare,5000,7200" download="sample_portfolio.csv">
            ⬇️ Download Sample CSV
          </a>
          <label className="upload-btn">
            Choose File
            <input type="file" accept=".csv" onChange={handleCSV} hidden />
          </label>
        </div>
      )}

      {!jsonUploaded && tab === 'json' && (
        <div className="upload-zone">
          <div className="upload-icon">📦</div>
          <p className="upload-title">Upload JSON File</p>
          <p className="upload-hint">Supports [{'{...}'}], {'{ holdings: [...] }'}, and {'{ portfolio: { holdings: [...] } }'}</p>
          <label className="upload-btn">
            Choose File
            <input type="file" accept=".json,application/json" onChange={handleJSON} hidden />
          </label>
        </div>
      )}

      {holdings.length > 0 && (
        <div className="holdings-table">
          <div className="table-header">
            <span>🏢 Company</span>
            <span>🏭 Sector</span>
            <span>💵 Entry Price (₹)</span>
            <span>📈 Current Value (₹)</span>
            <span>📊 Return</span>
            <span></span>
          </div>
          {holdings.map((h, i) => {
            const ret = h.entryPrice && h.currentValue
              ? (((Number.parseFloat(h.currentValue) - Number.parseFloat(h.entryPrice)) / Number.parseFloat(h.entryPrice)) * 100).toFixed(1)
              : null

            return (
              <div key={i} className="table-row">
                <input
                  placeholder="e.g. GreenTech Solar"
                  value={h.company}
                  onChange={(ev) => updateHolding(i, 'company', ev.target.value)}
                />
                <select value={h.sector} onChange={(ev) => updateHolding(i, 'sector', ev.target.value)}>
                  <option value="">Select sector</option>
                  {SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="10000"
                  value={h.entryPrice}
                  onChange={(ev) => updateHolding(i, 'entryPrice', ev.target.value)}
                />
                <input
                  type="number"
                  placeholder="13500"
                  value={h.currentValue}
                  onChange={(ev) => updateHolding(i, 'currentValue', ev.target.value)}
                />
                <span className={`return-badge ${ret > 0 ? 'positive' : ret < 0 ? 'negative' : ''}`}>
                  {ret !== null ? `${ret > 0 ? '↑' : '↓'} ${Math.abs(ret)}%` : '—'}
                </span>
                <button className="remove-btn" onClick={() => removeRow(i)}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="upload-error">⚠️ {error}</p>}
      {saved && <p className="upload-success">✅ Portfolio saved and scored! Redirecting to dashboard...</p>}

      <div className="portfolio-actions">
        <button className="add-row-btn" onClick={addRow}>＋ Add Row</button>
        <button className="save-btn" onClick={savePortfolio} disabled={saving}>
          {saving ? '⏳ Saving...' : '💾 Save Portfolio'}
        </button>
      </div>
    </div>
  )
}

export default Portfolio


