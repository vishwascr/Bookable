import { useEffect, useState } from 'react';
import { api } from './api.js';
import SearchBar from './components/SearchBar.jsx';
import SeedPanel from './components/SeedPanel.jsx';
import AlgorithmPicker from './components/AlgorithmPicker.jsx';
import WeightSliders from './components/WeightSliders.jsx';
import ResultsRun from './components/ResultsRun.jsx';
import HowItWorks from './components/HowItWorks.jsx';

export default function App() {
  const [algos, setAlgos] = useState([]);
  const [weights, setWeights] = useState(null);
  const [algo, setAlgo] = useState('hybrid');
  const [seedIsbn, setSeedIsbn] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.algorithms().then((d) => { setAlgos(d.algorithms); setWeights(d.defaultWeights); }).catch((e) => setError(e.message));
    const poll = () => api.health().then((h) => { setHealth(h); if (!h.ready) setTimeout(poll, 1500); }).catch(() => setTimeout(poll, 2000));
    poll();
  }, []);

  useEffect(() => {
    if (!seedIsbn || !weights) return;
    setLoading(true); setError('');
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

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>📚 Bookable</h1>
          <p className="sub">Explainable book recommendations — pick an algorithm and see <em>why</em> each book was chosen.</p>
        </div>
        {health && (
          <div className={`status ${health.ready ? 'ok' : 'wait'}`}>
            {health.ready ? `${health.stats.books.toLocaleString()} books indexed` : 'Building index…'}
          </div>
        )}
      </header>

      <SearchBar onPick={(b) => setSeedIsbn(b.isbn)} />

      {error && <div className="error">{error}</div>}

      {!seedIsbn && (
        <div className="empty">
          Search for a book you like to get started. Try <b>“Hobbit”</b>, <b>“Harry Potter”</b>, or <b>“Pride and Prejudice”</b>.
        </div>
      )}

      {seedIsbn && (
        <>
          <AlgorithmPicker algos={algos} value={algo} onChange={setAlgo} />
          <div className="layout">
            <aside>
              {data?.seed && <SeedPanel seed={data.seed} />}
              {(algo === 'hybrid' || compare) && weights && <WeightSliders weights={weights} onChange={setWeights} />}
              {current && <HowItWorks algo={current} />}
            </aside>
            <main className={loading ? 'loading' : ''}>
              {data && (
                <div className={compare ? 'compare' : ''}>
                  {data.runs.map((run) => (
                    <ResultsRun key={run.algorithm} run={run} compact={compare} onPick={(b) => setSeedIsbn(b.isbn)} />
                  ))}
                </div>
              )}
            </main>
          </div>
        </>
      )}
      <footer>Data: Books.csv (Book-Crossing dataset) · MERN stack · see /readme for documentation</footer>
    </div>
  );
}
