import { useEffect, useState } from 'react';
import { api } from './api.js';
import SearchBar from './components/SearchBar.jsx';
import SearchResults from './components/SearchResults.jsx';
import SeedPanel from './components/SeedPanel.jsx';
import AlgorithmPicker from './components/AlgorithmPicker.jsx';
import WeightSliders from './components/WeightSliders.jsx';
import ResultsRun from './components/ResultsRun.jsx';
import HowItWorks from './components/HowItWorks.jsx';

const SAMPLE_SEARCHES = [
  'Hobbit',
  'Harry Potter',
  'Pride and Prejudice',
  'Stephen King',
  'Dune',
  'Tolkien',
  'George Orwell',
  'Agatha Christie',
];

export default function App() {
  const [algos, setAlgos] = useState([]);
  const [weights, setWeights] = useState(null);
  const [algo, setAlgo] = useState('hybrid');
  const [searchQuery, setSearchQuery] = useState('');
  const [seedIsbn, setSeedIsbn] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.algorithms()
      .then((d) => {
        setAlgos(d.algorithms);
        setWeights(d.defaultWeights);
      })
      .catch((e) => setError(e.message));

    const poll = () =>
      api.health()
        .then((h) => {
          setHealth(h);
          if (!h.ready) setTimeout(poll, 1500);
        })
        .catch(() => setTimeout(poll, 2000));
    poll();
  }, []);

  useEffect(() => {
    if (!seedIsbn || !weights) return;
    setLoading(true);
    setError('');
    const t = setTimeout(() => {
      api.recommend(seedIsbn, algo, weights)
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 150); // debounce slider drags
    return () => clearTimeout(t);
  }, [seedIsbn, algo, weights]);

  const compare = algo === 'all';
  const current = algos.find((a) => a.key === algo);

  const handleSearchSubmit = (q) => {
    setSearchQuery(q);
    setSeedIsbn(null); // Return to search results page
  };

  const handleDirectPick = (b) => {
    setSeedIsbn(b.isbn);
  };

  const handleResetToHome = () => {
    setSeedIsbn(null);
    setSearchQuery('');
    setData(null);
  };

  return (
    <div className="app">
      <header className="top">
        <div className="branding" onClick={handleResetToHome} title="Go to home">
          <h1>📚 Bookable</h1>
          <p className="sub">
            Explainable book recommendations — pick an algorithm and see <em>why</em> each book was chosen.
          </p>
        </div>
        {health && (
          <div className={`status ${health.ready ? 'ok' : 'wait'}`}>
            {health.ready
              ? `${health.stats.books.toLocaleString()} books indexed`
              : 'Building index…'}
          </div>
        )}
      </header>

      <SearchBar
        onPick={handleDirectPick}
        onSearch={handleSearchSubmit}
        currentQuery={searchQuery}
      />

      {error && <div className="error">{error}</div>}

      {/* VIEW 1: Initial Empty State with Sample Searches */}
      {!seedIsbn && !searchQuery && (
        <section className="empty-state-hero">
          <div className="hero-content">
            <h2>Find books & discover algorithms</h2>
            <p>
              Type any title or author in the search bar and press <kbd>Enter</kbd> to explore search results, or click a suggestion below:
            </p>
            <div className="sample-pills">
              {SAMPLE_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="sample-pill"
                  onClick={() => handleSearchSubmit(term)}
                >
                  🔍 {term}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VIEW 2: Dedicated Search Results Page */}
      {!seedIsbn && searchQuery && (
        <SearchResults
          query={searchQuery}
          onSelectSeed={(b) => setSeedIsbn(b.isbn)}
          onClearSearch={handleResetToHome}
        />
      )}

      {/* VIEW 3: Book Recommendations View */}
      {seedIsbn && (
        <>
          <nav className="recommendation-breadcrumbs" aria-label="Navigation breadcrumb">
            {searchQuery ? (
              <button
                className="breadcrumb-btn"
                onClick={() => setSeedIsbn(null)}
              >
                ← Back to Search Results for “{searchQuery}”
              </button>
            ) : (
              <button
                className="breadcrumb-btn"
                onClick={handleResetToHome}
              >
                ← Start New Search
              </button>
            )}
            <span className="breadcrumb-current">
              Viewing recommendations for <b>{data?.seed?.book?.title || 'Selected Book'}</b>
            </span>
          </nav>

          <AlgorithmPicker algos={algos} value={algo} onChange={setAlgo} />

          <div className="layout">
            <aside>
              {data?.seed && <SeedPanel seed={data.seed} />}
              {(algo === 'hybrid' || compare) && weights && (
                <WeightSliders weights={weights} onChange={setWeights} />
              )}
              {current && <HowItWorks algo={current} />}
            </aside>
            <main className={loading ? 'loading' : ''}>
              {data && (
                <div className={compare ? 'compare' : ''}>
                  {data.runs.map((run) => (
                    <ResultsRun
                      key={run.algorithm}
                      run={run}
                      compact={compare}
                      onPick={(b) => setSeedIsbn(b.isbn)}
                    />
                  ))}
                </div>
              )}
            </main>
          </div>
        </>
      )}

      <footer>
        Data: Books.csv (Book-Crossing dataset) · MERN stack · see /readme for documentation
      </footer>
    </div>
  );
}

