import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts'

const COLORS = ['#c9a84c', '#10b981', '#2563eb', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']

const riskData = [
  { name: 'Low Risk',    value: 35, color: '#10b981' },
  { name: 'Medium Risk', value: 45, color: '#f59e0b' },
  { name: 'High Risk',   value: 20, color: '#ef4444' },
]

export default function Analytics({ portfolio }) {
  const [activeTab, setActiveTab] = useState('overview')

  // Build sector data from portfolio
  const sectorData = portfolio?.holdings ? 
    Object.entries(
      portfolio.holdings.reduce((acc, h) => {
        acc[h.sector] = (acc[h.sector] || 0) + h.currentValue
        return acc
      }, {})
    ).map(([name, value]) => ({ name, value: Math.round(value) }))
    : [
      { name: 'IT',           value: 35000 },
      { name: 'Banking',      value: 28000 },
      { name: 'Healthcare',   value: 18000 },
      { name: 'Automobile',   value: 15000 },
      { name: 'Oil & Gas',    value: 12000 },
      { name: 'Consumer',     value: 10000 },
    ]

  const returnData = portfolio?.holdings ?
    portfolio.holdings.map(h => ({
      name: h.company.length > 10 ? h.company.substring(0, 10) + '...' : h.company,
      return: parseFloat(h.returnPercentage)
    }))
    : [
      { name: 'TCS',       return: 18.3 },
      { name: 'HDFC Bank', return: 9.1  },
      { name: 'Infosys',   return: 14.2 },
      { name: 'Wipro',     return: 8.4  },
      { name: 'ICICI',     return: 22.1 },
    ]

  const lineData = [
    { month: 'Oct', value: 95000  },
    { month: 'Nov', value: 102000 },
    { month: 'Dec', value: 98000  },
    { month: 'Jan', value: 108000 },
    { month: 'Feb', value: 115000 },
    { month: 'Mar', value: 124500 },
  ]

  const totalValue = portfolio?.totalValue || 124500
  const avgReturn  = portfolio?.avgReturn  || 25
  const totalHoldings = portfolio?.holdings?.length || 5

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">📊 Portfolio Analytics</h2>
          <p className="analytics-sub">Deep insights into your investment performance</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="analytics-stats">
        {[
          { emoji: '💰', label: 'Total Value',    value: `₹${totalValue.toLocaleString()}`,  change: '↑ 12.4%',      positive: true  },
          { emoji: '📈', label: 'Avg Return',     value: `${avgReturn}%`,                    change: 'Above Market', positive: true  },
          { emoji: '📂', label: 'Holdings',       value: totalHoldings,                      change: 'Diversified',  positive: true  },
          { emoji: '⚠️', label: 'Risk Level',     value: 'Medium',                           change: 'Balanced',     positive: true  },
        ].map((s, i) => (
          <div key={i} className="analytics-stat-card">
            <span className="stat-emoji">{s.emoji}</span>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value">{s.value}</p>
            <p className={`stat-change ${s.positive ? 'positive' : 'warning'}`}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        {[
          { key: 'overview',  label: '🗺️ Overview'        },
          { key: 'returns',   label: '📈 Returns'          },
          { key: 'risk',      label: '⚠️ Risk Breakdown'   },
          { key: 'insights',  label: '💡 AI Insights'      },
        ].map(t => (
          <button
            key={t.key}
            className={`analytics-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">🥧 Sector Allocation</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%" cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sectorData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`₹${v.toLocaleString()}`, 'Value']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">📉 Portfolio Value Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
                <XAxis dataKey="month" stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} />
                <YAxis stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => [`₹${v.toLocaleString()}`, 'Portfolio Value']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
                <Line type="monotone" dataKey="value" stroke="#c9a84c" strokeWidth={2.5} dot={{ fill: '#c9a84c', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Returns Tab */}
      {activeTab === 'returns' && (
        <div className="chart-card full-width">
          <h3 className="chart-title">📊 Returns by Holding</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={returnData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
              <XAxis dataKey="name" stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} />
              <YAxis stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Return']}
                contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
              />
              <Bar dataKey="return" radius={[6, 6, 0, 0]}>
                {returnData.map((entry, i) => (
                  <Cell key={i} fill={entry.return >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === 'risk' && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">⚠️ Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {riskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Allocation']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">🎯 Risk Score Breakdown</h3>
            <div className="risk-meters">
              {[
                { label: 'Volatility',    score: 42, color: '#f59e0b' },
                { label: 'Diversification', score: 78, color: '#10b981' },
                { label: 'Liquidity',     score: 65, color: '#2563eb' },
                { label: 'Market Risk',   score: 35, color: '#ef4444' },
              ].map((r, i) => (
                <div key={i} className="risk-meter">
                  <div className="risk-meter-top">
                    <span className="risk-meter-label">{r.label}</span>
                    <span className="risk-meter-score" style={{ color: r.color }}>{r.score}/100</span>
                  </div>
                  <div className="risk-bar-bg">
                    <div className="risk-bar-fill" style={{ width: `${r.score}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="insights-grid">
          {[
            {
              emoji: '🚀',
              title: 'Growth Opportunity',
              insight: 'Your IT sector allocation is performing above market average. Consider increasing exposure to TCS and Infosys for stronger returns.',
              type: 'positive'
            },
            {
              emoji: '⚠️',
              title: 'Risk Alert',
              insight: 'High concentration in Banking sector (28%). Consider diversifying into Healthcare or Consumer Goods to balance risk.',
              type: 'warning'
            },
            {
              emoji: '💡',
              title: 'Rebalancing Suggestion',
              insight: 'Your portfolio has grown 12.4% this quarter. Consider taking partial profits from high-return positions and reinvesting in undervalued sectors.',
              type: 'info'
            },
            {
              emoji: '📉',
              title: 'Market Trend',
              insight: 'Nifty 50 IT sector is showing bullish momentum. Your current holdings are well-positioned for the upcoming earnings season.',
              type: 'positive'
            },
          ].map((insight, i) => (
            <div key={i} className={`insight-card ${insight.type}`}>
              <div className="insight-emoji">{insight.emoji}</div>
              <div>
                <h4 className="insight-title">{insight.title}</h4>
                <p className="insight-text">{insight.insight}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}