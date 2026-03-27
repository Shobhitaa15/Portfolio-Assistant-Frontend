import { useState } from 'react'
import { apiUrl } from './api'

const SECTORS = ['Fintech', 'Healthcare', 'Clean Energy', 'Edtech', 'Retail Tech', 'SaaS', 'Real Estate', 'Manufacturing', 'Other']

const emptyHolding = { company: '', sector: '', entryPrice: '', currentValue: '' }

function Portfolio({ userId, onBack, setPortfolio }) {
  const [tab, setTab] = useState('manual')
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

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    })
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(Boolean)
      const rows = lines.slice(1).map(line => {
        const [company, sector, entryPrice, currentValue] = line.split(',')
        return { company: company?.trim(), sector: sector?.trim(), entryPrice: entryPrice?.trim(), currentValue: currentValue?.trim() }
      }).filter(r => r.company)
      if (rows.length) {
        setHoldings(rows)
        scrollToBottom()
      }
    }
    reader.readAsText(file)
  }

  const handleJSON = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        const rows = Array.isArray(data) ? data : data.holdings || []
        setHoldings(rows.map(r => ({
          company: r.company || '',
          sector: r.sector || '',
          entryPrice: r.entryPrice || r.entry_price || '',
          currentValue: r.currentValue || r.current_value || ''
        })))
        scrollToBottom()
      } catch {
        setError('Invalid JSON format')
      }
    }
    reader.readAsText(file)
  }

  const savePortfolio = async () => {
    const valid = holdings.every(h => h.company && h.sector && h.entryPrice && h.currentValue)
    if (!valid) { setError('Please fill in all fields for each holding'); return }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/portfolio/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          holdings: holdings.map(h => ({ ...h, entryPrice: parseFloat(h.entryPrice), currentValue: parseFloat(h.currentValue) }))
        })
      })
      const data = await response.json()
      if (data.success) { setSaved(true); setPortfolio(data.portfolio || holdings); setTimeout(() => onBack(), 1500) }
      else setError(data.error)
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="portfolio-page">
      <div className="portfolio-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2 className="portfolio-title">💼 My Portfolio</h2>
          <p className="portfolio-sub">Upload your holdings for personalized AI analysis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="upload-tabs">
        {[
          { key: 'manual', label: '✏️ Manual Entry' },
          { key: 'csv',    label: '📄 CSV Upload' },
          { key: 'json',   label: '📦 JSON Upload' },
        ].map(t => (
          <button
            key={t.key}
            className={`upload-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CSV Upload */}
      {tab === 'csv' && (
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

      {/* JSON Upload */}
      {tab === 'json' && (
        <div className="upload-zone">
          <div className="upload-icon">📦</div>
          <p className="upload-title">Upload JSON File</p>
          <p className="upload-hint">Array of objects with company, sector, entryPrice, currentValue</p>
          <label className="upload-btn">
            Choose File
            <input type="file" accept=".json" onChange={handleJSON} hidden />
          </label>
        </div>
      )}

      {/* Holdings table - shown for all tabs */}
      {holdings.length > 0 && (
        <div className="holdings-table">
          <div className="table-header">
            <span>🏢 Company</span>
            <span>🏭 Sector</span>
            <span>💵 Entry Price ($)</span>
            <span>📈 Current Value ($)</span>
            <span>📊 Return</span>
            <span></span>
          </div>
          {holdings.map((h, i) => {
            const ret = h.entryPrice && h.currentValue
              ? (((parseFloat(h.currentValue) - parseFloat(h.entryPrice)) / parseFloat(h.entryPrice)) * 100).toFixed(1)
              : null
            return (
              <div key={i} className="table-row">
                <input
                  placeholder="e.g. GreenTech Solar"
                  value={h.company}
                  onChange={e => updateHolding(i, 'company', e.target.value)}
                />
                <select value={h.sector} onChange={e => updateHolding(i, 'sector', e.target.value)}>
                  <option value="">Select sector</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="10000"
                  value={h.entryPrice}
                  onChange={e => updateHolding(i, 'entryPrice', e.target.value)}
                />
                <input
                  type="number"
                  placeholder="13500"
                  value={h.currentValue}
                  onChange={e => updateHolding(i, 'currentValue', e.target.value)}
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

      {saved && <p className="upload-success">✅ Portfolio saved! Redirecting to dashboard...</p>}

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
