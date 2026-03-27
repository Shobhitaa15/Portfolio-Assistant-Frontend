import { useState } from 'react'
import Auth from './Auth'
import App from './App'
import OnboardingModal from './OnboardingModal'

export default function AppWrapper() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [showOnboarding, setShowOnboarding] = useState(false)

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

  if (!user) return <Auth onLogin={handleLogin} />

  return (
    <>
      <App user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}
    </>
  )
}
