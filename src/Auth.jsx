import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl } from './api'

const BUILD_GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const GOOGLE_CONFIG_SOURCE = BUILD_GOOGLE_CLIENT_ID ? 'frontend env' : 'backend config'
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export default function Auth({ onLogin, theme = 'light', onToggleTheme }) {
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [googleClientId, setGoogleClientId] = useState(BUILD_GOOGLE_CLIENT_ID)
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState(Boolean(BUILD_GOOGLE_CLIENT_ID))
  const [googleReady, setGoogleReady] = useState(false)
  const googleButtonRef = useRef(null)

  const persistSession = useCallback((data) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    onLogin(data.user)
  }, [onLogin])

  const handleGoogleCredential = useCallback(async (credential) => {
    if (!credential) {
      setError('Google did not return a valid credential.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.error) {
        setError(data.error || 'Google sign-in failed')
      } else {
        persistSession(data)
      }
    } catch {
      setError('Google sign-in failed. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }, [persistSession])

  useEffect(() => {
    if (BUILD_GOOGLE_CLIENT_ID || typeof window === 'undefined') return undefined

    let cancelled = false
    const controller = new AbortController()

    const loadGoogleConfig = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/config'), { signal: controller.signal })
        const data = await response.json().catch(() => ({}))
        const runtimeClientId = String(data.googleClientId || '').trim()
        if (!cancelled && runtimeClientId) {
          setGoogleClientId(runtimeClientId)
        }
      } catch {
        // Keep password auth usable even if the Google config fallback cannot load.
      } finally {
        if (!cancelled) {
          setGoogleConfigLoaded(true)
        }
      }
    }

    loadGoogleConfig()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    setGoogleReady(false)
    if (!googleClientId || typeof window === 'undefined') return undefined

    let cancelled = false
    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => handleGoogleCredential(response?.credential),
      })

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: isRegister ? 'signup_with' : 'signin_with',
        width: Math.min(360, googleButtonRef.current.offsetWidth || 320),
      })
      setGoogleReady(true)
    }

    const handleScriptError = () => {
      if (!cancelled) {
        setError('Unable to load Google sign-in. Check your network and try again.')
      }
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existingScript) {
      if (window.google?.accounts?.id) renderGoogleButton()
      existingScript.addEventListener('load', renderGoogleButton)
      existingScript.addEventListener('error', handleScriptError)
      return () => {
        cancelled = true
        existingScript.removeEventListener('load', renderGoogleButton)
        existingScript.removeEventListener('error', handleScriptError)
      }
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', renderGoogleButton)
    script.addEventListener('error', handleScriptError)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', renderGoogleButton)
      script.removeEventListener('error', handleScriptError)
    }
  }, [googleClientId, handleGoogleCredential, isRegister, theme])

  useEffect(() => {
    if (!googleClientId) return
    setError((currentError) => (
      currentError.startsWith('Google sign-in is not configured') ? '' : currentError
    ))
  }, [googleClientId])

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError('Please fill in all fields')
      return
    }
    if (isRegister && !form.name) {
      setError('Please enter your name')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      if (!response.ok || data.error) {
        setError(data.error || 'Authentication failed')
      } else {
        persistSession(data)
      }
    } catch {
      setError('Connection error. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <button
        className="theme-toggle-btn auth-theme-toggle"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">PR</div>
          <h1 className="login-brand-name">Profitly</h1>
          <p className="login-brand-tag">Smart Investing, Simplified</p>
        </div>

        <div className="login-features">
          {[
            { emoji: 'AI', title: 'AI-Powered', desc: 'Portfolio-aware assistant for investment questions' },
            { emoji: '50', title: 'Nifty 50 Data', desc: 'Market insights with CSV fallback support' },
            { emoji: '%', title: 'Fit Score', desc: 'Personalized investment matching' },
            { emoji: 'IN', title: 'Elite Analysis', desc: 'Professional grade recommendations' },
          ].map((feature) => (
            <div key={feature.title} className="login-feature">
              <span className="login-feature-emoji">{feature.emoji}</span>
              <div>
                <p className="login-feature-title">{feature.title}</p>
                <p className="login-feature-desc">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="login-market-ticker">
          {['TCS +2.3%', 'INFY +1.8%', 'WIPRO -0.4%', 'HDFC +3.1%', 'RELIANCE +1.2%'].map((ticker) => (
            <span key={ticker} className="ticker-item">{ticker}</span>
          ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-logo-sm">PR</div>
            <div>
              <h2 className="login-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
              <p className="login-sub">{isRegister ? 'Join Profitly today' : 'Sign in to your portfolio'}</p>
            </div>
          </div>

          <div className="login-tabs">
            <button
              className={`login-tab ${!isRegister ? 'active' : ''}`}
              onClick={() => {
                setIsRegister(false)
                setError('')
              }}
            >
              Sign In
            </button>
            <button
              className={`login-tab ${isRegister ? 'active' : ''}`}
              onClick={() => {
                setIsRegister(true)
                setError('')
              }}
            >
              Register
            </button>
          </div>

          {isRegister && (
            <div className="login-field">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
          )}

          <div className="login-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-inline-action"
                style={{ position: 'absolute', right: 10, top: 10 }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {!isRegister && (
              <button
                type="button"
                onClick={() => alert('Please contact support to reset your password.')}
                className="auth-inline-action auth-forgot-link"
              >
                Forgot Password?
              </button>
            )}
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <div className="login-divider"><span>or continue with</span></div>

          {googleClientId ? (
            <div className="login-google-native-shell">
              {!googleReady && (
                <button className="login-google" type="button" disabled>
                  Loading Google sign-in...
                </button>
              )}
              <div className="login-google-native" ref={googleButtonRef} />
            </div>
          ) : (
            <button
              className="login-google"
              type="button"
              disabled={!googleConfigLoaded}
              onClick={() => setError('Google sign-in is not configured or the backend settings could not be loaded. Add VITE_GOOGLE_CLIENT_ID in frontend/.env or GOOGLE_CLIENT_ID in backend/.env, then restart the servers.')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleConfigLoaded ? 'Sign in with Google' : 'Loading Google sign-in...'}
            </button>
          )}

          <p className="login-config-status">
            Google config: {googleClientId ? `loaded from ${GOOGLE_CONFIG_SOURCE}` : googleConfigLoaded ? 'missing' : 'checking'}
          </p>

          <p className="login-footer">
            By continuing you agree to Profitly's
            <span> Terms of Service</span> and <span>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
