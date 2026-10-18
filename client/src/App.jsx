import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import SearchBar from './components/SearchBar.jsx';
import SearchResults from './components/SearchResults.jsx';
import SeedPanel from './components/SeedPanel.jsx';
import AlgorithmPicker from './components/AlgorithmPicker.jsx';
import WeightSliders from './components/WeightSliders.jsx';
import ResultsRun from './components/ResultsRun.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import AuthPage from './components/AuthPage.jsx';
import LogoutPage from './components/LogoutPage.jsx';
import Onboarding from './components/Onboarding.jsx';
import ForYou from './components/ForYou.jsx';
import Shelves from './components/Shelves.jsx';
import Mascot from './components/Mascot.jsx';

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

// Views: home | search | explore | login | signup | logout | onboarding | foryou | shelves
export default function App() {
  const [algos, setAlgos] = useState([]);
  const [weights, setWeights] = useState(null);
  const [algo, setAlgo] = useState('hybrid');
  const [view, setView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [seedIsbn, setSeedIsbn] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [me, setMe] = useState(null); // { user, favorites, wantToRead }

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return null;
    }
    try {
      const m = await api.me();
      setMe(m);
      return m;
    } catch (e) {
      if (e.status === 401) {
        setToken(null);
        setMe(null);
      }
      return null;
    }
  }, []);

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
          if (!h.ready) {
            setTimeout(poll, 1500);
          } else {
            refreshMe().then((m) => {
              if (m) {
                setView(m.user.onboarded ? 'foryou' : 'onboarding');
              }
            });
          }
        })
        .catch(() => setTimeout(poll, 2000));
    poll();
  }, [refreshMe]);

  useEffect(() => {
    if (view !== 'explore' || !seedIsbn || !weights) return;
    setLoading(true);
    setError('');
    const t = setTimeout(() => {
      api.recommend(seedIsbn, algo, weights)
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
  }, [view, seedIsbn, algo, weights]);

  const explore = (b) => {
    setSeedIsbn(b.isbn);
    setView('explore');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = () => {
    setSearchQuery('');
    setSeedIsbn(null);
    setData(null);
    setView(me?.user.onboarded ? 'foryou' : 'home');
  };

  const goHomeGuest = () => {
    setSearchQuery('');
    setSeedIsbn(null);
    setData(null);
    setView('home');
  };

  const handleLogout = () => {
    setToken(null);
    setMe(null);
    setSeedIsbn(null);
    setSearchQuery('');
    setView('logout');
  };

  const onAuthed = async (user, isNew) => {
    const m = await refreshMe();
    setView(isNew || !m?.user?.onboarded ? 'onboarding' : 'foryou');
  };

  const toggleWant = async (book, saved) => {
    try {
      if (saved) {
        await api.removeWant(book.isbn);
      } else {
        await api.addWant(book.isbn);
      }
      await refreshMe();
    } catch (e) {
      setError(e.message);
    }
  };

  const compare = algo === 'all';
  const current = algos.find((a) => a.key === algo);

  return (
    <div className="app">
      <header className="top">
        <div className="branding" onClick={goHome} title="Return to Home">
          <h1>📚 Bookable</h1>
          <p className="sub">
            Explainable book recommendations — pick an algorithm and see <em>why</em> each book was chosen.
          </p>
        </div>
        <div className="top-right">
          {health && (
            <div className={`status ${health.ready ? 'ok' : 'wait'}`}>
              {health.ready
                ? `${health.stats.books.toLocaleString()} books indexed`
                : 'Building index…'}
            </div>
          )}
          {me ? (
            <nav className="user-nav" aria-label="User account navigation">
              {me.user.onboarded && (
                <button
                  className={view === 'foryou' ? 'active' : ''}
                  onClick={() => setView('foryou')}
                >
                  For You
                </button>
              )}
              <button
                className={view === 'shelves' ? 'active' : ''}
                onClick={() => setView('shelves')}
              >
                My Books{me.wantToRead.length ? ` (${me.wantToRead.length})` : ''}
              </button>
              <span className="avatar" title={`Signed in as @${me.user.username}`}>
                {(me.user.displayName || me.user.username).slice(0, 1).toUpperCase()}
              </span>
              <button className="link muted" onClick={handleLogout}>
                Log out
              </button>
            </nav>
          ) : (
            <nav className="user-nav" aria-label="Guest navigation">
              <button
                className={view === 'login' ? 'active' : ''}
                onClick={() => setView('login')}
              >
                Log in
              </button>
              <button
                className={`btn-primary sm ${view === 'signup' ? 'active' : ''}`}
                onClick={() => setView('signup')}
              >
                Sign up
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Global search bar visible on browse / content pages */}
      {!['login', 'signup', 'logout', 'onboarding'].includes(view) && (
        <SearchBar
          onPick={explore}
          onSearch={(q) => {
            setSearchQuery(q);
            setView('search');
          }}
          currentQuery={searchQuery}
        />
      )}

      {error && (
        <div className="error" onClick={() => setError('')} title="Click to dismiss">
          {error}
        </div>
      )}

      {/* VIEW: Public Home / Landing */}
      {view === 'home' && (
        <section className="empty-state-hero">
          <div className="hero-content">
            <div className="mascot-slot hero-mascot-wrap">
              <Mascot size="lg" />
            </div>
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
                  onClick={() => {
                    setSearchQuery(term);
                    setView('search');
                  }}
                >
                  🔍 {term}
                </button>
              ))}
            </div>
            {!me && (
              <div className="hero-cta">
                <p>
                  <b>Want recommendations tailored to your taste?</b> Create a free account, pick 3–5 books you love, and compare how multiple algorithms interpret your profile.
                </p>
                <button className="btn-primary" onClick={() => setView('signup')}>
                  Create a free account →
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW: Login Page */}
      {view === 'login' && (
        <AuthPage
          key="login"
          mode="login"
          onAuthed={onAuthed}
          onCancel={goHomeGuest}
        />
      )}

      {/* VIEW: Sign Up Page */}
      {view === 'signup' && (
        <AuthPage
          key="signup"
          mode="signup"
          onAuthed={onAuthed}
          onCancel={goHomeGuest}
        />
      )}

      {/* VIEW: Dedicated Logout Page */}
      {view === 'logout' && (
        <LogoutPage
          onGoLogin={() => setView('login')}
          onGoHome={goHomeGuest}
        />
      )}

      {/* VIEW: Onboarding (Pick 3-5 favorite books) */}
      {view === 'onboarding' && me && (
        <Onboarding
          initial={me.favorites}
          editing={me.user.onboarded}
          onCancel={me.user.onboarded ? () => setView('foryou') : null}
          onDone={async () => {
            await refreshMe();
            setView('foryou');
          }}
        />
      )}

      {/* VIEW: For You (Personalized Recommendations) */}
      {view === 'foryou' && me?.user?.onboarded && (
        <ForYou
          me={me}
          algos={algos}
          weights={weights}
          setWeights={setWeights}
          onEditFavorites={() => setView('onboarding')}
          onExplore={explore}
          onToggleWant={toggleWant}
        />
      )}

      {/* VIEW: Shelves (Favorites & Want to Read) */}
      {view === 'shelves' && me && (
        <Shelves
          me={me}
          onExplore={explore}
          onToggleWant={toggleWant}
          onEditFavorites={() => setView('onboarding')}
        />
      )}

      {/* VIEW: Search Results Page */}
      {view === 'search' && searchQuery && (
        <SearchResults
          query={searchQuery}
          onSelectSeed={explore}
          onClearSearch={goHome}
        />
      )}

      {/* VIEW: Single Book Explorer & Recommendations */}
      {view === 'explore' && seedIsbn && (
        <>
          <nav className="recommendation-breadcrumbs" aria-label="Navigation breadcrumb">
            {searchQuery ? (
              <button className="breadcrumb-btn" onClick={() => setView('search')}>
                ← Back to Search Results for “{searchQuery}”
              </button>
            ) : (
              <button className="breadcrumb-btn" onClick={goHome}>
                ← {me?.user?.onboarded ? 'Back to For You' : 'Start New Search'}
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
                      onPick={explore}
                      wantSet={me ? new Set(me.user.wantToRead) : null}
                      onToggleWant={me ? toggleWant : null}
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

