import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

export default function SearchBar({ onPick, onSearch, currentQuery = '' }) {
  const [q, setQ] = useState(currentQuery);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    setQ(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.search(q)
        .then((r) => {
          setResults(Array.isArray(r) ? r : r.books || []);
          setOpen(true);
        })
        .catch(() => { });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setOpen(false);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleClear = () => {
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="search-wrapper" ref={box}>
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="input-row">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search by title, author, or keyword (press Enter for results page)…"
            aria-label="Search books"
          />
          {q && (
            <button
              type="button"
              className="clear-btn"
              onClick={handleClear}
              aria-label="Clear search input"
            >
              ✕
            </button>
          )}
          <button type="submit" className="search-btn">
            Search
          </button>
        </div>
      </form>

      {open && q.trim().length >= 2 && (
        <div className="dropdown">
          <div className="dropdown-hint">
            Press <kbd>Enter</kbd> or click <b>Search</b> for full results page
          </div>
          {results.length > 0 ? (
            <ul>
              {results.map((b) => (
                <li
                  key={b.isbn}
                  onClick={() => {
                    onPick(b);
                    setOpen(false);
                  }}
                  title="Directly select this book for recommendations"
                >
                  <Cover src={b.imageM} size="xs" title={b.title} />
                  <div className="dropdown-info">
                    <div className="t">{b.title}</div>
                    <div className="m">{b.author} · {b.year || 'n/a'} · {b.publisher}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dropdown-empty">No quick suggestions found.</div>
          )}
          <div
            className="dropdown-footer"
            onClick={handleSubmit}
            role="button"
            tabIndex={0}
          >
            <span>🔍 View all search results for “<b>{q.trim()}</b>” →</span>
          </div>
        </div>
      )}
    </div>
  );
}

