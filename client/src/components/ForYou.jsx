import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import AlgorithmPicker from './AlgorithmPicker.jsx';
import WeightSliders, { FEATURE_LABELS } from './WeightSliders.jsx';
import HowItWorks from './HowItWorks.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

function Bar({ value, cls = '' }) {
  return <div className={`bar ${cls}`}><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>;
}

// Personalised home page: recommendations aggregated over the user's favourite books.
export default function ForYou({
  me,
  algos,
  weights,
  setWeights,
  onEditFavorites,
  onExplore,
  onToggleWant,
  shelfMap = null,
  onShelfChange = null,
  onRequireAuth = null,
  onSelectBook = null,
}) {
  const [algo, setAlgo] = useState('hybrid');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wantSet = useMemo(() => new Set(me.user.wantToRead), [me.user.wantToRead]);
  const favByIsbn = useMemo(() => Object.fromEntries(me.favorites.map((b) => [b.isbn, b])), [me.favorites]);
  const favKey = me.user.favorites.join(',');

  useEffect(() => {
    if (!weights) return;
    setLoading(true); setError('');
    const t = setTimeout(() => {
      api.forYou(algo, weights).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
    // re-run when favourites or want-to-read change (want-to-read books are excluded)
  }, [algo, weights, favKey, me.user.wantToRead.length]);

  const compare = algo === 'all';
  const current = algos.find((a) => a.key === algo);

  return (
    <section className="foryou">
      <div className="foryou-head">
        <div>
          <h2>Recommended for {me.user.displayName}</h2>
          <p className="m">Built from your {me.favorites.length} favourite books. Switch algorithms to see how each one interprets your taste.</p>
        </div>
      </div>

      <div className="fav-strip card">
        <div className="fav-strip-head">
          <h3>⭐ Your favourites (seeds)</h3>
          <button className="link" onClick={onEditFavorites}>Edit</button>
        </div>
        <div className="fav-list">
          {me.favorites.map((b) => (
            <button key={b.isbn} className="fav-item" onClick={() => onExplore(b)} title="Explore similar books to this one">
              <Cover src={b.imageM} size="sm" title={b.title} />
              <span>{b.title}</span>
            </button>
          ))}
        </div>
      </div>

      <AlgorithmPicker algos={algos} value={algo} onChange={setAlgo} />
      {error && <div className="error">{error}</div>}

      <div className="layout">
        <aside>
          {(algo === 'hybrid' || compare) && weights && <WeightSliders weights={weights} onChange={setWeights} />}
          <section className="card how">
            <h3>How profile recommendations work</h3>
            <ol>
              <li>The selected algorithm runs once for <b>each</b> favourite book.</li>
              <li>Scores are averaged across favourites, so a book liked by several of your seeds ranks higher.</li>
              <li>A light diversity re-rank (×0.85 per repeat) keeps one favourite from dominating.</li>
              <li>Your favourites and “Want to Read” books are excluded.</li>
            </ol>
            {data?.runs?.[0] && !compare && <code className="formula">{data.runs[0].formula}</code>}
          </section>
          {current && <HowItWorks algo={current} />}
        </aside>

        <main className={loading ? 'loading' : ''}>
          {data && (
            <div className={compare ? 'compare' : ''}>
              {data.runs.map((run) => (
                <section key={run.algorithm} className="run">
                  <div className="run-head">
                    <h2>{run.name}</h2>
                    <span className="m mono">{run.meta.candidatesConsidered} candidates · {run.meta.ms} ms</span>
                  </div>
                  {run.results.length === 0 && <div className="m empty-run">No recommendations from this algorithm.</div>}
                  <ol className={`results ${compare ? 'compact' : ''}`}>
                    {run.results.map((r, i) => {
                      const liked = Object.keys(r.contributions).map((isbn) => favByIsbn[isbn]).filter(Boolean);
                      const saved = wantSet.has(r.book.isbn);
                      return (
                        <li key={r.book.isbn} className="result">
                          <span className="rank">{i + 1}</span>
                          <Cover src={r.book.imageM} size={compare ? 'sm' : 'md'} title={r.book.title} />
                          <div className="info">
                            <div
                              className="t clickable"
                              onClick={() => (onSelectBook ? onSelectBook(r.book) : onExplore(r.book))}
                              title="View details or explore similar books"
                            >
                              {r.book.title}
                            </div>
                            <div className="m">{r.book.author} · {r.book.year || 'n/a'}</div>
                            <div className="because">
                              Because you liked {liked.map((b) => <i key={b.isbn}>{b.title.split(/[:(]/)[0].trim()}</i>).reduce((a, el, k) => (k ? [...a, ', ', el] : [el]), [])}
                            </div>
                            <div className="score-row"><Bar value={r.score} cls="main" /> <span className="mono">{r.score.toFixed(3)}</span></div>
                            {!compare && (
                              <div className="features">
                                {Object.entries(r.contributions).map(([isbn, v]) => (
                                  <div key={isbn} className="feat contrib">
                                    <span title={favByIsbn[isbn]?.title}>{(favByIsbn[isbn]?.title || isbn).slice(0, 14)}</span>
                                    <Bar value={v} /><span className="mono">{v.toFixed(2)}</span>
                                  </div>
                                ))}
                                <details>
                                  <summary className="m">Feature breakdown vs. strongest favourite</summary>
                                  {Object.entries(r.features).map(([k, v]) => (
                                    <div key={k} className="feat"><span>{FEATURE_LABELS[k]}</span><Bar value={v} /><span className="mono">{v.toFixed(2)}</span></div>
                                  ))}
                                </details>
                              </div>
                            )}
                            <div className="foryou-item-actions" onClick={(e) => e.stopPropagation()}>
                              <ReadingStatusButton
                                book={r.book}
                                isbn={r.book.isbn}
                                status={shelfMap?.[r.book.isbn] || (saved ? 'want_to_read' : 'none')}
                                me={me}
                                onStatusChange={onShelfChange || onToggleWant}
                                onRequireAuth={onRequireAuth}
                                size="sm"
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
