import { useState } from 'react'

export default function Welcome({ onProceed }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div className="modal-content" style={{ textAlign: 'center' }}>
          <div className="modal-icon" style={{ fontSize: '64px' }}>💎</div>
          <h2 className="modal-title" style={{ fontSize: '28px' }}>Welcome to Profitly</h2>
          <p className="modal-sub" style={{ fontSize: '16px', marginBottom: '20px' }}>
            Your AI-powered portfolio assistant for smarter investing. Get personalized recommendations, analyze risks, and grow your wealth with intelligent insights.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
              <span>🎯</span>
              <span>Personalized fit scores based on your holdings</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
              <span>📊</span>
              <span>Real-time Nifty 50 market analysis</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
              <span>🤖</span>
              <span>AI-powered investment suggestions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
              <span>⚠️</span>
              <span>Risk analysis and rebalancing tips</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="modal-btn" onClick={onProceed} style={{ fontSize: '16px', padding: '12px 24px' }}>
              Get Started 🚀
            </button>
            <button className="modal-btn-outline" onClick={onProceed} style={{ fontSize: '16px', padding: '12px 24px' }}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}