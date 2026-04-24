import { useState, useEffect, useCallback } from 'react'
import './index.css'
import Portfolio from './Portfolio'
import { apiUrl, withAuthHeaders } from './api'
import Analytics from './Analytics'
import Settings from './Settings'
import Vault from './Vault'

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const summarizePortfolio = (holdings = []) => {
  const normalizedHoldings = holdings.map((holding) => {
    const entryPrice = toNumber(holding.entryPrice)
    const currentValue = toNumber(holding.currentValue)
    const returnPercentage = entryPrice > 0
      ? Number((((currentValue - entryPrice) / entryPrice) * 100).toFixed(2))
      : 0

    return {
      ...holding,
      entryPrice,
      currentValue,
      returnPercentage,
    }
  })

  const totalValue = normalizedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0)
  const avgReturn = normalizedHoldings.length > 0
    ? Number((normalizedHoldings.reduce((sum, holding) => sum + holding.returnPercentage, 0) / normalizedHoldings.length).toFixed(2))
    : 0

  return {
    holdings: normalizedHoldings,
    totalValue,
    avgReturn,
    updatedAt: new Date().toISOString(),
  }
}

const CHAT_STORAGE_LIMIT = 120
const HISTORY_STORAGE_LIMIT = 120
const RECENT_SEARCH_LIMIT = 12
const PRICE_ALERT_LIMIT = 40

const formatHistoryDate = (value = new Date()) => new Date(value).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const normalizeHistoryStatus = (status) => (String(status || '').toUpperCase() === 'SETTLED' ? 'SETTLED' : 'PENDING')
const formatCurrency = (value = 0) => `₹${Math.round(toNumber(value)).toLocaleString('en-IN')}`
const normalizeHoldingKey = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
const normalizeAlertCondition = (condition) => (String(condition || '').toLowerCase() === 'below' ? 'below' : 'above')
const getHoldingKey = (holding = {}, fallback = '') => {
  const provided = String(holding.holdingKey || '').trim()
  if (provided) return normalizeHoldingKey(provided)
  const primary = String(holding.company || holding.ticker || holding.assetName || fallback || 'holding').trim()
  const sector = String(holding.sector || '').trim()
  return normalizeHoldingKey(`${primary}-${sector}`.replace(/-+$/, ''))
}

const normalizeRecentSearches = (entries = []) => {
  if (!Array.isArray(entries)) return []
  const unique = []
  entries.forEach((entry) => {
    const clean = String(entry || '').trim()
    if (!clean) return
    if (unique.some((value) => value.toLowerCase() === clean.toLowerCase())) return
    unique.push(clean)
  })
  return unique.slice(0, RECENT_SEARCH_LIMIT)
}

const normalizePriceAlerts = (rows = []) => {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(Boolean)
    .map((row, index) => {
      const stock = String(row.stock || row.ticker || row.company || '').trim()
      const targetPrice = toNumber(row.targetPrice || row.price)
      if (!stock || targetPrice <= 0) return null

      const condition = normalizeAlertCondition(row.condition)
      const normalizedStock = stock.toUpperCase()

      return {
        id: row.id || `alert-${normalizeHoldingKey(normalizedStock || `stock-${index + 1}`)}-${index}`,
        stock: normalizedStock,
        condition,
        targetPrice: Number(targetPrice.toFixed(2)),
        active: row.active !== false,
        createdAt: row.createdAt || new Date().toISOString(),
      }
    })
    .filter(Boolean)
    .slice(0, PRICE_ALERT_LIMIT)
}

const getHoldingSignal = (holding = {}) => {
  const company = String(holding.company || holding.ticker || 'Holding').trim()
  const returnPct = toNumber(holding.returnPercentage)
  const fitScore = toNumber(holding?.fitScore?.score)

  if (returnPct <= -10 || (fitScore > 0 && fitScore < 45)) {
    return {
      company,
      action: 'SELL / REVIEW',
      reason: returnPct <= -10
        ? `Down ${returnPct.toFixed(2)}%, check if thesis is still valid.`
        : `Fit score ${fitScore.toFixed(0)}/100 is weak for this portfolio.`,
      tone: 'negative',
      priority: 4,
    }
  }

  if (returnPct >= 18) {
    return {
      company,
      action: 'BOOK PARTIAL',
      reason: `Gain at ${returnPct.toFixed(2)}%, consider taking partial profits.`,
      tone: 'positive',
      priority: 3,
    }
  }

  if (fitScore >= 75 && returnPct <= 12) {
    return {
      company,
      action: 'BUY / ADD',
      reason: `Fit score ${fitScore.toFixed(0)}/100 supports accumulation.`,
      tone: 'positive',
      priority: 3,
    }
  }

  if (returnPct <= -4 && fitScore >= 60) {
    return {
      company,
      action: 'WATCH DIP',
      reason: `Mild drawdown (${returnPct.toFixed(2)}%) with decent fit score.`,
      tone: 'neutral',
      priority: 2,
    }
  }

  return {
    company,
    action: 'HOLD',
    reason: 'No urgent action required right now.',
    tone: 'neutral',
    priority: 1,
  }
}

