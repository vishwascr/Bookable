import { useCallback, useEffect, useMemo, useState } from 'react';
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
import SettingsPage from './components/SettingsPage.jsx';
import ReviewModal from './components/ReviewModal.jsx';
import BookDetailModal from './components/BookDetailModal.jsx';
import Mascot from './components/Mascot.jsx';
import AlgorithmCustomizer, { DEFAULT_ALGO_WEIGHTS } from './components/AlgorithmCustomizer.jsx';
import DevDiagnosticsHUD from './components/DevDiagnosticsHUD.jsx';

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

// Views: home | search | explore | login | signup | logout | onboarding | foryou | shelves | settings
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
  const [me, setMe] = useState(null); // { user, favorites, wantToRead, currentlyReading, read, stats }

  // Milestone 3 Modals State
  const [reviewModalBook, setReviewModalBook] = useState(null);
  const [existingReviewForModal, setExistingReviewForModal] = useState(null);
  const [detailModalBook, setDetailModalBook] = useState(null);

  // Milestone 4: Dev Mode & Algorithm Customizer State
  const DEV_MODE_KEY = 'bookable_dev_mode';
  const ALGO_WEIGHTS_KEY = 'bookable_algo_weights';

  const [devMode, setDevMode] = useState(() => {
    try {
      return localStorage.getItem(DEV_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [algoWeights, setAlgoWeights] = useState(() => {
    try {
      const saved = localStorage.getItem(ALGO_WEIGHTS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ALGO_WEIGHTS;
    } catch {
      return DEFAULT_ALGO_WEIGHTS;
    }
  });

  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [serverDiagnostics, setServerDiagnostics] = useState(null);
  const [latestReviewSentiment, setLatestReviewSentiment] = useState(null);

  const toggleDevMode = useCallback(() => {
    setDevMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEV_MODE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleAlgoWeightsChange = useCallback((newWeights) => {
    setAlgoWeights(newWeights);
    try {
      localStorage.setItem(ALGO_WEIGHTS_KEY, JSON.stringify(newWeights));
    } catch {}
  }, []);

  const refreshServerDiagnostics = useCallback(async () => {
    try {
      const diag = await api.getDevDiagnostics();
      setServerDiagnostics(diag);
      return diag;
    } catch (err) {
      console.warn('Diagnostics fetch failed:', err.message);
    }
  }, []);

  useEffect(() => {
    if (devMode) {
      refreshServerDiagnostics();
    }
  }, [devMode, refreshServerDiagnostics]);

  // Computed shelf mapping for fast O(1) status lookup across book cards
  const shelfMap = useMemo(() => {
    if (!me?.user) return {};
    const map = {};
    for (const isbn of me.user.wantToRead || []) map[isbn] = 'want_to_read';
    for (const isbn of me.user.currentlyReading || []) map[isbn] = 'currently_reading';
    for (const isbn of me.user.read || []) map[isbn] = 'read';
    return map;
  }, [me]);

  const totalShelved = useMemo(() => {
    if (!me) return 0;
    if (typeof me.stats?.totalShelved === 'number') return me.stats.totalShelved;
    return (
      (me.user?.wantToRead?.length || 0) +
      (me.user?.currentlyReading?.length || 0) +
      (me.user?.read?.length || 0)
    );
  }, [me]);

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

  const handleShelfChange = useCallback(
    async (isbnOrBook, newStatus, maybeBook = null) => {
      if (!getToken() || !me) {
        setView('login');
        return;
      }

      const bookObj = typeof isbnOrBook === 'object' && isbnOrBook !== null ? isbnOrBook : maybeBook;
      const cleanIsbn = String(bookObj?.isbn || isbnOrBook || '').trim();
      if (!cleanIsbn) return;

      // Auto-open ReviewModal when marking as 'read'
      if (newStatus === 'read') {
        const bookForModal = bookObj || { isbn: cleanIsbn, title: `Book (${cleanIsbn})` };
        setReviewModalBook(bookForModal);
        setExistingReviewForModal(null);
      }

      const prevMe = me;

      // Optimistic state transition
      setMe((prev) => {
        if (!prev?.user) return prev;
        const u = { ...prev.user };
        const filterOut = (arr) => (arr || []).filter((i) => i !== cleanIsbn);

        let nextWant = filterOut(u.wantToRead);
        let nextCurrent = filterOut(u.currentlyReading);
        let nextRead = filterOut(u.read);

        if (newStatus === 'want_to_read') nextWant.unshift(cleanIsbn);
        else if (newStatus === 'currently_reading') nextCurrent.unshift(cleanIsbn);
        else if (newStatus === 'read') nextRead.unshift(cleanIsbn);

        return {
          ...prev,
          user: {
            ...u,
            wantToRead: nextWant,
            currentlyReading: nextCurrent,
            read: nextRead,
          },
          stats: {
            ...prev.stats,
            wantToReadCount: nextWant.length,
            currentlyReadingCount: nextCurrent.length,
            readCount: nextRead.length,
            totalShelved: nextWant.length + nextCurrent.length + nextRead.length,
          },
        };
      });

      try {
        const res = await api.updateShelfStatus(cleanIsbn, newStatus);
        if (res?.shelves) {
          setMe((prev) => {
            if (!prev?.user) return prev;
            return {
              ...prev,
              user: {
                ...prev.user,
                wantToRead: res.shelves.wantToRead,
                currentlyReading: res.shelves.currentlyReading,
                read: res.shelves.read,
              },
              stats: {
                ...prev.stats,
                wantToReadCount: res.shelves.wantToRead.length,
                currentlyReadingCount: res.shelves.currentlyReading.length,
                readCount: res.shelves.read.length,
                totalShelved:
                  res.shelves.wantToRead.length +
                  res.shelves.currentlyReading.length +
                  res.shelves.read.length,
              },
            };
          });
        }
        if (view === 'shelves') {
          refreshMe();
        }
      } catch (err) {
        setMe(prevMe);
        setError(err.message || 'Failed to update shelf');
      }
    },
    [me, view, refreshMe]
  );

  const handleOpenReview = (book, existingReview = null) => {
    setReviewModalBook(book);
    setExistingReviewForModal(existingReview);
  };

  const handleSelectBook = (book) => {
    setDetailModalBook(book);
  };

  const handleReviewSaved = async () => {
    await refreshMe();
  };

  const toggleWant = async (book, saved) => {
    return handleShelfChange(book, saved ? 'none' : 'want_to_read');
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

          {/* Milestone 4: Top Action Controls Bar */}
          <div className="top-controls-group">
            <button
              type="button"
              className={`btn-algo-toggle ${customizerOpen ? 'active' : ''}`}
              onClick={() => setCustomizerOpen((prev) => !prev)}
              aria-expanded={customizerOpen}
              title="Customize recommendation heuristic parameters"
            >
              <span>⚙️</span>
              <span>Customize Algorithm</span>
              <span className="toggle-caret">{customizerOpen ? '▴' : '▾'}</span>
            </button>

            <button
              type="button"
              className={`dev-mode-toggle-btn ${devMode ? 'active' : ''}`}
              onClick={toggleDevMode}
              aria-pressed={devMode}
              title={
                devMode
                  ? 'Dev Mode is ON — Click to switch to standard clean Goodreads browsing'
                  : 'Dev Mode is OFF — Click to view diagnostic HUD & internal telemetry'
              }
            >
              <span className="dev-toggle-icon">🛠️</span>
              <span className="dev-toggle-text">Dev Mode:</span>
              <span className={`dev-toggle-badge ${devMode ? 'on' : 'off'}`}>
                {devMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

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
                My Books{totalShelved > 0 ? ` (${totalShelved})` : ''}
              </button>
              <button
                className={view === 'settings' ? 'active' : ''}
                onClick={() => setView('settings')}
                title="Account & Library Settings"
              >
                ⚙️ Settings
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

      {/* Milestone 4: Collapsible Algorithm Customizer Drawer */}
      <AlgorithmCustomizer
        isOpen={customizerOpen}
        weights={algoWeights}
        onChange={handleAlgoWeightsChange}
        onToggle={() => setCustomizerOpen((prev) => !prev)}
        onClose={() => setCustomizerOpen(false)}
      />

      {/* Milestone 4: Dev Mode Diagnostics HUD */}
      {devMode && (
        <DevDiagnosticsHUD
          isOpen={!hudCollapsed}
          onToggleCollapse={() => setHudCollapsed((c) => !c)}
          onClose={() => setDevMode(false)}
          currentWeights={algoWeights}
          latestRecRun={data?.runs?.[0] || null}
          latestReviewSentiment={latestReviewSentiment}
          serverDiagnostics={serverDiagnostics}
          onRefreshDiagnostics={refreshServerDiagnostics}
        />
      )}

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
          algoWeights={algoWeights}
          devMode={devMode}
          onEditFavorites={() => setView('onboarding')}
          onExplore={explore}
          onToggleWant={handleShelfChange}
          shelfMap={shelfMap}
          onShelfChange={handleShelfChange}
          onRequireAuth={() => setView('login')}
          onSelectBook={handleSelectBook}
        />
      )}

      {/* VIEW: Shelves (Overhauled 5 Tabs) */}
      {view === 'shelves' && me && (
        <Shelves
          me={me}
          onExplore={explore}
          onSelectBook={handleSelectBook}
          onOpenReview={handleOpenReview}
          onStatusChange={handleShelfChange}
          onShelfChange={handleShelfChange}
          onEditFavorites={() => setView('onboarding')}
          onToggleWant={handleShelfChange}
        />
      )}

      {/* VIEW: Settings Page */}
      {view === 'settings' && me && (
        <SettingsPage
          me={me}
          onRefreshMe={refreshMe}
          onGoHome={goHome}
        />
      )}

      {/* VIEW: Search Results Page */}
      {view === 'search' && searchQuery && (
        <SearchResults
          query={searchQuery}
          onSelectSeed={explore}
          onClearSearch={goHome}
          me={me}
          shelfMap={shelfMap}
          onShelfChange={handleShelfChange}
          onRequireAuth={() => setView('login')}
          onSelectBook={handleSelectBook}
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
              {data?.seed && (
                <SeedPanel
                  seed={data.seed}
                  me={me}
                  shelfMap={shelfMap}
                  onShelfChange={handleShelfChange}
                  onRequireAuth={() => setView('login')}
                />
              )}
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
                      me={me}
                      shelfMap={shelfMap}
                      onShelfChange={handleShelfChange}
                      onRequireAuth={() => setView('login')}
                      devMode={devMode}
                    />
                  ))}
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {/* Global Modals */}
      {reviewModalBook && (
        <ReviewModal
          book={reviewModalBook}
          existingReview={existingReviewForModal}
          onClose={() => {
            setReviewModalBook(null);
            setExistingReviewForModal(null);
          }}
          onReviewSaved={handleReviewSaved}
          onSentimentAnalyzed={setLatestReviewSentiment}
          devMode={devMode}
        />
      )}

      {detailModalBook && (
        <BookDetailModal
          book={detailModalBook}
          me={me}
          onClose={() => setDetailModalBook(null)}
          onExplore={explore}
          onSelectSeed={explore}
          onOpenReview={handleOpenReview}
          onStatusChange={handleShelfChange}
          onShelfChange={handleShelfChange}
          devMode={devMode}
        />
      )}

      <footer>
        Data: Books.csv (Book-Crossing dataset) · MERN stack · see /readme for documentation
      </footer>
    </div>
  );
}

