import { useEffect, useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'

const COLORS = ['#c9a84c', '#10b981', '#2563eb', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']
const RISK_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
}

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getRiskBand = (returnPct) => {
  const absReturn = Math.abs(returnPct)
  if (absReturn <= 8) return 'low'
  if (absReturn <= 20) return 'medium'
  return 'high'
}

const buildTrendData = (totalValue, avgReturn) => {
  const labels = ['6m ago', '5m ago', '4m ago', '3m ago', '2m ago', 'Now']
  if (!totalValue) {
    return labels.map((label) => ({ label, value: 0 }))
  }

  const monthlyGrowth = avgReturn / 12 / 100
  const safeGrowth = Number.isFinite(monthlyGrowth) ? monthlyGrowth : 0

  let base = totalValue
  for (let i = 0; i < 5; i += 1) {
    base /= 1 + safeGrowth
  }

  const series = []
  let value = base
  for (let i = 0; i < labels.length; i += 1) {
    series.push({
      label: labels[i],
      value: Math.max(0, Number(value.toFixed(2))),
    })
    value *= 1 + safeGrowth
  }

  series[series.length - 1].value = totalValue
  return series
}

const getStdDev = (numbers) => {
  if (!numbers.length) return 0
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length
  return Math.sqrt(variance)
}

export default function Analytics({ portfolio }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const holdings = useMemo(() => {
    if (!Array.isArray(portfolio?.holdings)) return []

    return portfolio.holdings.map((holding) => {
      const entryPrice = toNumber(holding.entryPrice)
      const currentValue = toNumber(holding.currentValue)
      const returnPercentage = Number.isFinite(holding.returnPercentage)
        ? toNumber(holding.returnPercentage)
        : entryPrice > 0
          ? Number((((currentValue - entryPrice) / entryPrice) * 100).toFixed(2))
          : 0

      return {
        ...holding,
        entryPrice,
        currentValue,
        returnPercentage,
        sector: holding.sector || 'Uncategorized',
        company: holding.company || 'Unknown Asset',
      }
    })
  }, [portfolio])

  const totalValue = useMemo(
    () => (toNumber(portfolio?.totalValue) > 0
      ? toNumber(portfolio.totalValue)
      : holdings.reduce((sum, holding) => sum + holding.currentValue, 0)),
    [portfolio?.totalValue, holdings]
  )

  const investedValue = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.entryPrice, 0),
    [holdings]
  )

  const pnlValue = totalValue - investedValue

  const avgReturn = useMemo(() => {
    const apiAvg = toNumber(portfolio?.avgReturn)
    if (apiAvg) return apiAvg
    if (!holdings.length) return 0
    const sum = holdings.reduce((acc, holding) => acc + holding.returnPercentage, 0)
    return Number((sum / holdings.length).toFixed(2))
  }, [portfolio?.avgReturn, holdings])

  const sectorData = useMemo(() => {
    if (!holdings.length) return []

    const grouped = holdings.reduce((acc, holding) => {
      acc[holding.sector] = (acc[holding.sector] || 0) + holding.currentValue
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [holdings])

  const returnData = useMemo(() => {
    if (!holdings.length) return []

    return holdings
      .map((holding) => ({
        name: holding.company.length > 12 ? `${holding.company.slice(0, 12)}...` : holding.company,
        return: holding.returnPercentage,
      }))
      .sort((a, b) => b.return - a.return)
  }, [holdings])

  const riskData = useMemo(() => {
    if (!holdings.length) {
      return [
        { name: 'Low Risk', value: 0, color: RISK_COLORS.low },
        { name: 'Medium Risk', value: 0, color: RISK_COLORS.medium },
        { name: 'High Risk', value: 0, color: RISK_COLORS.high },
      ]
    }

    const counts = holdings.reduce(
      (acc, holding) => {
        const band = getRiskBand(holding.returnPercentage)
        acc[band] += 1
        return acc
      },
      { low: 0, medium: 0, high: 0 }
    )

    const total = holdings.length
    return [
      { name: 'Low Risk', value: Number(((counts.low / total) * 100).toFixed(1)), color: RISK_COLORS.low },
      { name: 'Medium Risk', value: Number(((counts.medium / total) * 100).toFixed(1)), color: RISK_COLORS.medium },
      { name: 'High Risk', value: Number(((counts.high / total) * 100).toFixed(1)), color: RISK_COLORS.high },
    ]
  }, [holdings])

  const trendData = useMemo(() => buildTrendData(totalValue, avgReturn), [totalValue, avgReturn])

  const riskScores = useMemo(() => {
    const returns = holdings.map((holding) => holding.returnPercentage)
    const stdDev = getStdDev(returns)
    const uniqueSectors = new Set(holdings.map((holding) => holding.sector)).size
    const totalHoldings = holdings.length || 1
    const liquidCount = holdings.filter((holding) => holding.currentValue >= 5000).length
    const highRiskPct = riskData.find((item) => item.name === 'High Risk')?.value || 0
    const mediumRiskPct = riskData.find((item) => item.name === 'Medium Risk')?.value || 0

    return [
      {
        label: 'Volatility',
        score: clamp(Math.round(stdDev * 3), 0, 100),
        color: '#f59e0b',
      },
      {
        label: 'Diversification',
        score: clamp(Math.round((uniqueSectors / totalHoldings) * 160), 10, 100),
        color: '#10b981',
      },
      {
        label: 'Liquidity',
        score: clamp(Math.round((liquidCount / totalHoldings) * 100), 0, 100),
        color: '#2563eb',
      },
      {
        label: 'Market Risk',
        score: clamp(Math.round(highRiskPct + mediumRiskPct * 0.55), 0, 100),
        color: '#ef4444',
      },
    ]
  }, [holdings, riskData])

  const insights = useMemo(() => {
    if (!holdings.length) {
      return [
        {
          title: 'Add portfolio data',
          insight: 'Add or upload holdings to unlock live analytics and personalized insights.',
          type: 'info',
        },
      ]
    }

    const best = [...holdings].sort((a, b) => b.returnPercentage - a.returnPercentage)[0]
    const worst = [...holdings].sort((a, b) => a.returnPercentage - b.returnPercentage)[0]
    const largestSector = [...sectorData].sort((a, b) => b.value - a.value)[0]
    const sectorShare = totalValue > 0
      ? Number(((largestSector.value / totalValue) * 100).toFixed(1))
      : 0

    return [
      {
        title: 'Top performer',
        insight: `${best.company} is currently the strongest position with a ${best.returnPercentage.toFixed(2)}% return.`,
        type: 'positive',
      },
      {
        title: 'Watchlist signal',
        insight: `${worst.company} is your weakest holding at ${worst.returnPercentage.toFixed(2)}%. Review if this still matches your strategy.`,
        type: worst.returnPercentage < 0 ? 'warning' : 'info',
      },
      {
        title: 'Sector concentration',
        insight: `${largestSector.name} accounts for ${sectorShare}% of portfolio value. ${sectorShare > 45 ? 'Consider diversification to reduce concentration risk.' : 'Allocation looks balanced for now.'}`,
        type: sectorShare > 45 ? 'warning' : 'positive',
      },
      {
        title: 'Portfolio momentum',
        insight: `Average return is ${avgReturn.toFixed(2)}% with ${holdings.length} active holdings and total value INR ${Math.round(totalValue).toLocaleString('en-IN')}.`,
        type: avgReturn >= 0 ? 'positive' : 'warning',
      },
    ]
  }, [holdings, sectorData, totalValue, avgReturn])

  const totalHoldings = holdings.length
  const riskLevel = riskData.reduce((top, item) => (item.value > top.value ? item : top), riskData[0] || { name: 'N/A' }).name

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Portfolio Analytics</h2>
          <p className="analytics-sub">
            Live metrics from your latest portfolio input. Updated {now.toLocaleTimeString('en-IN')}
          </p>
        </div>
      </div>

      <div className="analytics-stats">
        {[
          {
            label: 'Total Value',
            value: `INR ${Math.round(totalValue).toLocaleString('en-IN')}`,
            change: pnlValue >= 0
              ? `+INR ${Math.round(pnlValue).toLocaleString('en-IN')} unrealized`
              : `-INR ${Math.round(Math.abs(pnlValue)).toLocaleString('en-IN')} unrealized`,
            positive: pnlValue >= 0,
          },
          {
            label: 'Average Return',
            value: `${avgReturn.toFixed(2)}%`,
            change: avgReturn >= 0 ? 'Positive momentum' : 'Negative momentum',
            positive: avgReturn >= 0,
          },
          {
            label: 'Holdings',
            value: totalHoldings,
            change: `${new Set(holdings.map((holding) => holding.sector)).size} sectors tracked`,
            positive: true,
          },
          {
            label: 'Risk Profile',
            value: riskLevel,
            change: 'Auto-scored from holding volatility',
            positive: riskLevel === 'Low Risk',
          },
        ].map((stat) => (
          <div key={stat.label} className="analytics-stat-card">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
            <p className={`stat-change ${stat.positive ? 'positive' : 'warning'}`}>{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="analytics-tabs">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'returns', label: 'Returns' },
          { key: 'risk', label: 'Risk' },
          { key: 'insights', label: 'Insights' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`analytics-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Sector Allocation</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sectorData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`INR ${Number(value).toLocaleString('en-IN')}`, 'Value']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Portfolio Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
                <XAxis dataKey="label" stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} />
                <YAxis stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 11 }} tickFormatter={(value) => `INR ${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => [`INR ${Number(value).toLocaleString('en-IN')}`, 'Portfolio Value']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
                <Line type="monotone" dataKey="value" stroke="#c9a84c" strokeWidth={2.5} dot={{ fill: '#c9a84c', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="chart-card full-width">
          <h3 className="chart-title">Returns by Holding</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={returnData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
              <XAxis dataKey="name" stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} />
              <YAxis stroke="#4a5068" tick={{ fill: '#8a8fa8', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Return']}
                contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
              />
              <Bar dataKey="return" radius={[6, 6, 0, 0]}>
                {returnData.map((entry, index) => (
                  <Cell key={index} fill={entry.return >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Allocation']}
                  contentStyle={{ background: '#0d1428', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, color: '#f0ece0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">Risk Score Breakdown</h3>
            <div className="risk-meters">
              {riskScores.map((score) => (
                <div key={score.label} className="risk-meter">
                  <div className="risk-meter-top">
                    <span className="risk-meter-label">{score.label}</span>
                    <span className="risk-meter-score" style={{ color: score.color }}>{score.score}/100</span>
                  </div>
                  <div className="risk-bar-bg">
                    <div className="risk-bar-fill" style={{ width: `${score.score}%`, background: score.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="insights-grid">
          {insights.map((insight) => (
            <div key={insight.title} className={`insight-card ${insight.type}`}>
              <div className="insight-emoji">AI</div>
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