const normalizeActivityHistory = (rows = []) => {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(Boolean)
    .map((row, index) => {
      const status = normalizeHistoryStatus(row.status)
      const rawImpact = String(row.impact || '')
      const impactNumber = rawImpact
        ? Number.parseFloat(rawImpact.replace(/[^0-9.-]/g, ''))
        : 0
      const safeImpactNumber = Number.isFinite(impactNumber) ? impactNumber : 0
      const investedAmount = toNumber(row.investedAmount || row.entryPrice || safeImpactNumber)
      const currentAmount = toNumber(row.currentAmount || row.currentValue)
      const positive = typeof row.positive === 'boolean' ? row.positive : true
      const assetName = String(
        row.assetName
          || row.company
          || row.ticker
          || row.name
          || `Holding ${index + 1}`
      ).trim()
      const holdingKey = getHoldingKey(row, `holding-${index + 1}`)
      const idBase = String(holdingKey || `history-${index}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase()

      return {
        id: row.id || `activity-${idBase}-${index}`,
        icon: row.icon || (positive ? '📈' : '📉'),
        name: row.name || `${assetName} Activity`,
        sub: row.sub || `${assetName} · Portfolio`,
        status,
        date: row.date || formatHistoryDate(),
        impact: rawImpact || formatCurrency(investedAmount),
        growth: row.growth || (currentAmount > 0 ? `Current ${formatCurrency(currentAmount)}` : (status === 'SETTLED' ? 'SETTLED' : 'AWAITING SETTLEMENT')),
        positive,
        assetName,
        holdingKey,
        investedAmount,
        currentAmount,
      }
    })
    .slice(0, HISTORY_STORAGE_LIMIT)
}

const buildHistoryFromHoldings = (holdings = [], existingHistory = []) => {
  if (!Array.isArray(holdings) || holdings.length === 0) return []
  const existingRows = normalizeActivityHistory(existingHistory)
  const existingMap = new Map(existingRows.map((row, index) => [getHoldingKey(row, `existing-${index}`), row]))

  return holdings
    .filter(Boolean)
    .slice(0, HISTORY_STORAGE_LIMIT)
    .map((holding, index) => {
      const company = String(holding.company || holding.ticker || `Holding ${index + 1}`).trim()
      const sector = String(holding.sector || 'Uncategorized').trim()
      const entryPrice = toNumber(holding.entryPrice)
      const currentValue = toNumber(holding.currentValue)
      const investedAmount = entryPrice > 0 ? entryPrice : toNumber(holding.minInvestment)
      const currentAmount = currentValue > 0 ? currentValue : toNumber(holding.valuation)
      const hasValidReturn = Number.isFinite(Number.parseFloat(holding.returnPercentage))
      const returnPercentage = hasValidReturn
        ? toNumber(holding.returnPercentage)
        : entryPrice > 0
          ? Number((((currentValue - entryPrice) / entryPrice) * 100).toFixed(2))
          : 0
      const holdingKey = getHoldingKey(holding, `holding-${index + 1}`)
      const existing = existingMap.get(holdingKey)
      const status = normalizeHistoryStatus(existing?.status || 'PENDING')
      const idBase = String(holdingKey || company).replace(/[^a-z0-9]+/gi, '-').toLowerCase()

      return {
        id: existing?.id || `holding-${idBase}-${index}`,
        icon: returnPercentage >= 0 ? '📈' : '📉',
        name: `${company} Holding`,
        sub: `${company} · ${sector}`,
        status,
        date: existing?.date || formatHistoryDate(new Date(Date.now() - (index * 24 * 60 * 60 * 1000))),
        impact: formatCurrency(investedAmount),
        growth: `Current ${formatCurrency(currentAmount)} · ${returnPercentage >= 0 ? '+' : ''}${returnPercentage.toFixed(2)}%`,
        positive: true,
        assetName: company,
        holdingKey,
        investedAmount,
        currentAmount,
      }
    })
}

const downloadBlob = (blob, fileName) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const escapePdfText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/[^\x20-\x7E]/g, '')

const buildSimplePdfBlob = (lines = []) => {
  const normalizedLines = lines
    .map((line) => escapePdfText(line))
    .filter(Boolean)
    .slice(0, 46)

  let y = 760
  const contentRows = ['BT', '/F1 11 Tf', '14 TL']
  normalizedLines.forEach((line) => {
    contentRows.push(`1 0 0 1 40 ${y} Tm (${line}) Tj`)
    y -= 14
  })
  contentRows.push('ET')
  const stream = contentRows.join('\n')
  const streamLength = new TextEncoder().encode(stream).length

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const encoder = new TextEncoder()
  const offsets = [0]
  objects.forEach((obj, index) => {
    offsets[index + 1] = encoder.encode(pdf).length
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`
  })

  const xrefOffset = encoder.encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

function App({ user, onLogout, onUserUpdate, theme = 'light', onToggleTheme }) {
  const [currentUser, setCurrentUser] = useState(user)
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [activeTopTab, setActiveTopTab] = useState('Overview')
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatReady, setChatReady] = useState(false)
  const [chatEditIndex, setChatEditIndex] = useState(null)
  const [reportDownloadFormat, setReportDownloadFormat] = useState('pdf')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [portfolioData, setPortfolioData] = useState(null)
  const [vaultSettings, setVaultSettings] = useState(null)
  const [userSettings, setUserSettings] = useState(null)
  const [depositForm, setDepositForm] = useState({
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    paymentMethod: 'UPI',
    amount: '',
    transactionRef: '',
    paymentDate: '',
    notes: '',
  })
  const [depositStatus, setDepositStatus] = useState({ type: '', message: '' })
  const [activityHistory, setActivityHistory] = useState([])
  const [activityHistoryReady, setActivityHistoryReady] = useState(false)
  const [recentStockSearches, setRecentStockSearches] = useState([])
  const [recentSearchReady, setRecentSearchReady] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState([])
  const [priceAlertReady, setPriceAlertReady] = useState(false)
  const [priceAlertDraft, setPriceAlertDraft] = useState({ stock: '', condition: 'above', targetPrice: '' })
  const [priceAlertNote, setPriceAlertNote] = useState('')
  const [settingsAlertFocusSignal, setSettingsAlertFocusSignal] = useState(0)

  const [marketRows, setMarketRows] = useState([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [marketSearch, setMarketSearch] = useState('')
  const [marketSector, setMarketSector] = useState('All')
  const [niftyTickerRows, setNiftyTickerRows] = useState([])
  const [niftyTickerStatus, setNiftyTickerStatus] = useState('Loading Nifty 50 ticker...')

  const firstName = currentUser?.name?.split(' ')[0] || 'Investor'

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning,'
    if (hour < 17) return 'Good afternoon,'
    return 'Good evening,'
  }

  useEffect(() => {
    setCurrentUser(user)
  }, [user])

  const loadVaultSettings = useCallback(() => {
    try {
      const key = `profitly_vault_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      setVaultSettings(saved ? JSON.parse(saved) : null)
    } catch {
      setVaultSettings(null)
    }
  }, [currentUser?.id])

  const loadUserSettings = useCallback(() => {
    try {
      const key = `profitly_settings_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      setUserSettings(saved ? JSON.parse(saved) : null)
    } catch {
      setUserSettings(null)
    }
  }, [currentUser?.id])

  const loadDepositDetails = useCallback(() => {
    try {
      const key = `profitly_deposit_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed === 'object') {
        setDepositForm((prev) => ({ ...prev, ...parsed }))
      }
    } catch {
      // keep defaults
    }
  }, [currentUser?.id])

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/portfolio/get'), {
        headers: withAuthHeaders(),
      })
      const data = await res.json()
      setPortfolioData(data.portfolio || null)
    } catch (e) {
      console.log('Portfolio fetch error:', e)
    }
  }, [])

  const trackRecentStockSearches = useCallback((searchTerm, rows = []) => {
    const cleanSearch = String(searchTerm || '').trim()
    if (!cleanSearch) return

    const matchedNames = Array.isArray(rows)
      ? rows
        .map((row) => String(row?.company || row?.ticker || '').trim())
        .filter(Boolean)
        .slice(0, 3)
      : []

    const valuesToAdd = normalizeRecentSearches([...matchedNames, cleanSearch.toUpperCase()])
    if (!valuesToAdd.length) return

    setRecentStockSearches((prev) => normalizeRecentSearches([...valuesToAdd, ...prev]))
  }, [])

  const fetchMarkets = useCallback(async () => {
    setMarketLoading(true)
    setMarketError('')
    try {
      const params = new URLSearchParams({ limit: '60' })
      const cleanSearch = marketSearch.trim()
      if (cleanSearch) params.set('search', cleanSearch)
      if (marketSector !== 'All') params.set('sector', marketSector)

      const res = await fetch(`${apiUrl('/api/chat/markets')}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to load market fields')

      const nextMarkets = Array.isArray(data.markets) ? data.markets : []
      setMarketRows(nextMarkets)
      trackRecentStockSearches(cleanSearch, nextMarkets)
    } catch (e) {
      console.log('Markets fetch error:', e)
      setMarketError('Unable to load market fields right now.')
    }
    setMarketLoading(false)
  }, [marketSearch, marketSector, trackRecentStockSearches])

  const fetchNiftyTicker = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '20' })
      const response = await fetch(`${apiUrl('/api/chat/markets')}?${params.toString()}`)
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to load ticker')

      const rows = Array.isArray(data.markets) ? data.markets : []
      setNiftyTickerRows(rows)
      setNiftyTickerStatus(rows.length > 0 ? '' : 'No Nifty 50 ticker data available right now.')
    } catch (error) {
      console.log('Nifty ticker fetch error:', error)
      setNiftyTickerRows([])
      setNiftyTickerStatus('Unable to load Nifty 50 ticker right now.')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPortfolio()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchPortfolio])

  useEffect(() => {
    fetchNiftyTicker()
    const intervalId = setInterval(fetchNiftyTicker, 60000)
    return () => clearInterval(intervalId)
  }, [fetchNiftyTicker])

  useEffect(() => {
    if (activeNav !== 'Markets') return
    const timer = setTimeout(() => {
      fetchMarkets()
    }, 0)
    return () => clearTimeout(timer)
  }, [activeNav, fetchMarkets])

  useEffect(() => {
    if (activeNav !== 'Analytics') return
    fetchPortfolio()
    const intervalId = setInterval(() => {
      fetchPortfolio()
    }, 12000)
    return () => clearInterval(intervalId)
  }, [activeNav, fetchPortfolio])

  useEffect(() => {
    loadVaultSettings()
  }, [loadVaultSettings])

  useEffect(() => {
    loadUserSettings()
  }, [loadUserSettings])

  useEffect(() => {
    loadDepositDetails()
  }, [loadDepositDetails])

  useEffect(() => {
    setActivityHistoryReady(false)
    try {
      const key = `profitly_activity_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      if (!saved) {
        setActivityHistory([])
      } else {
        const parsed = JSON.parse(saved)
        const normalized = normalizeActivityHistory(parsed)
        setActivityHistory(normalized)
      }
    } catch {
      setActivityHistory([])
    } finally {
      setActivityHistoryReady(true)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!activityHistoryReady) return
    try {
      const key = `profitly_activity_${currentUser?.id || 'demo'}`
      localStorage.setItem(key, JSON.stringify(normalizeActivityHistory(activityHistory)))
    } catch {
      // ignore storage errors
    }
  }, [activityHistory, currentUser?.id, activityHistoryReady])

  useEffect(() => {
    if (!activityHistoryReady) return
    if (!Array.isArray(portfolioData?.holdings)) return
    setActivityHistory((prev) => {
      const syncedRows = buildHistoryFromHoldings(portfolioData.holdings, prev)
      return normalizeActivityHistory(syncedRows)
    })
  }, [portfolioData?.holdings, activityHistoryReady])

  useEffect(() => {
    setRecentSearchReady(false)
    try {
      const key = `profitly_recent_stock_searches_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      if (!saved) {
        setRecentStockSearches([])
      } else {
        const parsed = JSON.parse(saved)
        setRecentStockSearches(normalizeRecentSearches(parsed))
      }
    } catch {
      setRecentStockSearches([])
    } finally {
      setRecentSearchReady(true)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!recentSearchReady) return
    try {
      const key = `profitly_recent_stock_searches_${currentUser?.id || 'demo'}`
      localStorage.setItem(key, JSON.stringify(normalizeRecentSearches(recentStockSearches)))
    } catch {
      // ignore storage errors
    }
  }, [recentStockSearches, currentUser?.id, recentSearchReady])

  useEffect(() => {
    setPriceAlertReady(false)
    setPriceAlertNote('')
    try {
      const key = `profitly_price_alerts_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      if (!saved) {
        setPriceAlerts([])
      } else {
        const parsed = JSON.parse(saved)
        setPriceAlerts(normalizePriceAlerts(parsed))
      }
    } catch {
      setPriceAlerts([])
    } finally {
      setPriceAlertReady(true)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!priceAlertReady) return
    try {
      const key = `profitly_price_alerts_${currentUser?.id || 'demo'}`
      localStorage.setItem(key, JSON.stringify(normalizePriceAlerts(priceAlerts)))
    } catch {
      // ignore storage errors
    }
  }, [priceAlerts, currentUser?.id, priceAlertReady])

  useEffect(() => {
    setChatReady(false)
    setChatEditIndex(null)
    try {
      const key = `profitly_chat_${currentUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      if (!saved) {
        setMessages([])
        setChatReady(true)
        return
      }

      const parsed = JSON.parse(saved)
      const normalized = Array.isArray(parsed)
        ? parsed
          .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
          .map((msg, idx) => ({
            ...msg,
            createdAt: msg.createdAt || new Date(Date.now() - ((parsed.length - idx) * 60 * 1000)).toISOString(),
          }))
        : []
      setMessages(normalized)
    } catch {
      setMessages([])
    } finally {
      setChatReady(true)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!chatReady) return
    try {
      const key = `profitly_chat_${currentUser?.id || 'demo'}`
      const trimmed = messages.slice(-CHAT_STORAGE_LIMIT)
      localStorage.setItem(key, JSON.stringify(trimmed))
    } catch {
      // ignore storage errors
    }
  }, [messages, currentUser?.id, chatReady])

  const sendMessage = async (text) => {
    const messageText = (text || input).trim()
    if (!messageText || loading) return

    const isEditing = Number.isInteger(chatEditIndex)
    const baseConversation = isEditing ? messages.slice(0, chatEditIndex) : messages
    const userMessage = {
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    }
    const nextConversation = [...baseConversation, userMessage]
    const nextSessionHistory = nextConversation.map((msg) => ({ role: msg.role, content: msg.content }))

    setMessages(nextConversation)
    setInput('')
    setChatEditIndex(null)
    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: messageText,
          sessionHistory: nextSessionHistory
        })
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to get AI response')

      setMessages([
        ...nextConversation,
        {
          role: 'assistant',
          content: data.message || 'I could not generate a response right now. Please try again.',
          offerings: Array.isArray(data.offerings) ? data.offerings : [],
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.log('Error:', error)
      setMessages([
        ...nextConversation,
        {
          role: 'assistant',
          content: 'I could not reach Profitly AI right now. Please try again in a moment.',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const startEditingMessage = (index) => {
    const target = messages[index]
    if (!target || target.role !== 'user') return
    setInput(target.content)
    setChatEditIndex(index)
  }

  const cancelMessageEdit = () => {
    setChatEditIndex(null)
    setInput('')
  }

  const clearChatHistory = () => {
    setMessages([])
    setChatEditIndex(null)
    setInput('')
    try {
      const key = `profitly_chat_${currentUser?.id || 'demo'}`
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }

  const setActivitySettlementStatus = (activityId, nextStatus) => {
    const normalizedStatus = normalizeHistoryStatus(nextStatus)
    setActivityHistory((prev) => prev.map((row) => (
      row.id === activityId
        ? {
          ...row,
          status: normalizedStatus,
          growth: `${row.currentAmount > 0 ? `Current ${formatCurrency(row.currentAmount)} · ` : ''}${normalizedStatus === 'SETTLED' ? 'PAYMENT SETTLED' : 'AWAITING SETTLEMENT'}`,
        }
        : row
    )))
  }

  const clearActivityHistory = () => {
    setActivityHistory(buildHistoryFromHoldings(holdings, []))
  }

  const clearRecentStockSearches = () => {
    setRecentStockSearches([])
  }

  const addPriceAlert = () => {
    const stock = String(priceAlertDraft.stock || '').trim().toUpperCase()
    const targetPrice = toNumber(priceAlertDraft.targetPrice)

    if (!stock || targetPrice <= 0) {
      setPriceAlertNote('Enter a stock and valid trigger price.')
      return
    }

    const nextAlert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      stock,
      condition: normalizeAlertCondition(priceAlertDraft.condition),
      targetPrice: Number(targetPrice.toFixed(2)),
      active: true,
      createdAt: new Date().toISOString(),
    }

    setPriceAlerts((prev) => normalizePriceAlerts([nextAlert, ...prev]))
    setPriceAlertDraft({ stock: '', condition: 'above', targetPrice: '' })
    setPriceAlertNote(`Alert created for ${stock}.`)
  }

  const togglePriceAlert = (alertId) => {
    setPriceAlerts((prev) => prev.map((alert) => (
      alert.id === alertId
        ? { ...alert, active: !alert.active }
        : alert
    )))
  }

  const removePriceAlert = (alertId) => {
    setPriceAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const openAlertCenter = () => {
    setShowProfilePanel(false)
    setActiveNav('Settings')
    setSettingsAlertFocusSignal((prev) => prev + 1)
  }

  const saveDepositDetails = () => {
    const amountValue = Number.parseFloat(depositForm.amount)
    if (
      !depositForm.accountHolder.trim()
      || !depositForm.bankName.trim()
      || !depositForm.accountNumber.trim()
      || !depositForm.ifscCode.trim()
      || !depositForm.transactionRef.trim()
      || !depositForm.paymentDate
      || !Number.isFinite(amountValue)
      || amountValue <= 0
    ) {
      setDepositStatus({ type: 'error', message: 'Please fill all required bank and payment fields with a valid amount.' })
      return
    }

    try {
      const key = `profitly_deposit_${currentUser?.id || 'demo'}`
      const payload = {
        ...depositForm,
        amount: amountValue.toFixed(2),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(key, JSON.stringify(payload))
      setDepositForm((prev) => ({ ...prev, amount: amountValue.toFixed(2) }))
      setDepositStatus({ type: 'success', message: 'Deposit details saved successfully.' })
    } catch {
      setDepositStatus({ type: 'error', message: 'Unable to save deposit details right now.' })
    }
  }

  const downloadReport = () => {
    const generatedAt = new Date()
    const stamp = generatedAt.toISOString().slice(0, 10)
    const summaryLines = [
      'Profitly Portfolio Intelligence Report',
      `Generated On: ${generatedAt.toLocaleString('en-IN')}`,
      `User: ${currentUser?.name || 'Investor'} (${currentUser?.email || 'N/A'})`,
      '',
      ...filteredReportCards.flatMap((card) => [
        `${card.title}: ${card.value}`,
        `  ${card.detail}`,
      ]),
      '',
      'Holdings Snapshot:',
      ...filteredHoldings.slice(0, 15).map((holding) => (
        `- ${holding.company} | ${holding.sector} | ${Number(holding.returnPercentage || 0).toFixed(2)}%`
      )),
    ]

    if (reportDownloadFormat === 'pdf') {
      const pdfBlob = buildSimplePdfBlob(summaryLines)
      downloadBlob(pdfBlob, `profitly-report-${stamp}.pdf`)
      return
    }

    const html = `
      <html>
      <head><meta charset="utf-8"><title>Profitly Report</title></head>
      <body>
        <h1>Profitly Portfolio Intelligence Report</h1>
        <p><strong>Generated On:</strong> ${escapeHtml(generatedAt.toLocaleString('en-IN'))}</p>
        <p><strong>User:</strong> ${escapeHtml(currentUser?.name || 'Investor')} (${escapeHtml(currentUser?.email || 'N/A')})</p>
        <h2>Report Cards</h2>
        <ul>
          ${filteredReportCards.map((card) => `<li><strong>${escapeHtml(card.title)}:</strong> ${escapeHtml(card.value)}<br/>${escapeHtml(card.detail)}</li>`).join('')}
        </ul>
        <h2>Holdings Snapshot</h2>
        <ul>
          ${filteredHoldings.slice(0, 15).map((holding) => `<li>${escapeHtml(holding.company)} | ${escapeHtml(holding.sector)} | ${Number(holding.returnPercentage || 0).toFixed(2)}%</li>`).join('')}
        </ul>
      </body>
      </html>
    `

    const wordBlob = new Blob([`\uFEFF${html}`], { type: 'application/msword' })
    downloadBlob(wordBlob, `profitly-report-${stamp}.doc`)
  }

  if (showPortfolio) return (
    <Portfolio
      userId={currentUser?.id || 'demo'}
      theme={theme}
      onToggleTheme={onToggleTheme}
      setPortfolio={(nextPortfolio) => {
        if (Array.isArray(nextPortfolio)) {
          setPortfolioData((prev) => ({ ...(prev || {}), ...summarizePortfolio(nextPortfolio) }))
          return
        }
        if (nextPortfolio && typeof nextPortfolio === 'object') {
          setPortfolioData(nextPortfolio)
        }
      }}
      onBack={() => { setShowPortfolio(false); setActiveNav('Dashboard'); fetchPortfolio() }}
    />
  )

  const handleProfileUpdate = (nextUser) => {
    setCurrentUser(nextUser)
    if (onUserUpdate) onUserUpdate(nextUser)
    try {
      const key = `profitly_settings_${nextUser?.id || 'demo'}`
      const saved = localStorage.getItem(key)
      setUserSettings(saved ? JSON.parse(saved) : null)
    } catch {
      setUserSettings(null)
    }
  }

  const handleVaultSave = (nextVaultSettings) => {
    setVaultSettings(nextVaultSettings)
  }

  const totalValue = portfolioData?.totalValue || 124500
  const avgReturn = portfolioData?.avgReturn || 2.4
  const portfolioFitScore = (() => {
    const overallScore = toNumber(portfolioData?.overallFitScore)
    if (overallScore > 0) return Number(overallScore.toFixed(1))

    const holdingScores = Array.isArray(portfolioData?.holdings)
      ? portfolioData.holdings
        .map((holding) => toNumber(holding?.fitScore?.score))
        .filter((score) => score > 0)
      : []

    if (holdingScores.length > 0) {
      return Number((holdingScores.reduce((sum, score) => sum + score, 0) / holdingScores.length).toFixed(1))
    }

    return 94.2
  })()
  const fitTopPercent = Math.max(1, Math.min(35, Math.round((100 - portfolioFitScore) / 2)))
  const fitScoreRounded = Math.max(0, Math.min(100, Math.round(portfolioFitScore)))
  const fitDelta = 4
  const fitSegmentTotal = 12
  const fitGoldSegments = Math.max(0, Math.min(fitSegmentTotal, Math.round((fitScoreRounded / 100) * 8) + 1))
  const fitDarkSegments = Math.min(2, Math.max(0, fitSegmentTotal - fitGoldSegments))
  const marketSectors = ['All', ...Array.from(new Set([marketSector, ...marketRows.map((row) => row.sector).filter(Boolean)])).filter(Boolean).sort()]
  const vaultProtectionText = vaultSettings
    ? `${vaultSettings.autoReserve ? 'Reserve automation active' : 'Reserve automation inactive'}. Emergency buffer ${vaultSettings.emergencyBufferPercent || 12}% with max exposure ${vaultSettings.maxSingleExposure || 28}%.`
    : 'Configure your emergency buffer and risk guardrails in Vault settings.'
  const vaultLockText = vaultSettings
    ? `${vaultSettings.lockWithdrawals ? 'Withdrawal lock on' : 'Withdrawal lock off'}${vaultSettings.withdrawalWindow ? ` (${vaultSettings.withdrawalWindow})` : ''}.`
    : 'Withdrawal lock status will appear here after setup.'
  const dashboardSearchTerm = searchInput.trim()
  const normalizedDashboardSearch = dashboardSearchTerm.toLowerCase()
  const holdings = Array.isArray(portfolioData?.holdings) ? portfolioData.holdings : []

  const filteredActivity = normalizedDashboardSearch
    ? activityHistory.filter((item) =>
      [item.name, item.sub, item.status, item.date, item.impact, item.growth, item.assetName]
        .some((value) => String(value || '').toLowerCase().includes(normalizedDashboardSearch)))
    : activityHistory

  const filteredRecentStockSearches = normalizedDashboardSearch
    ? recentStockSearches.filter((name) => name.toLowerCase().includes(normalizedDashboardSearch))
    : recentStockSearches

  const filteredHoldings = normalizedDashboardSearch
    ? holdings.filter((holding) =>
      [holding.company, holding.sector, holding.stage, holding.entryPrice, holding.currentValue, holding.minInvestment, holding.valuation]
        .some((value) => String(value || '').toLowerCase().includes(normalizedDashboardSearch)))
    : holdings

  const liveMarketRows = [...marketRows, ...niftyTickerRows]
  const livePriceLookup = liveMarketRows.reduce((lookup, row) => {
    const price = toNumber(row?.latestClose)
    if (price <= 0) return lookup
    const keys = [row?.ticker, row?.company, row?.fullName]
      .map((value) => normalizeHoldingKey(value))
      .filter(Boolean)
    keys.forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, price)
    })
    return lookup
  }, new Map())

  const evaluatedPriceAlerts = normalizePriceAlerts(priceAlerts).map((alert) => {
    const livePrice = livePriceLookup.get(normalizeHoldingKey(alert.stock))
    const triggered = alert.active && Number.isFinite(livePrice)
      ? (alert.condition === 'above' ? livePrice >= alert.targetPrice : livePrice <= alert.targetPrice)
      : false
    return {
      ...alert,
      livePrice: Number.isFinite(livePrice) ? livePrice : null,
      triggered,
    }
  })
  const triggeredAlertCount = evaluatedPriceAlerts.filter((alert) => alert.triggered).length
  const activeAlertCount = evaluatedPriceAlerts.filter((alert) => alert.active).length
  const alertBadgeCount = triggeredAlertCount || activeAlertCount
  const alertBadgeLabel = alertBadgeCount > 99 ? '99+' : String(alertBadgeCount)

  const watchableStocks = Array.from(new Set([
    ...holdings.map((holding) => String(holding.company || '').trim()),
    ...niftyTickerRows.map((row) => String(row.ticker || '').trim()),
    ...marketRows.slice(0, 40).flatMap((row) => [String(row.ticker || '').trim(), String(row.company || '').trim()]),
  ]))
    .filter(Boolean)
    .slice(0, 120)

  const portfolioSignals = holdings
    .map((holding) => getHoldingSignal(holding))
    .sort((a, b) => b.priority - a.priority || a.company.localeCompare(b.company))
  const highlightedSignals = portfolioSignals.filter((signal) => signal.action !== 'HOLD').slice(0, 4)
  const dashboardSignals = highlightedSignals.slice(0, 2)

  const rebalancingSuggestions = (() => {
    if (!holdings.length) {
      return ['Add holdings to generate rebalancing suggestions.']
    }

    const totalCurrentValue = holdings.reduce((sum, holding) => sum + toNumber(holding.currentValue), 0) || 1
    const sectorTotals = holdings.reduce((acc, holding) => {
      const sector = String(holding.sector || 'Uncategorized').trim()
      acc[sector] = (acc[sector] || 0) + toNumber(holding.currentValue)
      return acc
    }, {})

    const sectorAllocations = Object.entries(sectorTotals)
      .map(([sector, value]) => ({ sector, value, pct: (value / totalCurrentValue) * 100 }))
      .sort((a, b) => b.pct - a.pct)

    const suggestions = []
    const topSector = sectorAllocations[0]

    if (topSector && topSector.pct > 45) {
      suggestions.push(
        `Trim ${topSector.sector} exposure from ${topSector.pct.toFixed(1)}% toward 35-40% to reduce concentration risk.`
      )
    }

    if (sectorAllocations.length < 3 && holdings.length >= 3) {
      suggestions.push('Diversify into at least one additional sector to improve balance.')
    }

    const weakHoldings = holdings
      .filter((holding) => toNumber(holding.returnPercentage) <= -10)
      .map((holding) => holding.company)
      .filter(Boolean)
      .slice(0, 2)
    if (weakHoldings.length > 0) {
      suggestions.push(`Review underperformers: ${weakHoldings.join(', ')}.`)
    }

    const risingSector = marketRows
      .filter((row) => toNumber(row.returnPercent) > 0)
      .sort((a, b) => toNumber(b.returnPercent) - toNumber(a.returnPercent))[0]?.sector
    if (risingSector && !sectorTotals[risingSector]) {
      suggestions.push(`Consider phased allocation to ${risingSector} based on current market momentum.`)
    }

    if (!suggestions.length) {
      suggestions.push('Current allocation appears balanced. Continue periodic monthly review.')
    }

    return suggestions.slice(0, 3)
  })()
  const portfolioMood = (() => {
    if (!holdings.length) {
      return {
        emoji: '🤔',
        label: 'Awaiting Data',
        detail: 'Add holdings to get a live portfolio mood check.',
        score: 0,
      }
    }

    const returnTilt = Math.max(-12, Math.min(12, avgReturn))
    const alertPenalty = Math.min(25, triggeredAlertCount * 5)
    const moodScore = Math.max(0, Math.min(100, Math.round(portfolioFitScore + returnTilt - alertPenalty)))

    if (moodScore >= 85) {
      return {
        emoji: '😄',
        label: 'Excellent',
        detail: 'Portfolio is performing strongly with healthy balance.',
        score: moodScore,
      }
    }
    if (moodScore >= 70) {
      return {
        emoji: '🙂',
        label: 'Healthy',
        detail: 'Good posture overall. Keep monitoring for new opportunities.',
        score: moodScore,
      }
    }
    if (moodScore >= 55) {
      return {
        emoji: '😐',
        label: 'Steady',
        detail: 'Stable, but a few moves could improve risk-reward.',
        score: moodScore,
      }
    }
    if (moodScore >= 40) {
      return {
        emoji: '😟',
        label: 'Watchlist',
        detail: 'Portfolio needs attention on concentration or weak holdings.',
        score: moodScore,
      }
    }
    return {
      emoji: '😬',
      label: 'Risky',
      detail: 'High stress detected. Consider rebalancing soon.',
      score: moodScore,
    }
  })()

  const configuredRisk = Math.round(toNumber(userSettings?.riskTolerance, 50))
  const selectedSectors = Array.isArray(userSettings?.selectedSectors) && userSettings.selectedSectors.length > 0
    ? userSettings.selectedSectors.join(', ')
    : 'Not configured'

  const reportCards = [
    {
      title: 'Risk Configuration',
      value: `${configuredRisk}%`,
      detail: `Profile: ${configuredRisk < 33 ? 'Conservative' : configuredRisk < 66 ? 'Moderate' : 'Aggressive'}`,
    },
    {
      title: 'Preferred Sectors',
      value: selectedSectors,
      detail: `Top match fit score: ${portfolioFitScore}/100`,
    },
    {
      title: 'Vault Guardrails',
      value: vaultSettings
        ? `Buffer ${vaultSettings.emergencyBufferPercent || 12}% | Stop-loss ${vaultSettings.stopLossPercent || 8}%`
        : 'Not configured',
      detail: vaultSettings?.lockWithdrawals ? `Withdrawal lock ${vaultSettings.withdrawalWindow || 'enabled'}` : 'Withdrawal lock disabled',
    },
    {
      title: 'Portfolio Coverage',
      value: `${holdings.length} holdings`,
      detail: `Average return ${avgReturn}% | Value ₹${Math.round(totalValue).toLocaleString('en-IN')}`,
    },
  ]

  const filteredReportCards = normalizedDashboardSearch
    ? reportCards.filter((card) =>
      [card.title, card.value, card.detail]
        .some((value) => String(value || '').toLowerCase().includes(normalizedDashboardSearch)))
    : reportCards

  const profileDetails = {
    fullName: currentUser?.name || 'Investor',
    email: currentUser?.email || userSettings?.profile?.email || 'Not set',
    phone: currentUser?.phone || userSettings?.profile?.phone || 'Not set',
    country: currentUser?.country || userSettings?.profile?.country || 'Not set',
    currency: currentUser?.currency || userSettings?.profile?.currency || 'INR',
    userId: currentUser?.id || 'demo',
  }
  const tickerDisplayRows = niftyTickerRows.slice(0, 20)

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="shell-sidebar">
        <div className="shell-logo">
          <div className="shell-logo-icon">⚖️</div>
          <div>
            <div className="shell-logo-name">PROFITLY</div>
            <div className="shell-logo-sub">SOVEREIGN LEDGER</div>
          </div>
        </div>

        <nav className="shell-nav">
          {[
            { icon: '🧭', label: 'Dashboard' },
            { icon: '💼', label: 'Portfolio' },
            { icon: '💬', label: 'Chat History' },
            { icon: '📊', label: 'Markets' },
            { icon: '📉', label: 'Analytics' },
            { icon: '🔒', label: 'Vault' },
          ].map(item => (
            <button
              key={item.label}
              className={`shell-nav-item ${activeNav === item.label ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.label)
                setShowProfilePanel(false)
                if (item.label === 'Portfolio') setShowPortfolio(true)
              }}
            >
              <span className="shell-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <button className="shell-new-btn" onClick={() => setShowPortfolio(true)}>
          <span>+</span> NEW INVESTMENT
        </button>

        <div className="shell-sidebar-bottom">
          <button className="shell-nav-item" onClick={() => { setActiveNav('Settings'); setShowProfilePanel(false) }}>
            <span className="shell-nav-icon">⚙️</span> Settings
          </button>
          <button className="shell-nav-item" onClick={() => { setShowProfilePanel(false); onLogout() }}>
            <span className="shell-nav-icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="shell-main">
        {/* Top bar */}
        <header className="shell-topbar">
          <div className="shell-search">
            <span>🔍</span>
            <input
              value={activeNav === 'Markets' ? marketSearch : searchInput}
              onChange={(e) => {
                if (activeNav === 'Markets') {
                  setMarketSearch(e.target.value)
                } else {
                  setSearchInput(e.target.value)
                }
              }}
              placeholder={
                activeNav === 'Markets'
                  ? 'Search ticker or company...'
                  : activeNav === 'Chat History'
                    ? 'Search chat history by query or response...'
                  : activeTopTab === 'History'
                    ? 'Search history by asset, status, date...'
                    : activeTopTab === 'Reports'
                      ? 'Search report insights, risk, and sectors...'
                      : activeTopTab === 'Deposits'
                        ? 'Search bank, payment method, or reference...'
                      : 'Search markets, assets, or reports...'
              }
            />
          </div>
          <nav className="shell-topnav">
            {['Overview', 'History', 'Reports'].map(t => (
              <button
                key={t}
                className={`shell-topnav-item ${activeTopTab === t ? 'active' : ''}`}
                onClick={() => {
                  setActiveTopTab(t)
                  setActiveNav('Dashboard')
                }}
              >
                {t}
              </button>
            ))}
            <button
              className={`shell-deposit-btn ${activeTopTab === 'Deposits' ? 'active' : ''}`}
              onClick={() => {
                setActiveTopTab('Deposits')
                setActiveNav('Dashboard')
              }}
            >
              Deposit
            </button>
          </nav>
          <button
            className="shell-notification-btn"
            onClick={openAlertCenter}
            title="Open alerts center"
            aria-label="Open alerts center"
          >
            <span className="shell-notification-icon">🔔</span>
            {alertBadgeCount > 0 && (
              <span className="shell-notification-count">{alertBadgeLabel}</span>
            )}
          </button>
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="shell-user shell-user-btn" onClick={() => setShowProfilePanel((prev) => !prev)}>
            <div className="shell-user-info">
              <span className="shell-user-name">{firstName}</span>
              <span className="shell-user-role">PRIVATE BANKING</span>
            </div>
            <div className="shell-user-avatar">{firstName[0]}</div>
          </button>
          {showProfilePanel && (
            <div className="shell-profile-panel">
              <p className="shell-profile-title">Profile Overview</p>
              <div className="shell-profile-row"><span>Name</span><strong>{profileDetails.fullName}</strong></div>
              <div className="shell-profile-row"><span>Email</span><strong>{profileDetails.email}</strong></div>
              <div className="shell-profile-row"><span>Phone</span><strong>{profileDetails.phone}</strong></div>
              <div className="shell-profile-row"><span>Country</span><strong>{profileDetails.country}</strong></div>
              <div className="shell-profile-row"><span>Currency</span><strong>{profileDetails.currency}</strong></div>
              <div className="shell-profile-row"><span>Member ID</span><strong>{profileDetails.userId}</strong></div>
              <button
                className="shell-profile-action"
                onClick={() => {
                  setShowProfilePanel(false)
                  setActiveNav('Settings')
                }}
              >
                Open Profile Settings
              </button>
            </div>
          )}
        </header>

        <div className="shell-ticker-strip" aria-label="Nifty 50 live ticker">
          {tickerDisplayRows.length > 0 ? (
            <div className="shell-ticker-track">
              {[...tickerDisplayRows, ...tickerDisplayRows].map((row, index) => (
                <span key={`${row.ticker}-${index}`} className="shell-ticker-item">
                  <strong>{row.ticker}</strong>
                  <span>INR {Number(row.latestClose || 0).toLocaleString('en-IN')}</span>
                  <span className={Number(row.returnPercent || 0) >= 0 ? 'up' : 'down'}>
                    {Number(row.returnPercent || 0) >= 0 ? '+' : ''}{Number(row.returnPercent || 0).toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div className="shell-ticker-status">{niftyTickerStatus}</div>
          )}
        </div>

        {/* Dashboard content */}
        <div className="shell-content">
          {activeNav === 'Chat History' ? (
            <div className="shell-tab-view">
              <div className="shell-tab-header">
                <p className="shell-briefing-label">CHAT HISTORY</p>
                <h2>Saved AI Conversations</h2>
                <p>Your chat is saved per account. Search by user query or AI response and reopen the live assistant anytime.</p>
              </div>
              <div className="shell-card">
                <div className="shell-card-header-row">
                  <p className="shell-card-label">CONVERSATION LOG</p>
                  <div className="shell-history-actions">
                    <button className="shell-view-all" onClick={() => { setActiveNav('Dashboard'); setActiveTopTab('Overview') }}>Open Live Chat</button>
                    <button className="shell-view-all shell-danger" onClick={clearChatHistory}>Clear History</button>
                  </div>
                </div>
                {messages.length === 0 ? (
                  <div className="shell-empty-state">No saved chat yet. Start asking questions in the dashboard AI panel.</div>
                ) : (
                  <div className="shell-chat-history-list">
                    {messages
                      .filter((msg) => {
                        const query = searchInput.trim().toLowerCase()
                        if (!query) return true
                        return msg.content.toLowerCase().includes(query)
                      })
                      .map((msg, idx) => (
                        <div key={`history-${idx}`} className={`shell-history-item ${msg.role}`}>
                          <div className="shell-history-meta">
                            <span>{msg.role === 'user' ? 'You' : 'Profitly AI'}</span>
                            <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-IN') : ''}</span>
                          </div>
                          <p>{msg.content}</p>
                        </div>
                      ))}
                    {messages.filter((msg) => {
                      const query = searchInput.trim().toLowerCase()
                      if (!query) return true
                      return msg.content.toLowerCase().includes(query)
                    }).length === 0 && (
                      <div className="shell-empty-state">No chat messages matched "{searchInput.trim()}".</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeNav === 'Markets' ? (
            <div className="markets-view">
              <div className="markets-heading">
                <p className="shell-briefing-label">MARKETS</p>
                <h2 className="markets-title">Live Market Fields</h2>
                <p className="markets-sub">
                  Track core fields for each stock: price, range, volume, return, risk and liquidity.
                </p>
              </div>

              <div className="markets-controls">
                <select
                  className="markets-select"
                  value={marketSector}
                  onChange={(e) => setMarketSector(e.target.value)}
                >
                  {marketSectors.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>

                <button className="markets-refresh" onClick={fetchMarkets}>
                  Refresh Fields
                </button>
              </div>

              {marketLoading && <p className="markets-loading">Loading market fields...</p>}
              {!marketLoading && marketError && <p className="markets-error">{marketError}</p>}

              {!marketLoading && !marketError && (
                <div className="markets-table-wrap">
                  <div className="markets-table-head">
                    <span>Ticker</span>
                    <span>Company</span>
                    <span>Sector</span>
                    <span>Price</span>
                    <span>Day Range</span>
                    <span>Volume</span>
                    <span>Return</span>
                    <span>Risk</span>
                    <span>Liquidity</span>
                  </div>

                  {marketRows.length === 0 && (
                    <div className="markets-empty">No matching stocks found for the selected filters.</div>
                  )}

                  {marketRows.map((row) => (
                    <div key={row.ticker} className="markets-table-row">
                      <span className="markets-ticker">{row.ticker}</span>
                      <span className="markets-company">{row.company}</span>
                      <span>{row.sector || 'N/A'}</span>
                      <span>₹{Number(row.latestClose || 0).toLocaleString('en-IN')}</span>
                      <span>₹{Number(row.lowPrice || 0).toLocaleString('en-IN')} - ₹{Number(row.highPrice || 0).toLocaleString('en-IN')}</span>
                      <span>{Number(row.volume || 0).toLocaleString('en-IN')}</span>
                      <span className={Number(row.returnPercent) >= 0 ? 'markets-positive' : 'markets-negative'}>
                        {Number(row.returnPercent) >= 0 ? '+' : ''}{Number(row.returnPercent || 0).toFixed(2)}%
                      </span>
                      <span className={`markets-pill ${row.risk || 'medium'}`}>{row.risk || 'medium'}</span>
                      <span className={`markets-pill ${row.liquidity || 'medium'}`}>{row.liquidity || 'medium'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeNav === 'Analytics' ? (
            <Analytics portfolio={portfolioData} />
          ) : activeNav === 'Settings' ? (
            <Settings
              key={`settings-${currentUser?.id || 'demo'}`}
              user={currentUser}
              userId={currentUser?.id || 'demo'}
              onProfileUpdate={handleProfileUpdate}
              alertCenter={{
                focusSignal: settingsAlertFocusSignal,
                triggeredAlertCount,
                highlightedSignals,
                watchableStocks,
                priceAlertDraft,
                setPriceAlertDraft,
                priceAlertNote,
                setPriceAlertNote,
                addPriceAlert,
                evaluatedPriceAlerts,
                togglePriceAlert,
                removePriceAlert,
                rebalancingSuggestions,
              }}
            />
          ) : activeNav === 'Vault' ? (
            <Vault
              key={`vault-${currentUser?.id || 'demo'}`}
              user={currentUser}
              userId={currentUser?.id || 'demo'}
              onSave={handleVaultSave}
            />
          ) : (
            <>
              {activeTopTab === 'Overview' && (
                <>
                  {dashboardSearchTerm && (
                    <div className="shell-search-meta">
                      Search "{dashboardSearchTerm}" found {filteredActivity.length} activity records and {filteredHoldings.length} holdings.
                    </div>
                  )}

                  {dashboardSearchTerm && (
                    <div className="shell-card shell-holding-search-card">
                      <div className="shell-card-header-row">
                        <p className="shell-card-label">HOLDING SEARCH MATCHES</p>
                        <span className="shell-holding-search-count">{filteredHoldings.length} matched</span>
                      </div>
                      {filteredHoldings.length === 0 ? (
                        <div className="shell-empty-state">No user holdings matched "{dashboardSearchTerm}".</div>
                      ) : (
                        <div className="shell-report-holdings">
                          {filteredHoldings.slice(0, 8).map((holding, idx) => (
                            <div key={`search-holding-${holding.company}-${idx}`} className="shell-report-holding-row">
                              <div>
                                <p className="shell-asset-name">{holding.company}</p>
                                <p className="shell-asset-sub">
                                  {holding.sector} · Invested {formatCurrency(holding.entryPrice)}
                                </p>
                              </div>
                              <div className="shell-impact">
                                <p className={`shell-impact-value ${Number(holding.returnPercentage || 0) >= 0 ? 'positive' : 'negative'}`}>
                                  {Number(holding.returnPercentage || 0) >= 0 ? '+' : ''}{Number(holding.returnPercentage || 0).toFixed(2)}%
                                </p>
                                <p className="shell-impact-sub">Current {formatCurrency(holding.currentValue)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Morning briefing */}
                  <div className="shell-briefing">
                    <div className="shell-briefing-left">
                      <p className="shell-briefing-label">MORNING BRIEFING</p>
                      <h1 className="shell-greeting">
                        {getGreeting()}<br />
                        <span className="shell-greeting-name">{firstName}.</span>
                      </h1>
                      <p className="shell-briefing-text">
                        Your sovereign ledger has grown by {avgReturn}% since last week. The Nifty 50 markets are showing strong momentum in IT and Banking sectors.
                      </p>
                    </div>
                    <div className="shell-wealth">
                      <p className="shell-wealth-label">AGGREGATE WEALTH</p>
                      <p className="shell-wealth-value">
                        ₹{totalValue.toLocaleString('en-IN')}
                        <span className="shell-wealth-decimal">.00</span>
                      </p>
                      <p className="shell-wealth-change">
                        📈 +₹{Math.round(totalValue * 0.024).toLocaleString('en-IN')} ({avgReturn}%)
                      </p>
                    </div>
                  </div>

                  {/* Middle cards row */}
                  <div className="shell-cards-row">
                    {/* Left column - stats */}
                    <div className="shell-left-col">
                      {/* Fit Score card */}
                      <div className="shell-card shell-fit-card">
                        <div className="shell-fit-head">
                          <p className="shell-card-label shell-fit-label">PORTFOLIO FIT SCORE</p>
                          <span className="shell-fit-max">/100</span>
                        </div>
                        <div className="shell-fit-metric-row">
                          <h2 className="shell-fit-score">{fitScoreRounded}</h2>
                          <p className="shell-fit-delta">
                            ▲ +{fitDelta} vs last wk
                          </p>
                        </div>
                        <div className="shell-fit-segments">
                          {Array.from({ length: fitSegmentTotal }).map((_, idx) => (
                            <span
                              key={`fit-segment-${idx}`}
                              className={`shell-fit-segment ${
                                idx < fitGoldSegments
                                  ? 'gold'
                                  : idx < fitGoldSegments + fitDarkSegments
                                    ? 'dark'
                                    : 'neutral'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="shell-card-sub shell-fit-sub">
                          Optimization level is currently in the <span className="gold-text">top {fitTopPercent}%</span> of peer benchmarks.
                        </p>
                      </div>

                      {/* Projected Yield */}
                      <div className="shell-card">
                        <p className="shell-card-label">PROJECTED ANNUAL YIELD</p>
                        <h3 className="shell-yield-value">
                          ₹{Math.round(totalValue * 0.1).toLocaleString('en-IN')}
                          <span className="shell-yield-change"> +0.8%</span>
                        </h3>
                        <div className="shell-quick-btns" style={{ marginTop: '12px' }}>
                          {['FIXED', 'EQUITY', 'ALT'].map(b => (
                            <button key={b} className="shell-quick-btn"
                              onClick={() => sendMessage(`Show me ${b} investments`)}>
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Center - AI + Chat unified */}
                    <div className="shell-card shell-card-dark shell-ai-chat">
                      <div className="shell-insight-header">
                        <div className="shell-ai-badge">AI</div>
                        <p className="shell-card-label">PROFITLY INSIGHT ENGINE</p>
                      </div>

                      <h3 className="shell-insight-title">
                        Strategic intelligence<br />
                        for your <em>Nifty 50</em> assets.
                      </h3>

                      {/* Chat messages */}
                      <div className="shell-chat-messages">
                        {messages.length === 0 && (
                          <div className="shell-empty-chat">
                            <p>🤖 Ask me anything about your investments, risk levels, or market opportunities.</p>
                          </div>
                        )}
                        {messages.map((msg, i) => (
                          <div key={i} className={`shell-chat-bubble ${msg.role}`}>
                            {msg.role === 'assistant' && (
                              <span className="shell-bubble-label">PROFITLY AI</span>
                            )}
                            {msg.role === 'user' && (
                              <button className="shell-chat-edit-btn" onClick={() => startEditingMessage(i)}>
                                Edit Query
                              </button>
                            )}
                            <p>{msg.content}</p>
                            {msg.offerings && msg.offerings.slice(0, 2).map((o, j) => (
                              <div key={j} className="shell-inline-stock">
                                <div>
                                  <span className="shell-stock-name">{o.company}</span>
                                  <span className="shell-stock-meta"> · {o.sector} · ₹{o.latestClose}</span>
                                </div>
                                <span className="shell-stock-score">{o.fitScore?.score}/100</span>
                              </div>
                            ))}
                            {msg.suggestions && (
                              <div className="shell-bubble-chips">
                                {msg.suggestions.slice(0, 3).map((s, j) => (
                                  <button key={j} className="shell-chip" onClick={() => sendMessage(s)}>{s}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {loading && (
                          <div className="shell-chat-bubble assistant">
                            <span className="shell-bubble-label">PROFITLY AI</span>
                            <div className="shell-typing">
                              <span /><span /><span />
                            </div>
                          </div>
                      )}
                    </div>

                    {chatEditIndex !== null && (
                      <div className="shell-chat-editing-banner">
                        <span>Editing an earlier query. Sending now will replace that message and replay AI response.</span>
                        <button onClick={cancelMessageEdit}>Cancel</button>
                      </div>
                    )}

                    {/* Chat input */}
                    <div className="shell-chat-input-wrap">
                        <span>💬</span>
                        <input
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && sendMessage()}
                          placeholder={chatEditIndex !== null ? 'Edit your query and press Enter...' : 'Ask Profitly AI about your investments...'}
                        />
                        <button className="shell-send" onClick={() => sendMessage()}>→</button>
                      </div>

                      {/* Quick asks */}
                      <div className="shell-quick-asks">
                        {['📊 Analyze my portfolio', '⚠️ Check risk levels', '💡 Best opportunities', '📈 Top IT stocks'].map((q, i) => (
                          <button key={i} className="shell-quick-ask" onClick={() => sendMessage(q)}>{q}</button>
                        ))}
                      </div>

                      <button className="shell-rebalance-btn" onClick={() => sendMessage('Should I rebalance my portfolio?')}>
                        Execute Rebalance →
                      </button>
                    </div>

                    {/* Right - Vault Protection */}
                    <div className="shell-right-col">
                      <div className="shell-card">
                        <p className="shell-card-label">VAULT PROTECTION 🔒</p>
                        <p className="shell-alert-text">{vaultProtectionText}</p>
                        <p className="shell-alert-text" style={{ marginTop: '8px' }}>{vaultLockText}</p>
                      </div>
                      <div className="shell-card">
                        <p className="shell-card-label">PORTFOLIO HEALTH</p>
                        <div className="shell-health-items">
                          {[
                            { label: 'Diversification', value: '85%', color: 'var(--green)' },
                            { label: 'Risk Balance', value: '72%', color: 'var(--amber)' },
                            { label: 'Liquidity', value: '91%', color: 'var(--green)' },
                          ].map((h, i) => (
                            <div key={i} className="shell-health-item">
                              <div className="shell-health-row">
                                <span className="shell-health-label">{h.label}</span>
                                <span className="shell-health-val" style={{ color: h.color }}>{h.value}</span>
                              </div>
                              <div className="shell-score-bar-bg">
                                <div className="shell-score-bar" style={{ width: h.value, background: h.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="shell-card">
                        <p className="shell-card-label">SECTORS 📊</p>
                        {filteredHoldings.length > 0 ? (
                          [...new Set(filteredHoldings.map(h => h.sector))].map((s, i) => (
                            <div key={i} className="shell-sector-item">
                              <span className="shell-sector-name">{s}</span>
                              <span className="shell-sector-count gold-text">
                                {filteredHoldings.filter(h => h.sector === s).length} stocks
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="shell-alert-text">No holdings found for the current search.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shell-dashboard-insights">
                    <div className="shell-card shell-mini-insight-card">
                      <div className="shell-card-header-row">
                        <p className="shell-card-label">RECOMMENDATIONS</p>
                        <span className="shell-reco-badge">{triggeredAlertCount} alerts</span>
                      </div>
                      {dashboardSignals.length === 0 ? (
                        <p className="shell-alert-text">No urgent recommendation right now.</p>
                      ) : (
                        <div className="shell-mini-reco-list">
                          {dashboardSignals.map((signal, index) => (
                            <div key={`dashboard-signal-${signal.company}-${index}`} className={`shell-mini-reco-item ${signal.tone}`}>
                              <p className="shell-mini-reco-stock">{signal.company}</p>
                              <p className="shell-mini-reco-action">{signal.action}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="shell-view-all shell-mini-reco-link" onClick={openAlertCenter}>
                        Open alert center
                      </button>
                    </div>

                    <div className="shell-card shell-mini-insight-card shell-emotion-card">
                      <p className="shell-card-label">PORTFOLIO EMOTION</p>
                      <p className="shell-emotion-emoji">{portfolioMood.emoji}</p>
                      <p className="shell-emotion-label">{portfolioMood.label}</p>
                      <p className="shell-emotion-text">{portfolioMood.detail}</p>
                      <div className="shell-emotion-meter">
                        <div className="shell-emotion-meter-fill" style={{ width: `${portfolioMood.score}%` }} />
                      </div>
                      <p className="shell-emotion-score">{portfolioMood.score}/100 mood score</p>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="shell-activity">
                    <div className="shell-activity-header">
                      <h3 className="shell-activity-title">Recent Activity Ledger</h3>
                      <button className="shell-view-all" onClick={() => setActiveTopTab('History')}>View Full History</button>
                    </div>
                    <div className="shell-activity-table">
                      <div className="shell-table-header">
                        <span>ASSET / TRANSACTION</span>
                        <span>STATUS</span>
                        <span>DATE</span>
                        <span>IMPACT</span>
                      </div>
                      {filteredActivity.length === 0 && (
                        <div className="shell-empty-state">No activity matched "{dashboardSearchTerm}".</div>
                      )}
                      {filteredActivity.map((item, i) => (
                        <div key={item.id || i} className="shell-table-row">
                          <div className="shell-table-asset">
                            <div className="shell-asset-icon">{item.icon}</div>
                            <div>
                              <p className="shell-asset-name">{item.name}</p>
                              <p className="shell-asset-sub">{item.sub}</p>
                            </div>
                          </div>
                          <div>
                            <span className={`shell-status ${item.status.toLowerCase()}`}>{item.status}</span>
                          </div>
                          <span className="shell-date">{item.date}</span>
                          <div className="shell-impact">
                            <p className={`shell-impact-value ${item.positive ? 'positive' : 'negative'}`}>{item.impact}</p>
                            <p className="shell-impact-sub">{item.growth}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTopTab === 'History' && (
                <div className="shell-tab-view">
                  <div className="shell-tab-header">
                    <p className="shell-briefing-label">HISTORY</p>
                    <h2>Transaction Timeline</h2>
                    <p>Review all order events, settlement status, and realized impact with live search filtering.</p>
                  </div>
                  <div className="shell-activity">
                    <div className="shell-activity-header">
                      <h3 className="shell-activity-title">{filteredActivity.length} records found</h3>
                      <div className="shell-history-actions">
                        <button className="shell-view-all" onClick={() => setSearchInput('')}>Clear Search</button>
                        <button className="shell-view-all shell-danger" onClick={clearActivityHistory}>Reset History</button>
                      </div>
                    </div>
                    <div className="shell-history-recent-wrap">
                      <div className="shell-history-recent-header">
                        <p className="shell-history-recent-title">Recent Searched Stocks</p>
                        <button className="shell-view-all" onClick={clearRecentStockSearches}>Clear Recent Searches</button>
                      </div>
                      {filteredRecentStockSearches.length === 0 ? (
                        <p className="shell-history-recent-empty">No recent stock searches yet. Search in Markets to auto-save names here.</p>
                      ) : (
                        <div className="shell-history-search-chips">
                          {filteredRecentStockSearches.map((stockName, index) => (
                            <button
                              key={`${stockName}-${index}`}
                              className="shell-history-search-chip"
                              onClick={() => setSearchInput(stockName)}
                              title={`Filter history by ${stockName}`}
                            >
                              {stockName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shell-activity-table">
                      <div className="shell-table-header">
                        <span>ASSET / TRANSACTION</span>
                        <span>PAYMENT STATUS</span>
                        <span>DATE</span>
                        <span>IMPACT</span>
                      </div>
                      {filteredActivity.length === 0 && (
                        <div className="shell-empty-state">No history matched "{dashboardSearchTerm}". Try company name, status, or date.</div>
                      )}
                      {filteredActivity.map((item, i) => (
                        <div key={item.id || i} className="shell-table-row">
                          <div className="shell-table-asset">
                            <div className="shell-asset-icon">{item.icon}</div>
                            <div>
                              <p className="shell-asset-name">{item.name}</p>
                              <p className="shell-asset-sub">{item.sub}</p>
                            </div>
                          </div>
                          <div className="shell-history-status-cell">
                            <span className={`shell-status ${item.status.toLowerCase()}`}>{item.status}</span>
                            <div className="shell-settlement-actions">
                              <button
                                className={`shell-settlement-btn settled ${item.status === 'SETTLED' ? 'active' : ''}`}
                                onClick={() => setActivitySettlementStatus(item.id, 'SETTLED')}
                              >
                                Settled
                              </button>
                              <button
                                className={`shell-settlement-btn pending ${item.status === 'PENDING' ? 'active' : ''}`}
                                onClick={() => setActivitySettlementStatus(item.id, 'PENDING')}
                              >
                                Pending
                              </button>
                            </div>
                          </div>
                          <span className="shell-date">{item.date}</span>
                          <div className="shell-impact">
                            <p className={`shell-impact-value ${item.positive ? 'positive' : 'negative'}`}>{item.impact}</p>
                            <p className="shell-impact-sub">{item.growth}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTopTab === 'Reports' && (
                <div className="shell-tab-view">
                  <div className="shell-tab-header">
                    <p className="shell-briefing-label">REPORTS</p>
                    <h2>Portfolio Intelligence Reports</h2>
                    <p>See strategy configuration, risk posture, and portfolio coverage in one place.</p>
                  </div>

                  <div className="shell-report-actions">
                    <div className="shell-download-toggle">
                      <button
                        className={`shell-download-option ${reportDownloadFormat === 'pdf' ? 'active' : ''}`}
                        onClick={() => setReportDownloadFormat('pdf')}
                      >
                        PDF
                      </button>
                      <button
                        className={`shell-download-option ${reportDownloadFormat === 'word' ? 'active' : ''}`}
                        onClick={() => setReportDownloadFormat('word')}
                      >
                        Word
                      </button>
                    </div>
                    <button className="shell-download-btn" onClick={downloadReport}>
                      Download Report
                    </button>
                  </div>

                  <div className="shell-reports-grid">
                    {filteredReportCards.length === 0 && (
                      <div className="shell-empty-state">No report cards matched "{dashboardSearchTerm}".</div>
                    )}
                    {filteredReportCards.map((card) => (
                      <div key={card.title} className="shell-card shell-report-card">
                        <p className="shell-card-label">{card.title}</p>
                        <h3 className="shell-report-value">{card.value}</h3>
                        <p className="shell-alert-text">{card.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="shell-card">
                    <div className="shell-card-header-row">
                      <p className="shell-card-label">HOLDINGS SNAPSHOT</p>
                      <button className="shell-view-all" onClick={() => setActiveTopTab('Overview')}>Back to Overview</button>
                    </div>
                    {filteredHoldings.length === 0 ? (
                      <div className="shell-empty-state">No holdings matched "{dashboardSearchTerm}".</div>
                    ) : (
                      <div className="shell-report-holdings">
                        {filteredHoldings.slice(0, 10).map((holding, idx) => (
                          <div key={`${holding.company}-${idx}`} className="shell-report-holding-row">
                            <div>
                              <p className="shell-asset-name">{holding.company}</p>
                              <p className="shell-asset-sub">{holding.sector}</p>
                              <p className="shell-asset-sub">
                                Invested {formatCurrency(holding.entryPrice)} · Current {formatCurrency(holding.currentValue)}
                              </p>
                            </div>
                            <div className="shell-impact">
                              <p className={`shell-impact-value ${Number(holding.returnPercentage || 0) >= 0 ? 'positive' : 'negative'}`}>
                                {Number(holding.returnPercentage || 0) >= 0 ? '+' : ''}{Number(holding.returnPercentage || 0).toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTopTab === 'Deposits' && (
                <div className="shell-tab-view">
                  <div className="shell-tab-header">
                    <p className="shell-briefing-label">DEPOSITS</p>
                    <h2>Bank & Payment Details</h2>
                    <p>Store your deposit account details and recent payment reference to keep funding records ready.</p>
                  </div>

                  <div className="shell-deposit-grid">
                    <div className="shell-card">
                      <p className="shell-card-label">BANK DETAILS</p>
                      <div className="shell-form-grid two-col">
                        <label className="shell-form-field">
                          <span>Account Holder Name</span>
                          <input
                            value={depositForm.accountHolder}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, accountHolder: event.target.value }))}
                            placeholder="Enter account holder name"
                          />
                        </label>
                        <label className="shell-form-field">
                          <span>Bank Name</span>
                          <input
                            value={depositForm.bankName}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, bankName: event.target.value }))}
                            placeholder="Enter bank name"
                          />
                        </label>
                        <label className="shell-form-field">
                          <span>Account Number</span>
                          <input
                            value={depositForm.accountNumber}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                            placeholder="Enter account number"
                          />
                        </label>
                        <label className="shell-form-field">
                          <span>IFSC / SWIFT</span>
                          <input
                            value={depositForm.ifscCode}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, ifscCode: event.target.value.toUpperCase() }))}
                            placeholder="Enter IFSC or SWIFT"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="shell-card">
                      <p className="shell-card-label">PAYMENT DETAILS</p>
                      <div className="shell-form-grid two-col">
                        <label className="shell-form-field">
                          <span>Payment Method</span>
                          <select
                            value={depositForm.paymentMethod}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                          >
                            {['UPI', 'Net Banking', 'Debit Card', 'Credit Card', 'NEFT', 'RTGS'].map((method) => (
                              <option key={method} value={method}>{method}</option>
                            ))}
                          </select>
                        </label>
                        <label className="shell-form-field">
                          <span>Amount (INR)</span>
                          <input
                            type="number"
                            value={depositForm.amount}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, amount: event.target.value }))}
                            placeholder="0.00"
                          />
                        </label>
                        <label className="shell-form-field">
                          <span>Transaction Reference</span>
                          <input
                            value={depositForm.transactionRef}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, transactionRef: event.target.value }))}
                            placeholder="Enter transaction id/reference"
                          />
                        </label>
                        <label className="shell-form-field">
                          <span>Payment Date</span>
                          <input
                            type="date"
                            value={depositForm.paymentDate}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                          />
                        </label>
                        <label className="shell-form-field full-width">
                          <span>Notes (Optional)</span>
                          <textarea
                            value={depositForm.notes}
                            onChange={(event) => setDepositForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Add any payment notes or remarks"
                          />
                        </label>
                      </div>

                      <div className="shell-deposit-footer">
                        {depositStatus.message && (
                          <p className={depositStatus.type === 'success' ? 'shell-deposit-success' : 'shell-deposit-error'}>
                            {depositStatus.message}
                          </p>
                        )}
                        <button className="shell-deposit-save-btn" onClick={saveDepositDetails}>
                          Save Deposit Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="shell-footer-line">
          <span>Profitly Sovereign Ledger (c) 2026 Profitly Technologies Pvt. Ltd.</span>
          <span>Support: support@profitly.in</span>
        </footer>
      </div>
    </div>
  )
}

export default App

