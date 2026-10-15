import { useState } from 'react';
import { api, setToken } from '../api.js';

export default function AuthPage({ mode: initialMode = 'signup', onAuthed, onCancel }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = signup ? await api.signup(form) : await api.login(form);
      setToken(res.token);
      onAuthed(res.user, signup);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h2>{signup ? 'Create your Bookable account' : 'Welcome back'}</h2>
        <p className="m">
          {signup
            ? 'Tell us 3–5 books you love and every algorithm will build recommendations just for you.'
            : 'Log in to see your personalised “For You” recommendations.'}
        </p>
        {signup && (
          <label>Display name <span className="m">(optional)</span>
            <input value={form.displayName} onChange={set('displayName')} placeholder="Jane Reader" maxLength={60} />
          </label>
        )}
        <label>Username
          <input value={form.username} onChange={set('username')} placeholder="jane_reads" autoComplete="username" required autoFocus />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} placeholder={signup ? 'At least 6 characters' : ''} autoComplete={signup ? 'new-password' : 'current-password'} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
        <div className="auth-switch">
          {signup ? 'Already have an account?' : 'New to Bookable?'}{' '}
          <button type="button" className="link" onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }}>
            {signup ? 'Log in' : 'Create an account'}
          </button>
        </div>
        {onCancel && <button type="button" className="link muted" onClick={onCancel}>← Continue browsing without an account</button>}
      </form>
    </section>
  );
}
