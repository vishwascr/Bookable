import { useEffect } from 'react';
import { setToken } from '../api.js';

export default function LogoutPage({ onGoLogin, onGoHome }) {
  useEffect(() => {
    setToken(null);
  }, []);

  return (
    <section className="auth-page logout-page">
      <div className="auth-card logout-card">
        {/* Designated slot for upcoming mascot */}
        <div className="mascot-slot" aria-label="Bookable Mascot Slot">
          <div className="mascot-placeholder">
            <span className="mascot-icon">🦉</span>
            <span className="mascot-badge">Mascot Slot</span>
          </div>
        </div>

        <div className="auth-branding">
          <h1 className="auth-logo">📚 Bookable</h1>
          <p className="auth-tagline">Bookable - Where wisdom meets technology</p>
        </div>

        <div className="logout-message-box">
          <h2>You have been logged out</h2>
          <p className="m">Thank you for visiting Bookable. Your session has safely ended.</p>
        </div>

        <div className="auth-actions">
          <button type="button" className="btn-primary full-width" onClick={onGoLogin}>
            Log Back In →
          </button>
          <button type="button" className="link muted" onClick={onGoHome}>
            ← Continue browsing as guest
          </button>
        </div>
      </div>
    </section>
  );
}

