import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

export default function ThreeSeedSelector({
  weights,
  me,
  shelfMap,
  onShelfChange,
  onRequireAuth,
  onSelectBook,
  devMode = false,
}) {
  const [seeds, setSeeds] = useState([]); // array of 3 books
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSlot, setActiveSlot] = useState(null);

  // Auto-seed with user's top 3 favorites on initial mount if empty
  useEffect(() => {
    if (seeds.length === 0 && me?.favorites && me.favorites.length >= 3) {
      setSeeds(me.favorites.slice(0, 3));
    }
  }, [me]);

  // Debounced 3-seed recommendation query triggered whenever seeds or weights change
  useEffect(() => {
    if (seeds.length !== 3 || seeds.some((s) => !s?.isbn)) {
      setRecommendations(null);
      return;
    }

    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const isbns = seeds.map((s) => s.isbn);
        const res = await api.recommendThree(isbns, weights, 12);
        setRecommendations(res);
      } catch (err) {
        setError(err.message || 'Failed to fetch 3-seed recommendations');
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [seeds, weights]);

  // Quick seed search handler
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.searchPaginated(searchQuery.trim(), 1, 8);
        setSearchResults(Array.isArray(res) ? res : res?.books || []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handlePickBookForSlot = (book, slotIdx) => {
    const next = [...seeds];
    // Avoid duplicate seed ISBNs
    if (next.some((s, i) => i !== slotIdx && s?.isbn === book.isbn)) {
      setError(`"${book.title}" is already selected as a seed.`);
      return;
    }
    next[slotIdx] = book;
    setSeeds(next);
    setActiveSlot(null);
    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  const handleRemoveSlot = (slotIdx) => {
    const next = seeds.filter((_, i) => i !== slotIdx);
    setSeeds(next);
    setRecommendations(null);
  };

  const handleUseFavorites = () => {
    if (me?.favorites && me.favorites.length >= 3) {
      setSeeds(me.favorites.slice(0, 3));
      setError('');
    } else {
      setError('You need at least 3 favourite books shelved.');
    }
  };

  return (
    <section className="three-seed-selector-section card">
      <div className="three-seed-head">
        <div>
          <h2>🎯 3-Book Recommendation Engine</h2>
          <p className="section-desc">
            Select 3 seed books to discover tailored suggestions using author, genre, tag, and rating heuristics.
          </p>
        </div>
        {me?.favorites?.length >= 3 && (
          <button type="button" className="btn-secondary sm" onClick={handleUseFavorites}>
            ⭐ Use Top 3 Favourites
          </button>
        )}
      </div>

      {/* 3 Seed Slots Grid */}
      <div className="seed-slots-grid">
        {[0, 1, 2].map((slotIdx) => {
          const book = seeds[slotIdx];
          return (
            <div key={slotIdx} className={`seed-slot ${book ? 'filled' : 'empty'}`}>
              <div className="slot-badge">Seed #{slotIdx + 1}</div>
              {book ? (
                <div className="seed-slot-content">
                  <Cover src={book.imageM || book.imageS} size="md" title={book.title} />
                  <div className="seed-slot-info">
                    <div className="seed-slot-title" title={book.title}>{book.title}</div>
                    <div className="seed-slot-author">{book.author}</div>
                    <button
                      type="button"
                      className="btn-remove-seed"
                      onClick={() => handleRemoveSlot(slotIdx)}
                    >
                      ✕ Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="seed-slot-placeholder">
                  <button
                    type="button"
                    className="btn-add-seed"
                    onClick={() => setActiveSlot(slotIdx)}
                  >
                    + Pick Seed #{slotIdx + 1}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot Search Popover / Drawer if picking a slot */}
      {activeSlot !== null && (
        <div className="slot-picker-drawer card">
          <div className="slot-picker-header">
            <h4>Select Book for Seed #{activeSlot + 1}</h4>
            <button className="link" onClick={() => setActiveSlot(null)}>Close</button>
          </div>
          <input
            type="text"
            className="slot-search-input"
            placeholder="Type book title or author to search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className="slot-results-list">
            {searchResults.map((b) => (
              <div
                key={b.isbn}
                className="slot-result-item"
                onClick={() => handlePickBookForSlot(b, activeSlot)}
              >
                <Cover src={b.imageS || b.imageM} size="xs" />
                <div className="slot-result-info">
                  <b>{b.title}</b>
                  <span>{b.author} · {b.year || 'n/a'}</span>
                </div>
                <button className="btn-primary sm">Select</button>
              </div>
            ))}
            {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="m">No matching books found.</div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Recommendations Candidates Display */}
      {loading && <div className="loading-spinner">Generating tailored recommendations…</div>}

      {recommendations?.candidates && (
        <div className="three-seed-results">
          <div className="results-meta-header">
            <h3>Recommendations ({recommendations.candidates.length})</h3>
            {devMode && (
              <span className="mono dev-meta-pill">
                Evaluated {recommendations.diagnostics?.candidatesEvaluated || 0} candidates in {recommendations.diagnostics?.queryTimeMs}ms · 🛡️ Title: EXCLUDED
              </span>
            )}
          </div>

          <div className="three-seed-candidates-grid">
            {recommendations.candidates.map((cand, idx) => (
              <article key={cand.isbn} className="candidate-card card">
                <span className="candidate-rank">#{idx + 1}</span>
                <div className="candidate-cover-wrap" onClick={() => onSelectBook?.(cand)}>
                  <Cover src={cand.imageM || cand.imageL} size="md" title={cand.title} />
                </div>
                <div className="candidate-details">
                  <h4 className="candidate-title clickable" onClick={() => onSelectBook?.(cand)}>
                    {cand.title}
                  </h4>
                  <div className="candidate-author">{cand.author} · {cand.year || 'n/a'}</div>
                  <p className="candidate-explanation">💡 {cand.explanation}</p>

                  {devMode && (
                    <div className="candidate-score-bar">
                      <span className="mono score-tag">Score: {cand.score.toFixed(3)}</span>
                      <span className="match-tag">Matched {cand.matchedSeeds}/3 seeds</span>
                    </div>
                  )}

                  {/* Dev Mode Feature Breakdown Badges */}
                  {devMode && cand.features && (
                    <div className="dev-feature-chips">
                      <span className="dev-chip">🎭 Genre: {cand.features.genre?.toFixed(2)}</span>
                      <span className="dev-chip">✍️ Author: {cand.features.author?.toFixed(2)}</span>
                      <span className="dev-chip">🏷️ Tag: {cand.features.tag?.toFixed(2)}</span>
                      <span className="dev-chip">⭐ Rating: {cand.features.rating?.toFixed(2)}</span>
                      <span className="dev-chip excluded">Title: 0.00 (Excl)</span>
                    </div>
                  )}

                  <div className="candidate-actions">
                    <ReadingStatusButton
                      book={cand}
                      isbn={cand.isbn}
                      status={shelfMap?.[cand.isbn] || 'none'}
                      me={me}
                      onStatusChange={onShelfChange}
                      onRequireAuth={onRequireAuth}
                      size="sm"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
