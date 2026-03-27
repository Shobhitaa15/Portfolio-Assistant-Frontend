import { useEffect, useMemo, useState } from 'react'

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

export default function Settings({ user, userId = 'demo', onProfileUpdate }) {
  const storageKey = useMemo(() => `profitly_settings_${userId}`, [userId])

  const [profile, setProfile] = useState(defaultSettings(user).profile)
  const [riskTolerance, setRiskTolerance] = useState(50)
  const [selectedSectors, setSelectedSectors] = useState(['IT', 'Banking'])
  const [investmentMin, setInvestmentMin] = useState(10000)
  const [investmentMax, setInvestmentMax] = useState(100000)
  const [notifications, setNotifications] = useState(defaultSettings(user).notifications)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const defaults = defaultSettings(user)

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        setProfile(defaults.profile)
        setRiskTolerance(defaults.riskTolerance)
        setSelectedSectors(defaults.selectedSectors)
        setInvestmentMin(defaults.investmentMin)
        setInvestmentMax(defaults.investmentMax)
        setNotifications(defaults.notifications)
        return
      }

      const parsed = JSON.parse(raw)
      setProfile({ ...defaults.profile, ...(parsed.profile || {}) })
      setRiskTolerance(toNumber(parsed.riskTolerance, defaults.riskTolerance))
      setSelectedSectors(Array.isArray(parsed.selectedSectors) && parsed.selectedSectors.length > 0 ? parsed.selectedSectors : defaults.selectedSectors)
      setInvestmentMin(toNumber(parsed.investmentMin, defaults.investmentMin))
      setInvestmentMax(toNumber(parsed.investmentMax, defaults.investmentMax))
      setNotifications({ ...defaults.notifications, ...(parsed.notifications || {}) })
    } catch {
      setProfile(defaults.profile)
      setRiskTolerance(defaults.riskTolerance)
      setSelectedSectors(defaults.selectedSectors)
      setInvestmentMin(defaults.investmentMin)
      setInvestmentMax(defaults.investmentMax)
      setNotifications(defaults.notifications)
    }
  }, [storageKey, user])

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

      <div className="settings-actions">
        {error && <p className="save-error">{error}</p>}
        {saved && <p className="save-success">Settings saved successfully.</p>}
        <button className="save-settings-btn" onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  )
}
