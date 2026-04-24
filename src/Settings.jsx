import { useEffect, useMemo, useRef, useState } from 'react'

const SECTORS = ['IT', 'Banking', 'Healthcare', 'Automobile', 'Oil & Gas', 'Consumer Goods', 'Metals', 'Financial', 'Insurance', 'Infrastructure', 'Energy', 'Manufacturing']

const defaultSettings = (user) => ({
  profile: {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || 'India',
    currency: user?.currency || 'INR',
  },
  riskTolerance: 50,
  selectedSectors: ['IT', 'Banking'],
  investmentMin: 10000,
  investmentMax: 100000,
  notifications: {
    priceAlerts: true,
    weeklyReport: true,
    newOpportunities: true,
    riskWarnings: false,
  },
})

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatCurrency = (value = 0) => `₹${Math.round(toNumber(value)).toLocaleString('en-IN')}`

const loadSettingsFromStorage = (storageKey, user) => {
  const defaults = defaultSettings(user)

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults

    const parsed = JSON.parse(raw)
    return {
      profile: { ...defaults.profile, ...(parsed.profile || {}) },
      riskTolerance: toNumber(parsed.riskTolerance, defaults.riskTolerance),
      selectedSectors: Array.isArray(parsed.selectedSectors) && parsed.selectedSectors.length > 0
        ? parsed.selectedSectors
        : defaults.selectedSectors,
      investmentMin: toNumber(parsed.investmentMin, defaults.investmentMin),
      investmentMax: toNumber(parsed.investmentMax, defaults.investmentMax),
      notifications: { ...defaults.notifications, ...(parsed.notifications || {}) },
    }
  } catch {
    return defaults
  }
}

