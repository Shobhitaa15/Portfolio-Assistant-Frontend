import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl, withAuthHeaders } from './api'

const formatCurrency = (value = 0) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`

const formatDateTime = (value = '') => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const prettifyFeature = (value = '') =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const DAY_FILTERS = [7, 30, 90]

export default function AdminDashboard({ user }) {
  const [days, setDays] = useState(30)
  const [overview, setOverview] = useState(null)
  const [events, setEvents] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadAdminData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    setError('')
    try {
      const headers = withAuthHeaders()
      const [overviewRes, eventsRes, usersRes] = await Promise.all([
        fetch(`${apiUrl('/api/admin/overview')}?days=${days}`, { headers }),
        fetch(`${apiUrl('/api/admin/events')}?days=${days}&limit=80`, { headers }),
        fetch(`${apiUrl('/api/admin/users')}?days=${days}&limit=120`, { headers }),
      ])

      const responses = [overviewRes, eventsRes, usersRes]
      if (responses.some((res) => res.status === 401)) {
        setError('Session expired. Please log in again as admin.')
        setOverview(null)
        setEvents([])
        setUsers([])
        return
      }

      if (responses.some((res) => res.status === 403)) {
        setError('Admin access denied. This view is available only for the configured admin email.')
        setOverview(null)
        setEvents([])
        setUsers([])
        return
      }

      const [overviewData, eventsData, usersData] = await Promise.all(
        responses.map(async (res) => {
          const payload = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(payload?.error || 'Failed to load admin data.')
          }
          return payload
        })
      )

      setOverview(overviewData)
      setEvents(Array.isArray(eventsData?.events) ? eventsData.events : [])
      setUsers(Array.isArray(usersData?.users) ? usersData.users : [])
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to load admin dashboard right now.')
      setOverview(null)
      setEvents([])
      setUsers([])
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [days])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  const maxDailyUsers = useMemo(() => {
    const rows = Array.isArray(overview?.dailyActiveUsers) ? overview.dailyActiveUsers : []
    const max = rows.reduce((acc, row) => Math.max(acc, Number(row.users) || 0), 0)
    return max > 0 ? max : 1
  }, [overview?.dailyActiveUsers])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <p className="shell-briefing-label">ADMIN CONSOLE</p>
          <h2 className="admin-title">Loading Platform Activity...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <p className="shell-briefing-label">ADMIN CONSOLE</p>
        <h2 className="admin-title">Platform Activity Dashboard</h2>
        <p className="admin-sub">
          Monitoring user usage and portfolio behavior for <strong>{user?.email || 'admin'}</strong>.
        </p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-day-filter">
          {DAY_FILTERS.map((value) => (
            <button
              key={value}
              className={`admin-day-chip ${days === value ? 'active' : ''}`}
              onClick={() => setDays(value)}
            >
              Last {value} days
            </button>
          ))}
        </div>
        <button className="admin-refresh-btn" onClick={() => loadAdminData({ silent: true })} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {!error && (
        <>
          <div className="admin-metrics-grid">
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">TOTAL EVENTS</p>
              <h3>{overview?.summary?.totalEvents || 0}</h3>
            </div>
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">ACTIVE USERS</p>
              <h3>{overview?.summary?.uniqueUsers || 0}</h3>
            </div>
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">LOGINS / SIGNUPS</p>
              <h3>{overview?.summary?.logins || 0} / {overview?.summary?.signups || 0}</h3>
            </div>
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">CHATS / SAVES</p>
              <h3>{overview?.summary?.chatMessages || 0} / {overview?.summary?.portfolioSaves || 0}</h3>
            </div>
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">AUTH 401</p>
              <h3>{overview?.summary?.unauthorized || 0}</h3>
            </div>
            <div className="shell-card admin-metric-card">
              <p className="shell-card-label">API 5XX</p>
              <h3>{overview?.summary?.apiErrors || 0}</h3>
            </div>
          </div>

          <div className="admin-panel-grid">
            <div className="shell-card admin-chart-card">
              <div className="shell-card-header-row">
                <p className="shell-card-label">DAILY ACTIVE USERS</p>
                <span className="admin-panel-sub">{days}d window</span>
              </div>
              <div className="admin-dau-bars">
                {(overview?.dailyActiveUsers || []).length === 0 && (
                  <p className="admin-empty">No activity yet in this range.</p>
                )}
                {(overview?.dailyActiveUsers || []).map((row) => (
                  <div key={row.date} className="admin-dau-row">
                    <span>{row.date.slice(5)}</span>
                    <div className="admin-dau-track">
                      <div
                        className="admin-dau-fill"
                        style={{ width: `${Math.max(6, ((Number(row.users) || 0) / maxDailyUsers) * 100)}%` }}
                      />
                    </div>
                    <strong>{row.users}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="shell-card admin-chart-card">
              <div className="shell-card-header-row">
                <p className="shell-card-label">FEATURE USAGE</p>
                <span className="admin-panel-sub">Top actions</span>
              </div>
              <div className="admin-feature-list">
                {(overview?.featureUsage || []).length === 0 && (
                  <p className="admin-empty">No feature events yet.</p>
                )}
                {(overview?.featureUsage || []).map((item) => (
                  <div key={item.feature} className="admin-feature-row">
                    <span>{prettifyFeature(item.feature)}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shell-card admin-table-card">
            <div className="shell-card-header-row">
              <p className="shell-card-label">USER ACTIVITY</p>
              <span className="admin-panel-sub">{users.length} users</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Logins</th>
                    <th>Chats</th>
                    <th>Portfolio Saves</th>
                    <th>Holdings</th>
                    <th>Portfolio Value</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="8" className="admin-empty-cell">No user activity found.</td>
                    </tr>
                  )}
                  {users.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="admin-user-cell">
                          <strong>{row.name}</strong>
                          <span>{row.email}</span>
                        </div>
                      </td>
                      <td>{row.isAdmin ? 'Admin' : 'User'}</td>
                      <td>{row.logins}</td>
                      <td>{row.chatMessages}</td>
                      <td>{row.portfolioSaves}</td>
                      <td>{row.portfolioHoldings}</td>
                      <td>{formatCurrency(row.portfolioValue)}</td>
                      <td>{formatDateTime(row.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="shell-card admin-table-card">
            <div className="shell-card-header-row">
              <p className="shell-card-label">RECENT EVENTS</p>
              <span className="admin-panel-sub">{events.length} events</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 && (
                    <tr>
                      <td colSpan="5" className="admin-empty-cell">No events recorded.</td>
                    </tr>
                  )}
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>{prettifyFeature(event.type)}</td>
                      <td>{event.userEmail || event.userId || 'Anonymous'}</td>
                      <td>{event.statusCode || '—'}</td>
                      <td>{event.method} {event.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

