import { useEffect, useState } from 'react'
import Auth from './Auth'
import App from './App'
import OnboardingModal from './OnboardingModal'

export default function AppWrapper() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('profitly_theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('profitly_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleLogin = (userData) => {
    setUser(userData)
    const hasOnboarded = localStorage.getItem('onboarded')
    if (!hasOnboarded) setShowOnboarding(true)
  }

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarded', 'true')
    setShowOnboarding(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('onboarded')
    setUser(null)
  }

  const handleUserUpdate = (nextUser) => {
    setUser(nextUser)
    localStorage.setItem('user', JSON.stringify(nextUser))
  }

  if (!user) return <Auth onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />

  return (
    <>
      <App
        user={user}
        onLogout={handleLogout}
        onUserUpdate={handleUserUpdate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}
    </>
  )
}
