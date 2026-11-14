import Cover from './Cover.jsx';
import { FEATURE_LABELS } from './WeightSliders.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

function Bar({ value, cls = '' }) {
  return <div className={`bar ${cls}`}><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>;
}

export default function ResultsRun({
  run,
  compact,
  onPick,
  me = null,
  shelfMap = null,
  onShelfChange = null,
  onRequireAuth = null,
  devMode = false,
}) {
  return (
    <section className="run">
      <div className="run-head">
        <h2>{run.name}</h2>
        {devMode && (
          <span className="m mono dev-meta-pill">
            🔍 {run.meta.candidatesConsidered} candidates · ⏱️ {run.meta.ms} ms · 🛡️ Title: EXCLUDED
          </span>
        )}
      </div>
      {compact && <code className="formula small">{run.formula}</code>}
      {run.results.length === 0 && <div className="m empty-run">No recommendations from this algorithm for this book.</div>}
      <ol className={`results ${compact ? 'compact' : ''}`}>
        {run.results.map((r, i) => (
          <li key={r.book.isbn} className="result" onClick={() => onPick(r.book)} title="Use as new seed">
            <span className="rank">{i + 1}</span>
            <Cover src={r.book.imageM} size={compact ? 'sm' : 'md'} title={r.book.title} />
            <div className="info">
              <div className="t">{r.book.title}</div>
              <div className="m">{r.book.author} · {r.book.year || 'n/a'}{!compact && ` · ${r.book.publisher}`}</div>
              {devMode ? (
                <div className="dev-card-telemetry">
                  <div className="dev-diagnostic-badge">
                    <span className="badge-score">Score: {r.score.toFixed(3)}</span>
                    <span className="badge-title-zero">Title: EXCLUDED (0.00)</span>
                  </div>
                  <div className="score-row">
                    <Bar value={r.score} cls="main" /> <span className="mono">{r.score.toFixed(3)}</span>
                  </div>
                  {!compact && (
                    <div className="features">
                      {Object.entries(r.features).map(([k, v]) => (
                        <div key={k} className="feat">
                          <span>{FEATURE_LABELS[k]}</span>
                          <Bar value={v} />
                          <span className="mono">{v.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="result-actions" onClick={(e) => e.stopPropagation()}>
                <ReadingStatusButton
                  book={r.book}
                  isbn={r.book.isbn}
                  status={shelfMap?.[r.book.isbn]}
                  me={me}
                  onStatusChange={onShelfChange}
                  onRequireAuth={onRequireAuth}
                  size={compact ? 'sm' : 'md'}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