export default function Settings({ user, userId = 'demo', onProfileUpdate, alertCenter = null }) {
  const storageKey = useMemo(() => `profitly_settings_${userId}`, [userId])
  const initialSettings = loadSettingsFromStorage(storageKey, user)

  const [profile, setProfile] = useState(initialSettings.profile)
  const [riskTolerance, setRiskTolerance] = useState(initialSettings.riskTolerance)
  const [selectedSectors, setSelectedSectors] = useState(initialSettings.selectedSectors)
  const [investmentMin, setInvestmentMin] = useState(initialSettings.investmentMin)
  const [investmentMax, setInvestmentMax] = useState(initialSettings.investmentMax)
  const [notifications, setNotifications] = useState(initialSettings.notifications)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const alertsCardRef = useRef(null)

  useEffect(() => {
    if (!alertCenter?.focusSignal) return
    if (!alertsCardRef.current) return

    alertsCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [alertCenter?.focusSignal])

  const toggleSector = (sector) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((item) => item !== sector) : [...prev, sector]
    )
  }

  const handleSave = () => {
    setError('')

    if (toNumber(investmentMin) <= 0 || toNumber(investmentMax) <= 0) {
      setError('Investment range must be greater than zero.')
      return
    }

    if (toNumber(investmentMin) > toNumber(investmentMax)) {
      setError('Minimum investment cannot be greater than maximum investment.')
      return
    }

    const payload = {
      profile: {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        country: profile.country.trim(),
        currency: profile.currency.trim().toUpperCase(),
      },
      riskTolerance: toNumber(riskTolerance, 50),
      selectedSectors,
      investmentMin: toNumber(investmentMin, 10000),
      investmentMax: toNumber(investmentMax, 100000),
      notifications,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem(storageKey, JSON.stringify(payload))

    if (onProfileUpdate) {
      onProfileUpdate({
        ...(user || {}),
        name: payload.profile.name || user?.name || 'Investor',
        email: payload.profile.email || user?.email || '',
        phone: payload.profile.phone,
        country: payload.profile.country,
        currency: payload.profile.currency,
      })
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const riskLabel = riskTolerance < 33 ? 'Conservative' : riskTolerance < 66 ? 'Moderate' : 'Aggressive'

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="settings-title">Settings</h2>
        <p className="settings-sub">Edit your profile and investment preferences.</p>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">User Profile</h3>
        <p className="settings-card-sub">These details are visible in your app header and account summary.</p>

        <div className="settings-grid two-col">
          <div className="settings-field">
            <label>Full Name</label>
            <input
              className="range-field"
              value={profile.name}
              onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Your full name"
            />
          </div>

          <div className="settings-field">
            <label>Email</label>
            <input
              className="range-field"
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@example.com"
            />
          </div>

          <div className="settings-field">
            <label>Phone</label>
            <input
              className="range-field"
              value={profile.phone}
              onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+91"
            />
          </div>

          <div className="settings-field">
            <label>Country</label>
            <input
              className="range-field"
              value={profile.country}
              onChange={(event) => setProfile((prev) => ({ ...prev, country: event.target.value }))}
            />
          </div>

          <div className="settings-field">
            <label>Preferred Currency</label>
            <input
              className="range-field"
              value={profile.currency}
              onChange={(event) => setProfile((prev) => ({ ...prev, currency: event.target.value }))}
              placeholder="INR"
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Risk Tolerance</h3>
        <p className="settings-card-sub">Adjust how much risk you are comfortable taking.</p>

        <div className="risk-slider-wrap">
          <div className="risk-labels">
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
          <input
            className="risk-slider"
            type="range"
            min="0"
            max="100"
            value={riskTolerance}
            onChange={(event) => setRiskTolerance(Number(event.target.value))}
          />
          <div className="risk-value">{riskLabel} - {riskTolerance}%</div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Preferred Sectors</h3>
        <p className="settings-card-sub">Select sectors you want to prioritize in recommendations.</p>

        <div className="sector-grid">
          {SECTORS.map((sector) => (
            <button
              key={sector}
              className={`sector-chip ${selectedSectors.includes(sector) ? 'active' : ''}`}
              onClick={() => toggleSector(sector)}
            >
              {selectedSectors.includes(sector) ? 'Selected' : 'Select'} {sector}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Investment Range</h3>
        <p className="settings-card-sub">Set your minimum and maximum investment values.</p>

        <div className="investment-range">
          <div className="range-input">
            <label>Minimum (INR)</label>
            <input
              className="range-field"
              type="number"
              value={investmentMin}
              onChange={(event) => setInvestmentMin(event.target.value)}
            />
          </div>

          <div className="range-divider">to</div>

          <div className="range-input">
            <label>Maximum (INR)</label>
            <input
              className="range-field"
              type="number"
              value={investmentMax}
              onChange={(event) => setInvestmentMax(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Notification Preferences</h3>
        <p className="settings-card-sub">Choose which alerts and updates you want to receive.</p>

        <div className="notifications-list">
          {[
            { key: 'priceAlerts', label: 'Price Alerts', desc: 'Notify me when tracked stocks move significantly.' },
            { key: 'weeklyReport', label: 'Weekly Report', desc: 'Send a weekly performance summary.' },
            { key: 'newOpportunities', label: 'New Opportunities', desc: 'Alert me when new matching ideas appear.' },
            { key: 'riskWarnings', label: 'Risk Warnings', desc: 'Notify me when portfolio risk profile changes.' },
          ].map((item) => (
            <div key={item.key} className="notification-item">
              <div>
                <p className="notification-label">{item.label}</p>
                <p className="notification-desc">{item.desc}</p>
              </div>

              <button
                className={`toggle-btn ${notifications[item.key] ? 'on' : 'off'}`}
                onClick={() => setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
              >
                {notifications[item.key] ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {alertCenter && (
        <div ref={alertsCardRef} className="settings-card settings-alert-center">
          <div className="shell-card-header-row">
            <h3 className="settings-card-title">Recommendations & Alerts</h3>
            <span className="shell-reco-badge">{alertCenter.triggeredAlertCount || 0} triggered</span>
          </div>
          <p className="settings-card-sub">Manage price alerts and review recommendation signals from one place.</p>

          <div className="shell-reco-block">
            <p className="shell-reco-title">Buy/Sell Signals</p>
            {!Array.isArray(alertCenter.highlightedSignals) || alertCenter.highlightedSignals.length === 0 ? (
              <p className="shell-alert-text">No urgent buy/sell signals. Portfolio is currently stable.</p>
            ) : (
              <div className="shell-reco-list">
                {alertCenter.highlightedSignals.map((signal, index) => (
                  <div key={`${signal.company}-${index}`} className={`shell-reco-item ${signal.tone}`}>
                    <div>
                      <p className="shell-asset-name">{signal.company}</p>
                      <p className="shell-asset-sub">{signal.reason}</p>
                    </div>
                    <span className="shell-reco-action">{signal.action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shell-reco-block">
            <p className="shell-reco-title">Price Alerts (Watched Stocks)</p>
            <div className="shell-alert-form">
              <input
                list="profitly-watchlist-options-settings"
                value={alertCenter.priceAlertDraft?.stock || ''}
                onChange={(event) => {
                  alertCenter.setPriceAlertDraft((prev) => ({ ...prev, stock: event.target.value }))
                  alertCenter.setPriceAlertNote('')
                }}
                placeholder="Ticker or company"
              />
              <datalist id="profitly-watchlist-options-settings">
                {(alertCenter.watchableStocks || []).map((stock) => (
                  <option key={stock} value={stock} />
                ))}
              </datalist>
              <select
                value={alertCenter.priceAlertDraft?.condition || 'above'}
                onChange={(event) => {
                  alertCenter.setPriceAlertDraft((prev) => ({ ...prev, condition: event.target.value }))
                  alertCenter.setPriceAlertNote('')
                }}
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={alertCenter.priceAlertDraft?.targetPrice || ''}
                onChange={(event) => {
                  alertCenter.setPriceAlertDraft((prev) => ({ ...prev, targetPrice: event.target.value }))
                  alertCenter.setPriceAlertNote('')
                }}
                placeholder="Trigger price"
              />
              <button className="shell-alert-add-btn" onClick={alertCenter.addPriceAlert}>Add</button>
            </div>
            {alertCenter.priceAlertNote && (
              <p className="shell-alert-note">{alertCenter.priceAlertNote}</p>
            )}
            {!Array.isArray(alertCenter.evaluatedPriceAlerts) || alertCenter.evaluatedPriceAlerts.length === 0 ? (
              <p className="shell-alert-text">No price alerts yet. Add watched stocks to track triggers.</p>
            ) : (
              <div className="shell-alert-list">
                {alertCenter.evaluatedPriceAlerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className={`shell-alert-row ${alert.triggered ? 'triggered' : ''}`}>
                    <div>
                      <p className="shell-asset-name">{alert.stock}</p>
                      <p className="shell-asset-sub">
                        {alert.condition === 'above' ? 'Above' : 'Below'} {formatCurrency(alert.targetPrice)}
                        {alert.livePrice !== null ? ` · Live ${formatCurrency(alert.livePrice)}` : ' · Live price unavailable'}
                      </p>
                    </div>
                    <div className="shell-alert-actions">
                      <span className={`shell-alert-pill ${alert.triggered ? 'triggered' : (alert.active ? 'active' : 'inactive')}`}>
                        {alert.triggered ? 'Triggered' : (alert.active ? 'Watching' : 'Paused')}
                      </span>
                      <button className="shell-view-all" onClick={() => alertCenter.togglePriceAlert(alert.id)}>
                        {alert.active ? 'Pause' : 'Resume'}
                      </button>
                      <button className="shell-view-all shell-danger" onClick={() => alertCenter.removePriceAlert(alert.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shell-reco-block">
            <p className="shell-reco-title">Rebalancing Suggestions</p>
            <div className="shell-rebalance-list">
              {(alertCenter.rebalancingSuggestions || []).map((suggestion, index) => (
                <p key={`rebalance-${index}`} className="shell-alert-text">{index + 1}. {suggestion}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="settings-actions">
        {error && <p className="save-error">{error}</p>}
        {saved && <p className="save-success">Settings saved successfully.</p>}
        <button className="save-settings-btn" onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  )
}
