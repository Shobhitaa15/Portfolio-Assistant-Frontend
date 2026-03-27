import { useEffect, useMemo, useState } from 'react'

const defaultVault = (user) => ({
  emergencyBufferPercent: 12,
  maxSingleExposure: 28,
  stopLossPercent: 8,
  autoReserve: true,
  lockWithdrawals: true,
  withdrawalWindow: '09:00-18:00',
  rebalanceAlerts: true,
  trustedDeviceLabel: 'Primary device',
  recoveryEmail: user?.email || '',
  notes: '',
})

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function Vault({ user, userId = 'demo', onSave }) {
  const storageKey = useMemo(() => `profitly_vault_${userId}`, [userId])

  const [vault, setVault] = useState(defaultVault(user))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const defaults = defaultVault(user)

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        setVault(defaults)
        return
      }

      const parsed = JSON.parse(raw)
      setVault({ ...defaults, ...(parsed || {}) })
    } catch {
      setVault(defaults)
    }
  }, [storageKey, user])

  const updateVault = (field, value) => {
    setVault((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    setError('')

    if (toNumber(vault.stopLossPercent) <= 0 || toNumber(vault.maxSingleExposure) <= 0) {
      setError('Risk guardrails must be greater than zero.')
      return
    }

    const payload = {
      ...vault,
      emergencyBufferPercent: toNumber(vault.emergencyBufferPercent, 12),
      maxSingleExposure: toNumber(vault.maxSingleExposure, 28),
      stopLossPercent: toNumber(vault.stopLossPercent, 8),
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem(storageKey, JSON.stringify(payload))
    if (onSave) onSave(payload)

    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="settings-title">Vault Controls</h2>
        <p className="settings-sub">Secure your portfolio with editable guardrails and access controls.</p>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Protection Guardrails</h3>
        <p className="settings-card-sub">These controls define how defensive your vault strategy is.</p>

        <div className="settings-grid two-col">
          <div className="settings-field">
            <label>Emergency Buffer (%)</label>
            <input
              className="range-field"
              type="number"
              value={vault.emergencyBufferPercent}
              onChange={(event) => updateVault('emergencyBufferPercent', event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label>Max Single Stock Exposure (%)</label>
            <input
              className="range-field"
              type="number"
              value={vault.maxSingleExposure}
              onChange={(event) => updateVault('maxSingleExposure', event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label>Stop-Loss Limit (%)</label>
            <input
              className="range-field"
              type="number"
              value={vault.stopLossPercent}
              onChange={(event) => updateVault('stopLossPercent', event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Automation</h3>
        <p className="settings-card-sub">Enable or disable vault automation behavior.</p>

        <div className="notifications-list">
          {[
            { key: 'autoReserve', label: 'Auto Reserve Buffer', desc: 'Automatically move excess exposure into reserve.' },
            { key: 'lockWithdrawals', label: 'Withdrawal Lock', desc: 'Require safe window for withdrawals.' },
            { key: 'rebalanceAlerts', label: 'Rebalance Alerts', desc: 'Notify when guardrails are breached.' },
          ].map((item) => (
            <div key={item.key} className="notification-item">
              <div>
                <p className="notification-label">{item.label}</p>
                <p className="notification-desc">{item.desc}</p>
              </div>

              <button
                className={`toggle-btn ${vault[item.key] ? 'on' : 'off'}`}
                onClick={() => updateVault(item.key, !vault[item.key])}
              >
                {vault[item.key] ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">Access & Recovery</h3>
        <p className="settings-card-sub">Configure trust boundaries for account recovery and device access.</p>

        <div className="settings-grid two-col">
          <div className="settings-field">
            <label>Withdrawal Window</label>
            <input
              className="range-field"
              value={vault.withdrawalWindow}
              onChange={(event) => updateVault('withdrawalWindow', event.target.value)}
              placeholder="09:00-18:00"
            />
          </div>

          <div className="settings-field">
            <label>Trusted Device</label>
            <input
              className="range-field"
              value={vault.trustedDeviceLabel}
              onChange={(event) => updateVault('trustedDeviceLabel', event.target.value)}
            />
          </div>

          <div className="settings-field">
            <label>Recovery Email</label>
            <input
              className="range-field"
              type="email"
              value={vault.recoveryEmail}
              onChange={(event) => updateVault('recoveryEmail', event.target.value)}
            />
          </div>

          <div className="settings-field full-width">
            <label>Vault Notes</label>
            <textarea
              className="range-field vault-notes"
              value={vault.notes}
              onChange={(event) => updateVault('notes', event.target.value)}
              placeholder="Optional instructions for your vault strategy"
            />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        {error && <p className="save-error">{error}</p>}
        {saved && <p className="save-success">Vault settings saved successfully.</p>}
        <button className="save-settings-btn" onClick={handleSave}>Save Vault Settings</button>
      </div>
    </div>
  )
}
