import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

export default function SearchBar({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => api.search(q).then((r) => { setResults(r); setOpen(true); }).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="search" ref={box}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search by title or author…"
        aria-label="Search books"
      />
      {open && results.length > 0 && (
        <ul className="dropdown">
          {results.map((b) => (
            <li key={b.isbn} onClick={() => { onPick(b); setOpen(false); setQ(b.title); }}>
              <Cover src={b.imageM} size="xs" />
              <div>
                <div className="t">{b.title}</div>
                <div className="m">{b.author} · {b.year || 'n/a'} · {b.publisher}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
