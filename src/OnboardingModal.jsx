import { useState, useEffect } from 'react'
import { apiUrl } from './api'

const SECTORS = ['IT', 'Banking', 'Healthcare', 'Automobile', 'Oil & Gas', 'Consumer Goods', 'Metals', 'Financial']
const emptyHolding = { company: '', sector: '', entryPrice: '', currentValue: '' }

export default function OnboardingModal({ userId, onComplete, onSkip }) {
  const [step, setStep] = useState(1)
  const [riskProfile, setRiskProfile] = useState({ tolerance: '', horizon: '', goal: '' })
  const [holdings, setHoldings] = useState([{ ...emptyHolding }])
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateHolding = (index, field, value) => {
    const updated = [...holdings]
    updated[index][field] = value
    setHoldings(updated)
  }

  // Generate quick, real-time suggestions based on entered holdings.
  // This helps the user see AI-style insights as they type.
  useEffect(() => {
    const valid = holdings.filter(h => h.company && h.sector && h.entryPrice && h.currentValue)
    if (valid.length === 0) {
      setSuggestions([])
      return
    }

    const sectors = Array.from(new Set(valid.map(h => h.sector)))
    const negativeReturns = valid.filter(h => {
      const entry = parseFloat(h.entryPrice)
      const current = parseFloat(h.currentValue)
      return !isNaN(entry) && !isNaN(current) && current < entry
    })

    const newSuggestions = []
    if (sectors.length === 1) {
      newSuggestions.push(`You’ve invested only in ${sectors[0]}. Consider diversifying across sectors.`)
    } else {
      newSuggestions.push(`Nice diversification across ${sectors.join(', ')}.`)
    }

    if (negativeReturns.length > 0) {
      newSuggestions.push(`Some holdings are currently down (e.g., ${negativeReturns.map(h => h.company).join(', ')}). Consider reviewing those positions.`)
    }

    const avgReturn = valid.reduce((acc, h) => {
      const entry = parseFloat(h.entryPrice)
      const current = parseFloat(h.currentValue)
      if (isNaN(entry) || isNaN(current)) return acc
      return acc + ((current - entry) / entry) * 100
    }, 0) / valid.length

    if (!Number.isNaN(avgReturn)) {
      newSuggestions.push(`Your current average return is ${avgReturn.toFixed(1)}% across the holdings.`)
    }

    setSuggestions(newSuggestions)
  }, [holdings])

  const savePortfolio = async () => {
    setSaving(true)
    try {
      const validHoldings = holdings.filter(h => h.company && h.sector && h.entryPrice && h.currentValue)
      if (validHoldings.length > 0) {
        await fetch(apiUrl('/api/portfolio/save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            riskProfile,
            holdings: validHoldings.map(h => ({
              ...h,
              entryPrice: parseFloat(h.entryPrice),
              currentValue: parseFloat(h.currentValue)
            }))
          })
        })
      }
      onComplete()
    } catch (error) {
      console.log('Error:', error)
      onComplete()
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">

        {/* Step indicators */}
        <div className="modal-steps">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`modal-step-dot ${step >= s ? 'active' : ''}`}>{s}</div>
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="modal-content">
            <div className="modal-icon">💎</div>
            <h2 className="modal-title">Welcome to Profitly!</h2>
            <p className="modal-sub">Let's set up your portfolio for personalized AI investment recommendations.</p>
            <div className="modal-features">
              {[
                '🎯 Personalized fit scores based on your holdings',
                '📊 Real-time Nifty 50 market analysis',
                '🤖 AI-powered investment suggestions',
                '⚠️ Risk analysis and rebalancing tips',
              ].map((f, i) => <p key={i} className="modal-feature">{f}</p>)}
            </div>
            <button className="modal-btn" onClick={() => setStep(2)}>Get Started →</button>
            <button className="modal-skip" onClick={onSkip}>Skip for now</button>
          </div>
        )}

        {/* Step 2 — Risk profile */}
        {step === 2 && (
          <div className="modal-content">
            <h2 className="modal-title">🧭 Risk Profile</h2>
            <p className="modal-sub">Help us understand your investing style so we can personalize recommendations.</p>

            <div className="modal-field">
              <label>Risk tolerance</label>
              <select
                value={riskProfile.tolerance}
                onChange={e => setRiskProfile(prev => ({ ...prev, tolerance: e.target.value }))}
                className="modal-input"
              >
                <option value="">Select tolerance</option>
                <option value="low">Low (preserve capital)</option>
                <option value="medium">Medium (balanced growth)</option>
                <option value="high">High (growth focused)</option>
              </select>
            </div>

            <div className="modal-field">
              <label>Investment horizon</label>
              <select
                value={riskProfile.horizon}
                onChange={e => setRiskProfile(prev => ({ ...prev, horizon: e.target.value }))}
                className="modal-input"
              >
                <option value="">Select horizon</option>
                <option value="short">Short (under 1 year)</option>
                <option value="medium">Medium (1-5 years)</option>
                <option value="long">Long (5+ years)</option>
              </select>
            </div>

            <div className="modal-field">
              <label>Primary goal</label>
              <select
                value={riskProfile.goal}
                onChange={e => setRiskProfile(prev => ({ ...prev, goal: e.target.value }))}
                className="modal-input"
              >
                <option value="">Select goal</option>
                <option value="growth">Growth</option>
                <option value="income">Income</option>
                <option value="preservation">Capital preservation</option>
              </select>
            </div>

            <div className="modal-nav">
              <button className="modal-btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="modal-btn" onClick={() => {
                if (!riskProfile.tolerance || !riskProfile.horizon || !riskProfile.goal) {
                  setError('⚠️ Please answer all the risk profile questions.')
                  return
                }
                setError('')
                setStep(3)
              }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Add holdings */}
        {step === 3 && (
          <div className="modal-content">
            <h2 className="modal-title">📂 Add Your Holdings</h2>
            <p className="modal-sub">Enter your current investments for personalized analysis</p>
            <div className="modal-holdings">
              {holdings.map((h, i) => {
                const ret = h.entryPrice && h.currentValue
                  ? (((parseFloat(h.currentValue) - parseFloat(h.entryPrice)) / parseFloat(h.entryPrice)) * 100).toFixed(1)
                  : null
                return (
                  <div key={i} className="modal-holding-row">
                    <input
                      placeholder="Company name"
                      value={h.company}
                      onChange={e => updateHolding(i, 'company', e.target.value)}
                      className="modal-input"
                    />
                    <select
                      value={h.sector}
                      onChange={e => updateHolding(i, 'sector', e.target.value)}
                      className="modal-input"
                    >
                      <option value="">Sector</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Entry ₹"
                      value={h.entryPrice}
                      onChange={e => updateHolding(i, 'entryPrice', e.target.value)}
                      className="modal-input"
                    />
                    <input
                      type="number"
                      placeholder="Current ₹"
                      value={h.currentValue}
                      onChange={e => updateHolding(i, 'currentValue', e.target.value)}
                      className="modal-input"
                    />
                    {ret !== null && (
                      <span className={`modal-return ${parseFloat(ret) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(ret) >= 0 ? '↑' : '↓'}{Math.abs(ret)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <button className="modal-add-btn" onClick={() => setHoldings([...holdings, { ...emptyHolding }])}>
              ＋ Add Another
            </button>

            {suggestions.length > 0 && (
              <div className="modal-suggestions">
                <h4>Suggestions</h4>
                <ul>
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px', textAlign: 'center' }}>{error}</p>}
            <div className="modal-nav">
              <button className="modal-btn-outline" onClick={() => setStep(2)}>← Back</button>
              <button className="modal-btn" onClick={() => {
                const valid = holdings.every(h => h.company && h.sector && h.entryPrice && h.currentValue)
                if (!valid) {
                  setError('⚠️ Please fill in all fields for each holding!')
                  return
                }
                setError('')
                setStep(4)
              }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 4 — Confirm */}
        {step === 4 && (
          <div className="modal-content">
            <div className="modal-icon">🚀</div>
            <h2 className="modal-title">You're all set!</h2>
            <p className="modal-sub">Your portfolio has been configured. Profitly will now provide personalized recommendations.</p>
            <div className="modal-summary">
              <div className="modal-summary-item">
                <span>📂 Holdings added</span>
                <span className="gold">{holdings.filter(h => h.company).length}</span>
              </div>
              <div className="modal-summary-item">
                <span>🤖 AI Model</span>
                <span className="gold">Qwen 2.5 3B</span>
              </div>
              <div className="modal-summary-item">
                <span>📊 Market Data</span>
                <span className="gold">Nifty 50 Live</span>
              </div>
            </div>
            <button className="modal-btn" onClick={savePortfolio} disabled={saving}>
              {saving ? '⏳ Saving...' : '💎 Launch Profitly'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
