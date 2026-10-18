import { useEffect } from 'react';
import { setToken } from '../api.js';
import Mascot from './Mascot.jsx';

export default function LogoutPage({ onGoLogin, onGoHome }) {
  useEffect(() => {
    setToken(null);
  }, []);

  return (
    <section className="auth-page logout-page">
      <div className="auth-card logout-card">
        {/* Friendly Panda Mascot */}
        <div className="mascot-slot" aria-label="Bookable Mascot">
          <Mascot size="md" />
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

