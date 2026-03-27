import { useState } from 'react'

const SECTORS = ['IT', 'Banking', 'Healthcare', 'Automobile', 'Oil & Gas', 'Consumer Goods', 'Metals', 'Financial', 'Insurance', 'Infrastructure', 'Energy', 'Manufacturing']

export default function Settings() {
  const [riskTolerance, setRiskTolerance]       = useState(50)
  const [selectedSectors, setSelectedSectors]   = useState(['IT', 'Banking'])
  const [investmentMin, setInvestmentMin]        = useState(10000)
  const [investmentMax, setInvestmentMax]        = useState(100000)
  const [notifications, setNotifications]        = useState({
    priceAlerts:    true,
    weeklyReport:   true,
    newOpportunities: true,
    riskWarnings:   false,
  })
  const [saved, setSaved] = useState(false)

  const toggleSector = (sector) => {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    )
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const riskLabel = riskTolerance < 33 ? '🟢 Conservative' : riskTolerance < 66 ? '🟡 Moderate' : '🔴 Aggressive'

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="settings-title">⚙️ Settings</h2>
        <p className="settings-sub">Customize your investment preferences</p>
      </div>

      {/* Risk Tolerance */}
      <div className="settings-card">
        <h3 className="settings-card-title">🎯 Risk Tolerance</h3>
        <p className="settings-card-sub">Adjust how much risk you're comfortable taking</p>
        <div className="risk-slider-wrap">
          <div className="risk-labels">
            <span>🟢 Conservative</span>
            <span>🟡 Moderate</span>
            <span>🔴 Aggressive</span>
          </div>
          <input
            type="range"
            min="0" max="100"
            value={riskTolerance}
            onChange={e => setRiskTolerance(e.target.value)}
            className="risk-slider"
          />
          <div className="risk-value">{riskLabel} — {riskTolerance}%</div>
        </div>
      </div>

      {/* Preferred Sectors */}
      <div className="settings-card">
        <h3 className="settings-card-title">🏭 Preferred Sectors</h3>
        <p className="settings-card-sub">Select sectors you want to focus on</p>
        <div className="sector-grid">
          {SECTORS.map(sector => (
            <button
              key={sector}
              className={`sector-chip ${selectedSectors.includes(sector) ? 'active' : ''}`}
              onClick={() => toggleSector(sector)}
            >
              {selectedSectors.includes(sector) ? '✅' : '⬜'} {sector}
            </button>
          ))}
        </div>
      </div>

      {/* Investment Range */}
      <div className="settings-card">
        <h3 className="settings-card-title">💰 Investment Range</h3>
        <p className="settings-card-sub">Set your minimum and maximum investment amounts</p>
        <div className="investment-range">
          <div className="range-input">
            <label>Minimum (₹)</label>
            <input
              type="number"
              value={investmentMin}
              onChange={e => setInvestmentMin(e.target.value)}
              className="range-field"
            />
          </div>
          <div className="range-divider">→</div>
          <div className="range-input">
            <label>Maximum (₹)</label>
            <input
              type="number"
              value={investmentMax}
              onChange={e => setInvestmentMax(e.target.value)}
              className="range-field"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-card">
        <h3 className="settings-card-title">🔔 Notification Preferences</h3>
        <p className="settings-card-sub">Choose what alerts you want to receive</p>
        <div className="notifications-list">
          {[
            { key: 'priceAlerts',       label: '📊 Price Alerts',        desc: 'Get notified when stocks move significantly'    },
            { key: 'weeklyReport',      label: '📋 Weekly Report',        desc: 'Receive a weekly portfolio performance summary' },
            { key: 'newOpportunities',  label: '🚀 New Opportunities',    desc: 'Alert when new matching investments appear'     },
            { key: 'riskWarnings',      label: '⚠️ Risk Warnings',        desc: 'Notify when portfolio risk level changes'       },
          ].map(n => (
            <div key={n.key} className="notification-item">
              <div>
                <p className="notification-label">{n.label}</p>
                <p className="notification-desc">{n.desc}</p>
              </div>
              <button
                className={`toggle-btn ${notifications[n.key] ? 'on' : 'off'}`}
                onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
              >
                {notifications[n.key] ? '✅ On' : '⬜ Off'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="settings-actions">
        {saved && <p className="save-success">✅ Settings saved successfully!</p>}
        <button className="save-settings-btn" onClick={handleSave}>
          💾 Save Settings
        </button>
      </div>
    </div>
  )
}