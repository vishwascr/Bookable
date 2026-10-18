import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

const MIN = 3, MAX = 5;

// Goodreads-style "pick books you love" step. Used after signup and for editing favourites.
export default function Onboarding({ initial = [], onDone, onCancel, editing = false }) {
  const [popular, setPopular] = useState([]);
  const [picked, setPicked] = useState(initial); // array of book objects
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.popular().then(setPopular).catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => api.searchPaginated(q.trim(), 1, 12).then((r) => setResults(Array.isArray(r) ? r : r?.books || [])).catch(() => { }), 250);
    return () => clearTimeout(t);
  }, [q]);

  const isPicked = (b) => picked.some((p) => p.isbn === b.isbn);
  const toggle = (b) => {
    setError('');
    if (isPicked(b)) setPicked(picked.filter((p) => p.isbn !== b.isbn));
    else if (picked.length >= MAX) setError(`You can pick up to ${MAX} books.`);
    else setPicked([...picked, b]);
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      await api.setFavorites(picked.map((b) => b.isbn));
      onDone();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const grid = q.trim().length >= 2 ? results : popular;

  return (
    <section className="onboarding">
      <div className="onb-head">
        <div>
          <h2>{editing ? 'Edit your favourite books' : 'Pick 3–5 books you love'}</h2>
          <p className="m">Your picks become the “seeds” every algorithm uses to build your recommendations.</p>
        </div>
        <div className="onb-progress">
          <div className="dots">{Array.from({ length: MAX }, (_, i) => <span key={i} className={i < picked.length ? 'on' : ''} />)}</div>
          <span className="m">{picked.length} / {MAX} selected {picked.length < MIN && `· ${MIN - picked.length} more to go`}</span>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="picked-row">
          {picked.map((b) => (
            <button key={b.isbn} className="picked-chip" onClick={() => toggle(b)} title="Remove">
              <Cover src={b.imageM} size="xs" title={b.title} />
              <span>{b.title}</span>
              <span className="x">✕</span>
            </button>
          ))}
        </div>
      )}

      <input className="onb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a book or author you love…" />
      <h4 className="onb-sub">{q.trim().length >= 2 ? `Results for “${q.trim()}”` : 'Popular on Bookable'}</h4>

      <div className="onb-grid">
        {grid.map((b) => (
          <button key={b.isbn} className={`onb-book ${isPicked(b) ? 'sel' : ''}`} onClick={() => toggle(b)}>
            <div className="onb-cover"><Cover src={b.imageM} size="lg" title={b.title} />{isPicked(b) && <span className="check">✓</span>}</div>
            <div className="t">{b.title}</div>
            <div className="m">{b.author}</div>
          </button>
        ))}
        {grid.length === 0 && <div className="m">No books found.</div>}
      </div>

      {error && <div className="error">{error}</div>}
      <div className="onb-actions">
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary" disabled={picked.length < MIN || busy} onClick={save}>
          {busy ? 'Saving…' : picked.length < MIN ? `Pick ${MIN - picked.length} more` : editing ? 'Save favourites' : 'Show my recommendations →'}
        </button>
      </div>
    </section>
  );
}
