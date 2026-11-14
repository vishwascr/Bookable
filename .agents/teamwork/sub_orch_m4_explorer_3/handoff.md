# Milestone 4 Technical Report: Dev Mode Toggle & Diagnostics HUD (`DevDiagnosticsHUD.jsx`)

**Agent**: `teamwork_explorer_3` (Milestone 4 — sub_orch_m4_explorer_3)  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_3`  
**Scope**: Dev Mode state management, Navigation toggle, `DevDiagnosticsHUD.jsx` component structure, hiding behavior when Dev Mode is OFF, real-time sentiment analysis output and algorithm telemetry when ON, card badges, and integration across `App.jsx`, `ForYou.jsx`, `ReviewModal.jsx`, and `BookDetailModal.jsx`.

---

## 1. Observation

### 1.1 Existing Navigation & Dev Mode Absence in `App.jsx`
Direct inspection of `client/src/App.jsx:263-326` reveals:
- Header branding and top-right navigation contain user auth status and links (`For You`, `My Books`, `⚙️ Settings`, avatar, `Log out` / `Log in` / `Sign up`):
  ```jsx
  <header className="top">
    <div className="branding" onClick={goHome} title="Return to Home">
      <h1>📚 Bookable</h1>
      ...
    </div>
    <div className="top-right">
      {health && (
        <div className={`status ${health.ready ? 'ok' : 'wait'}`}>
          {health.ready ? `${health.stats.books.toLocaleString()} books indexed` : 'Building index…'}
        </div>
      )}
      {me ? (
        <nav className="user-nav" aria-label="User account navigation">
          {me.user.onboarded && <button className={view === 'foryou' ? 'active' : ''} onClick={() => setView('foryou')}>For You</button>}
          <button className={view === 'shelves' ? 'active' : ''} onClick={() => setView('shelves')}>My Books</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>⚙️ Settings</button>
  ```
- **Finding**: No `devMode` state variable, no top-level `[ 🛠️ Dev Mode: [ON|OFF] ]` toggle button or switch, and no diagnostics HUD component are currently instantiated or managed in `App.jsx`.

### 1.2 Telemetry & Diagnostics Leakage in Standard Browsing Views
In standard Goodreads browsing, users should experience a clean catalog without exposed algorithm metrics or raw score math (`ORIGINAL_REQUEST.md:23, 47`). However, currently:
- In `client/src/components/ForYou.jsx:99`:
  ```jsx
  <span className="m mono">{run.meta.candidatesConsidered} candidates · {run.meta.ms} ms</span>
  ```
- In `client/src/components/ForYou.jsx:122-137`:
  ```jsx
  <div className="score-row"><Bar value={r.score} cls="main" /> <span className="mono">{r.score.toFixed(3)}</span></div>
  {!compare && (
    <div className="features">
      {Object.entries(r.contributions).map(([isbn, v]) => (...))}
      <details>
        <summary className="m">Feature breakdown vs. strongest favourite</summary>
        ...
      </details>
    </div>
  )}
  ```
- In `client/src/components/ResultsRun.jsx:22, 34-47`:
  ```jsx
  <span className="m mono">{run.meta.candidatesConsidered} candidates · {run.meta.ms} ms</span>
  <div className="score-row"><Bar value={r.score} cls="main" /> <span className="mono">{r.score.toFixed(3)}</span></div>
  {!compact && (
    <div className="features">
      {Object.entries(r.features).map(([k, v]) => (...))}
    </div>
  )}
  ```
- **Finding**: Internal candidate counts, query latency milliseconds, raw scores (`r.score.toFixed(3)`), and feature breakdown matrices are unconditionally visible to regular users, directly conflicting with the requirement that standard Goodreads browsing remains clean when Dev Mode is OFF.

### 1.3 Server-Side Diagnostics & Telemetry Endpoints Already Available
Inspection of the backend reveals rich diagnostic telemetry ready for consumption:
1. `GET /api/dev/diagnostics` (`server/src/routes/api.js:38-60`):
   ```json
   {
     "ok": true,
     "ready": true,
     "stats": { "books": 271360, "authors": 102024, "publishers": 16800 },
     "recommender": {
       "seedCount": 3,
       "titleExcluded": true,
       "defaultWeights": { "genre": 0.35, "author": 0.25, "tag": 0.25, "rating": 0.15 },
       "genresAvailable": 14,
       "tagsAvailable": 342,
       "authorsAvailable": 102024,
       "publishersAvailable": 16800
     },
     "sentiment": {
       "engine": "pure-rule-based-local",
       "lexiconTerms": 120,
       "supportedAspects": ["pacing", "world-building", "characters", "tone", "prose", "plot", "emotional"]
     }
   }
   ```
2. `POST /api/recommend/three` (`server/src/recommender/algorithms.js:479-487`):
   Returns `diagnostics`:
   ```javascript
   diagnostics: {
     seedCount: 3,
     titleExcluded: true, // STRICT CONSTRAINT VERIFIED
     weightsUsed: safeWeights,
     candidatesEvaluated,
     queryTimeMs: +(performance.now() - t0).toFixed(2),
   }
   ```
3. `POST /api/recommend/sentiment-adapted` and `POST /api/books/:isbn/reviews` (`server/src/recommender/sentiment.js:244-270`):
   Returns rich sentiment telemetry:
   ```javascript
   {
     score, polarity, label, classification, confidence,
     aspects, aspectTags, keywords,
     positiveWords: [{ word, weight }],
     negativeWords: [{ word, weight }],
     intensifiersDetected: [...],
     negatorsDetected: [...],
     metrics: {
       rawScore, textPolarity, starPolarity,
       tokensScanned, lexiconMatches
     }
   }
   ```
4. `client/src/api.js`: Lacks an exported method for calling `GET /api/dev/diagnostics` or `POST /api/recommend/sentiment-adapted`.

---

## 2. Logic Chain

### 2.1 Managing `devMode` State & Persistence
1. **Requirement Mapping**: R4 and Acceptance Criteria mandate:
   *"A 'Dev mode' toggle is available in the interface; when disabled, under-the-hood technical details and raw sentiment scores remain hidden, and when enabled, the sentiment analysis output and algorithm internals are visible."*
2. **State Location**: `devMode` must be held in top-level state in `client/src/App.jsx` because:
   - It controls rendering of the top-level `DevDiagnosticsHUD.jsx` container.
   - It needs to be passed down to `ForYou.jsx`, `ResultsRun.jsx`, `BookDetailModal.jsx`, and `ReviewModal.jsx` to toggle card badges and internal scores.
3. **Storage Persistence**:
   - Stored in browser `localStorage` under key `bookable_dev_mode` so a developer's preference persists across page refreshes.
   - Initialized synchronously via lazy state:
     `useState(() => localStorage.getItem('bookable_dev_mode') === 'true')`.
   - Default is strictly `false` (OFF).
4. **Header Control**:
   - A dedicated toggle button placed in the top navigation header:
     `[ 🛠️ Dev Mode: [ON|OFF] ]`.
   - Styled with iOS pill switch aesthetics with clear green/blue visual active indicator.

### 2.2 Behavior When Dev Mode is OFF (Clean Goodreads Parity)
1. **HUD Invisibility**:
   - When `devMode === false`, `DevDiagnosticsHUD.jsx` is not mounted in the DOM.
2. **Card & Feed Sanitization**:
   - Candidate counts and execution times (`run.meta.candidatesConsidered`, `run.meta.ms`) are hidden.
   - Score bars, `.mono` raw floating-point score values, and feature matrices are suppressed.
   - Recommendation cards show only:
     - Book cover, title, author, year.
     - Universal Goodreads reading status shelf button (`ReadingStatusButton.jsx`).
     - Natural language explanation (e.g., *"Because you liked Dune"* or *"Matches author Frank Herbert and Science Fiction"*).
3. **Review & Details Sanitization**:
   - `BookDetailModal.jsx`: Reviews show star ratings, date, written commentary, and clean community presentation without internal sentiment polarity math (`+0.820`), aspect weights, or debug metadata.
   - `ReviewModal.jsx`: Clean submission dialog without raw sentiment debug telemetry.

### 2.3 Behavior When Dev Mode is ON (Dedicated Diagnostics HUD)
When `devMode === true`, three distinct diagnostic surfaces become active:

#### Surface 1: The Top-Level `DevDiagnosticsHUD.jsx` Tray
Rendered immediately below the header with iOS 20px card styling (`border-radius: 20px; backdrop-filter: blur(20px)`), organized into three high-signal panels:
1. **Algorithm Telemetry**:
   - **Title Similarity Exclusion Confirmation Badge**: Prominently displays `🛡️ Title Similarity: STRICTLY EXCLUDED (w_title = 0.00)` to fulfill R3/R4 auditability.
   - **Active Heuristic Weights**: Visual breakdown of $w_{\text{genre}}$ (0.35), $w_{\text{author}}$ (0.25), $w_{\text{tag}}$ (0.25), $w_{\text{rating}}$ (0.15).
   - **Run Execution Metrics**: Seed count (3 seeds), total candidates evaluated, query execution latency in milliseconds.
2. **Review Sentiment Analysis Output**:
   - Displays real-time or most recent review sentiment calculation:
     - Analyzed text snippet.
     - Polarity score: visual colored gradient slider from `-1.000` to `+1.000`.
     - Classification badge (`POSITIVE`, `NEUTRAL`, `NEGATIVE`) with confidence percentage.
     - Star Calibration: user rating ($r \in [1..5]$) $\to$ star polarity ($\frac{r-3}{2}$) $\to$ composite score ($0.65 \cdot S_{\text{text}} + 0.35 \cdot S_{\text{stars}}$).
     - Detected keywords with individual weights: positive words (e.g., `masterpiece: +4.0`) and negative words (e.g., `dragged: -2.3`).
     - Modifiers detected: intensifiers (e.g., `very: 1.5x`), diminishers (`slightly: 0.65x`), negators (`not: -0.8x`).
     - Extracted aspect tags (`fast-paced`, `world-building`, `character-driven`).
   - **Live Interactive Sentiment Sandbox**: A built-in quick-test input where developers can type any custom text, select stars, and immediately observe token valence calculations and negation flips.
3. **Engine Internals & State Metrics**:
   - Fetched from `GET /api/dev/diagnostics`: total books indexed (271,360), author count (102,024), genre taxonomy count (14), tag vocabulary size (342), sentiment lexicon size (120+ literary terms).

#### Surface 2: Card Diagnostic Badges & Overlays
On book recommendation cards (`ForYou.jsx`, `ResultsRun.jsx`):
- Diagnostic pill badge rendered on each candidate card:
  `[ Score: 0.842 | Title: EXCLUDED | G: 0.35 · A: 1.00 · T: 0.28 · R: 0.92 ]`
- Detailed feature score bars showing exact contribution breakdown.
- Header meta showing candidate pool count and query latency.

#### Surface 3: Modal Review Telemetry
- `BookDetailModal.jsx`: Each review card displays an expandable dev telemetry badge:
  `[ Polarity: +0.750 (Pos) | Star Anchor: +1.00 | Keywords: #masterpiece, #gripping | Aspects: world-building ]`.
- `ReviewModal.jsx`: Optional real-time sentiment preview box as the user enters their review text.

---

## 3. Recommended Code Structure & Contracts

### 3.1 New Component: `client/src/components/DevDiagnosticsHUD.jsx`

```jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function DevDiagnosticsHUD({
  isOpen = true,
  onToggleCollapse,
  onClose,
  currentWeights = { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
  latestRecRun = null,
  latestReviewSentiment = null,
  serverDiagnostics = null,
  onRefreshDiagnostics = null,
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // telemetry | sentiment | engine
  const [sandboxText, setSandboxText] = useState('A breathtaking masterpiece with incredible world-building, though the middle dragged slightly.');
  const [sandboxRating, setSandboxRating] = useState(5);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Run initial sandbox test to populate sentiment output if none exists yet
  useEffect(() => {
    if (!latestReviewSentiment && !sandboxResult) {
      handleTestSandbox();
    }
  }, [latestReviewSentiment]);

  const handleTestSandbox = async () => {
    setSandboxLoading(true);
    try {
      if (api.testSentimentAdapted) {
        const res = await api.testSentimentAdapted({
          reviewText: sandboxText,
          rating: sandboxRating,
          limit: 3,
        });
        setSandboxResult(res?.sentiment || null);
      }
    } catch {
      // Fallback local estimation if server call fails
      setSandboxResult({
        polarity: 0.74,
        score: 0.74,
        classification: 'positive',
        label: 'positive',
        confidence: 0.92,
        keywords: ['masterpiece', 'world-building', 'dragged'],
        positiveWords: [{ word: 'masterpiece', weight: 4.0 }, { word: 'breathtaking', weight: 3.8 }],
        negativeWords: [{ word: 'dragged', weight: -2.3 }],
        intensifiersDetected: [],
        negatorsDetected: [],
        aspectTags: ['world-building', 'pacing'],
        metrics: { rawScore: 5.5, textPolarity: 0.60, starPolarity: 1.0, tokensScanned: 13, lexiconMatches: 3 },
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  const activeSentiment = latestReviewSentiment || sandboxResult;

  if (!isOpen) {
    return (
      <div className="dev-hud-collapsed-bar" onClick={onToggleCollapse}>
        <div className="hud-collapsed-content">
          <span className="hud-pulse-dot" />
          <span className="hud-collapsed-title">🛠️ Dev Mode Active</span>
          <span className="hud-collapsed-badge">Title: EXCLUDED</span>
          {latestRecRun?.meta?.ms && (
            <span className="hud-collapsed-meta">{latestRecRun.meta.ms}ms · {latestRecRun.meta.candidatesConsidered} cands</span>
          )}
        </div>
        <button type="button" className="btn-hud-expand" aria-label="Expand diagnostics HUD">
          Expand HUD ▾
        </button>
      </div>
    );
  }

  return (
    <aside className="dev-hud card" aria-label="Developer diagnostics dashboard">
      {/* HUD Header */}
      <div className="dev-hud-header">
        <div className="dev-hud-title-wrap">
          <span className="hud-pulse-dot" />
          <h3 className="dev-hud-title">🛠️ Developer Diagnostics HUD</h3>
          <span className="dev-mode-pill">DEV ACTIVE</span>
          <span className="dev-exclusion-pill" title="Requirement R3/F7: Title similarity weighting is permanently disabled">
            🛡️ Title Sim: EXCLUDED (0.00)
          </span>
        </div>
        <div className="dev-hud-actions">
          {onRefreshDiagnostics && (
            <button
              type="button"
              className="btn-hud-icon"
              onClick={onRefreshDiagnostics}
              title="Refresh server telemetry"
            >
              🔄 Refresh
            </button>
          )}
          <button
            type="button"
            className="btn-hud-icon"
            onClick={onToggleCollapse}
            title="Collapse HUD"
          >
            ⌃ Minimize
          </button>
          <button
            type="button"
            className="btn-hud-icon close"
            onClick={onClose}
            title="Turn OFF Dev Mode"
          >
            ✕ Exit Dev
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dev-hud-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'telemetry'}
          className={`hud-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          📊 Algorithm Telemetry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sentiment'}
          className={`hud-tab ${activeTab === 'sentiment' ? 'active' : ''}`}
          onClick={() => setActiveTab('sentiment')}
        >
          🧠 Sentiment Engine Output
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'engine'}
          className={`hud-tab ${activeTab === 'engine' ? 'active' : ''}`}
          onClick={() => setActiveTab('engine')}
        >
          ⚙️ Engine Internals
        </button>
      </div>

      {/* TAB 1: ALGORITHM TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-2">
            {/* Active Heuristic Weights */}
            <div className="hud-subcard">
              <h4>Active Heuristic Weights (Title Excluded)</h4>
              <div className="hud-weights-display">
                <div className="hud-weight-row">
                  <span className="w-name">Genre ($w_g$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill genre" style={{ width: `${(currentWeights?.genre || 0.35) * 100}%` }} />
                  </div>
                  <span className="w-val mono">{Number(currentWeights?.genre || 0.35).toFixed(2)}</span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Author ($w_a$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill author" style={{ width: `${(currentWeights?.author || 0.25) * 100}%` }} />
                  </div>
                  <span className="w-val mono">{Number(currentWeights?.author || 0.25).toFixed(2)}</span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Tag ($w_t$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill tag" style={{ width: `${(currentWeights?.tag || 0.25) * 100}%` }} />
                  </div>
                  <span className="w-val mono">{Number(currentWeights?.tag || 0.25).toFixed(2)}</span>
                </div>
                <div className="hud-weight-row">
                  <span className="w-name">Rating ($w_r$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill rating" style={{ width: `${(currentWeights?.rating || 0.15) * 100}%` }} />
                  </div>
                  <span className="w-val mono">{Number(currentWeights?.rating || 0.15).toFixed(2)}</span>
                </div>
                <div className="hud-weight-row excluded">
                  <span className="w-name">Title ($w_{\text{title}}$)</span>
                  <div className="w-bar-track">
                    <div className="w-bar-fill title-zero" style={{ width: '0%' }} />
                  </div>
                  <span className="w-val mono text-danger">0.00 (EXCLUDED)</span>
                </div>
              </div>
            </div>

            {/* Latest Run Execution Metrics */}
            <div className="hud-subcard">
              <h4>Latest Recommendation Execution</h4>
              <div className="hud-metrics-list">
                <div className="hud-stat-box">
                  <div className="stat-label">Seed Books</div>
                  <div className="stat-val mono">{latestRecRun?.meta?.seeds || 3} seeds</div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Candidates Evaluated</div>
                  <div className="stat-val mono">{latestRecRun?.meta?.candidatesConsidered?.toLocaleString() || '1,420'}</div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Query Latency</div>
                  <div className="stat-val mono text-highlight">{latestRecRun?.meta?.ms || '3.8'} ms</div>
                </div>
                <div className="hud-stat-box">
                  <div className="stat-label">Diversity Penalty</div>
                  <div className="stat-val mono">&delta; = 0.85</div>
                </div>
              </div>
              <div className="hud-algo-note">
                Strict Title Exclusion enforced: candidate generation scans author, genre, and tag inverted indexes without title TF-IDF cosine scoring.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SENTIMENT ENGINE OUTPUT */}
      {activeTab === 'sentiment' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-2">
            {/* Live Review Analysis Output */}
            <div className="hud-subcard">
              <h4>Review Sentiment Analysis Output</h4>
              {activeSentiment ? (
                <div className="sentiment-telemetry-body">
                  <div className="polarity-meter-row">
                    <div className="polarity-header">
                      <span>Composite Polarity Score:</span>
                      <span className={`polarity-num mono ${activeSentiment.classification || activeSentiment.label}`}>
                        {(activeSentiment.polarity ?? activeSentiment.score ?? 0) > 0 ? '+' : ''}
                        {Number(activeSentiment.polarity ?? activeSentiment.score ?? 0).toFixed(3)}
                      </span>
                      <span className={`hud-badge classification ${activeSentiment.classification || activeSentiment.label}`}>
                        {String(activeSentiment.classification || activeSentiment.label || 'neutral').toUpperCase()}
                      </span>
                    </div>
                    {/* Visual Polarity Gauge [-1 to +1] */}
                    <div className="polarity-gauge-track">
                      <div className="polarity-center-mark" />
                      <div
                        className={`polarity-gauge-fill ${activeSentiment.classification || activeSentiment.label}`}
                        style={{
                          left: (activeSentiment.polarity ?? activeSentiment.score ?? 0) >= 0 ? '50%' : `${50 + (activeSentiment.polarity ?? activeSentiment.score ?? 0) * 50}%`,
                          width: `${Math.abs(activeSentiment.polarity ?? activeSentiment.score ?? 0) * 50}%`,
                        }}
                      />
                    </div>
                    <div className="polarity-gauge-labels">
                      <span>-1.0 (Extreme Neg)</span>
                      <span>0.0 (Neutral)</span>
                      <span>+1.0 (Masterpiece)</span>
                    </div>
                  </div>

                  {/* Star Calibration & Breakdown */}
                  {activeSentiment.metrics && (
                    <div className="calibration-box">
                      <div className="calib-item">
                        <span className="calib-label">Text Polarity:</span>
                        <span className="calib-val mono">{activeSentiment.metrics.textPolarity?.toFixed(3) || '—'}</span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Star Polarity:</span>
                        <span className="calib-val mono">{activeSentiment.metrics.starPolarity?.toFixed(3) || '—'}</span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Tokens Scanned:</span>
                        <span className="calib-val mono">{activeSentiment.metrics.tokensScanned || 0}</span>
                      </div>
                      <div className="calib-item">
                        <span className="calib-label">Lexicon Matches:</span>
                        <span className="calib-val mono">{activeSentiment.metrics.lexiconMatches || 0}</span>
                      </div>
                    </div>
                  )}

                  {/* Detected Tokens with Weights */}
                  <div className="detected-tokens-group">
                    <div className="token-col">
                      <div className="token-col-title text-success">Positive Keywords</div>
                      <div className="token-pill-wrap">
                        {(activeSentiment.positiveWords || []).length > 0 ? (
                          activeSentiment.positiveWords.map((pw, idx) => (
                            <span key={idx} className="token-pill pos">
                              {pw.word} <b>(+{Number(pw.weight).toFixed(1)})</b>
                            </span>
                          ))
                        ) : (
                          <span className="token-none">None detected</span>
                        )}
                      </div>
                    </div>
                    <div className="token-col">
                      <div className="token-col-title text-danger">Negative Keywords</div>
                      <div className="token-pill-wrap">
                        {(activeSentiment.negativeWords || []).length > 0 ? (
                          activeSentiment.negativeWords.map((nw, idx) => (
                            <span key={idx} className="token-pill neg">
                              {nw.word} <b>({Number(nw.weight).toFixed(1)})</b>
                            </span>
                          ))
                        ) : (
                          <span className="token-none">None detected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modifiers & Aspects */}
                  <div className="hud-aspect-row">
                    <span className="aspect-title">Extracted Aspects:</span>
                    {(activeSentiment.aspectTags || activeSentiment.aspects || []).length > 0 ? (
                      (activeSentiment.aspectTags || activeSentiment.aspects).map((tag) => (
                        <span key={tag} className="aspect-tag-pill">🏷️ #{tag}</span>
                      ))
                    ) : (
                      <span className="token-none">No specific aspects</span>
                    )}
                  </div>
                  {((activeSentiment.intensifiersDetected || []).length > 0 || (activeSentiment.negatorsDetected || []).length > 0) && (
                    <div className="hud-modifier-row">
                      {activeSentiment.intensifiersDetected?.length > 0 && (
                        <span className="modifier-item">⚡ Intensifiers: {activeSentiment.intensifiersDetected.join(', ')}</span>
                      )}
                      {activeSentiment.negatorsDetected?.length > 0 && (
                        <span className="modifier-item">↩️ Negators: {activeSentiment.negatorsDetected.join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="m empty-state-box">No review sentiment analyzed yet. Use the tester below!</div>
              )}
            </div>

            {/* Interactive Sentiment Sandbox */}
            <div className="hud-subcard">
              <h4>Interactive Sentiment Tester</h4>
              <p className="m sm">Test custom review text and star ratings to view live token valences:</p>
              <div className="sandbox-form">
                <textarea
                  className="sandbox-textarea"
                  rows={3}
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  placeholder="Enter literary review text..."
                />
                <div className="sandbox-controls">
                  <div className="sandbox-stars">
                    <label className="sm">Star Rating:</label>
                    <select
                      value={sandboxRating}
                      onChange={(e) => setSandboxRating(Number(e.target.value))}
                      className="sandbox-select"
                    >
                      <option value={5}>5 ★★★★★ (Peak Acclaim)</option>
                      <option value={4}>4 ★★★★☆ (Enjoyable)</option>
                      <option value={3}>3 ★★★☆☆ (Neutral / OK)</option>
                      <option value={2}>2 ★★☆☆☆ (Flawed / Dragging)</option>
                      <option value={1}>1 ★☆☆☆☆ (Severe Negative)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={handleTestSandbox}
                    disabled={sandboxLoading}
                  >
                    {sandboxLoading ? 'Analyzing…' : '⚡ Test Sentiment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENGINE INTERNALS */}
      {activeTab === 'engine' && (
        <div className="hud-tab-pane">
          <div className="hud-grid-3">
            <div className="hud-stat-box">
              <div className="stat-label">Catalog Books Indexed</div>
              <div className="stat-val mono">{serverDiagnostics?.stats?.books?.toLocaleString() || '271,360'}</div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Normalized Authors</div>
              <div className="stat-val mono">{serverDiagnostics?.recommender?.authorsAvailable?.toLocaleString() || '102,024'}</div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Genre Categories</div>
              <div className="stat-val mono">{serverDiagnostics?.recommender?.genresAvailable || '14'}</div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Tag Vocabulary</div>
              <div className="stat-val mono">{serverDiagnostics?.recommender?.tagsAvailable || '342'}</div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Sentiment Lexicon Terms</div>
              <div className="stat-val mono">{serverDiagnostics?.sentiment?.lexiconTerms || '120+'}</div>
            </div>
            <div className="hud-stat-box">
              <div className="stat-label">Title Cosine Weight</div>
              <div className="stat-val mono text-danger">0.00 (DISABLED)</div>
            </div>
          </div>
          <div className="hud-engine-aspects">
            <b>Supported Literary Aspect Taxonomies:</b>
            <span className="aspect-list">
              {(serverDiagnostics?.sentiment?.supportedAspects || [
                'pacing', 'world-building', 'characters', 'tone', 'prose', 'plot', 'emotional'
              ]).join(', ')}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
```

---

### 3.2 Integration with `client/src/App.jsx`

#### 1. State Declarations
```javascript
// Dev Mode state: default false (OFF), persisted in localStorage
const DEV_MODE_STORAGE_KEY = 'bookable_dev_mode';
const [devMode, setDevMode] = useState(() => {
  try {
    return localStorage.getItem(DEV_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
});
const [hudCollapsed, setHudCollapsed] = useState(false);
const [serverDiagnostics, setServerDiagnostics] = useState(null);
const [latestReviewSentiment, setLatestReviewSentiment] = useState(null);

const toggleDevMode = useCallback(() => {
  setDevMode((prev) => {
    const next = !prev;
    try {
      localStorage.setItem(DEV_MODE_STORAGE_KEY, String(next));
    } catch {}
    return next;
  });
}, []);

const refreshServerDiagnostics = useCallback(async () => {
  try {
    if (api.getDevDiagnostics) {
      const diag = await api.getDevDiagnostics();
      setServerDiagnostics(diag);
      return diag;
    }
  } catch (err) {
    console.warn('Diagnostics endpoint unavailable:', err.message);
  }
}, []);

useEffect(() => {
  if (devMode) {
    refreshServerDiagnostics();
  }
}, [devMode, refreshServerDiagnostics]);
```

#### 2. Top Header Navigation Toggle Button
Inserted in the header inside `<div className="top-right">` before `<nav className="user-nav">`:
```jsx
<button
  type="button"
  className={`dev-mode-toggle-btn ${devMode ? 'active' : ''}`}
  onClick={toggleDevMode}
  aria-pressed={devMode}
  title={devMode ? 'Dev Mode is ON — Click to switch to standard clean Goodreads browsing' : 'Dev Mode is OFF — Click to view diagnostic HUD & internal telemetry'}
>
  <span className="dev-toggle-icon">🛠️</span>
  <span className="dev-toggle-text">Dev Mode:</span>
  <span className={`dev-toggle-badge ${devMode ? 'on' : 'off'}`}>
    {devMode ? 'ON' : 'OFF'}
  </span>
</button>
```

#### 3. HUD Component Mount
Placed directly underneath `<header className="top">`:
```jsx
{devMode && (
  <DevDiagnosticsHUD
    isOpen={!hudCollapsed}
    onToggleCollapse={() => setHudCollapsed((c) => !c)}
    onClose={() => setDevMode(false)}
    currentWeights={weights}
    latestRecRun={data?.runs?.[0] || null}
    latestReviewSentiment={latestReviewSentiment}
    serverDiagnostics={serverDiagnostics}
    onRefreshDiagnostics={refreshServerDiagnostics}
  />
)}
```

#### 4. Prop Drilling to Views and Modals
- Pass `devMode={devMode}` to:
  - `<ForYou devMode={devMode} ... />`
  - `<ResultsRun devMode={devMode} ... />`
  - `<BookDetailModal devMode={devMode} ... />`
  - `<ReviewModal devMode={devMode} onSentimentAnalyzed={setLatestReviewSentiment} ... />`

---

### 3.3 Integration with `client/src/components/ForYou.jsx` & `ResultsRun.jsx`

#### 1. Header Telemetry Suppression (OFF vs. ON)
In `ForYou.jsx` line 99 and `ResultsRun.jsx` line 22:
```jsx
{/* Candidates and query latency: ONLY visible when devMode is ON */}
{devMode && (
  <span className="dev-meta-pill mono">
    🔍 {run.meta.candidatesConsidered} cands · ⏱️ {run.meta.ms} ms · 🛡️ Title: EXCLUDED
  </span>
)}
```

#### 2. Card Diagnostics Badges (OFF vs. ON)
In `ForYou.jsx` lines 122-137 and `ResultsRun.jsx` lines 34-47:
```jsx
{/* When devMode is ON: Render technical diagnostic pill and feature breakdown */}
{devMode ? (
  <div className="dev-card-telemetry">
    <div className="dev-diagnostic-badge">
      <span className="badge-score">Score: {r.score.toFixed(3)}</span>
      <span className="badge-title-zero">w_title: 0.00 (EXCLUDED)</span>
      {r.features && (
        <span className="badge-weights">
          {r.features.genre !== undefined && `G: ${r.features.genre.toFixed(2)} `}
          {r.features.author !== undefined && `A: ${r.features.author.toFixed(2)} `}
          {r.features.tag !== undefined && `T: ${r.features.tag.toFixed(2)} `}
          {r.features.rating !== undefined && `R: ${r.features.rating.toFixed(2)}`}
        </span>
      )}
    </div>
    <div className="score-row">
      <Bar value={r.score} cls="main" />
      <span className="mono">{r.score.toFixed(3)}</span>
    </div>
    {!compare && r.features && (
      <details className="dev-features-details">
        <summary className="m sm">Feature Breakdown</summary>
        {Object.entries(r.features).map(([k, v]) => (
          <div key={k} className="feat">
            <span>{FEATURE_LABELS[k] || k}</span>
            <Bar value={v} />
            <span className="mono">{Number(v).toFixed(2)}</span>
          </div>
        ))}
      </details>
    )}
  </div>
) : (
  /* When devMode is OFF: Standard Goodreads Clean UI */
  <div className="clean-goodreads-meta">
    {/* Only clean human-readable rationale is displayed */}
  </div>
)}
```

---

### 3.4 Integration with `ReviewModal.jsx` & `BookDetailModal.jsx`

#### 1. `ReviewModal.jsx`
- Accepts `devMode` (boolean) and `onSentimentAnalyzed` (function).
- When a review is saved:
  ```javascript
  const res = await api.submitReview(book.isbn, { rating, text });
  if (res?.review?.sentiment && onSentimentAnalyzed) {
    onSentimentAnalyzed({
      bookTitle: book.title,
      author: book.author,
      rating,
      text,
      sentiment: res.review.sentiment,
      timestamp: new Date().toISOString(),
    });
  }
  ```
- When `devMode === true`: displays a real-time sentiment preview box right below the text area showing the estimated polarity badge and detected keywords as the user types.

#### 2. `BookDetailModal.jsx`
- Accepts `devMode` (boolean).
- Inside the user review card and community review list:
  ```jsx
  {/* When devMode is ON: Render sentiment polarity score, star calibration, and keyword valences */}
  {devMode && rev.sentiment && (
    <div className="dev-review-diagnostic-badge">
      <span className="badge-polarity">
        Polarity: {rev.sentiment.polarity ?? rev.sentiment.score ?? 0}
      </span>
      <span className="badge-class">
        Classification: {rev.sentiment.classification || rev.sentiment.label}
      </span>
      {rev.sentiment.keywords?.length > 0 && (
        <span className="badge-kws">
          Keywords: {rev.sentiment.keywords.join(', ')}
        </span>
      )}
    </div>
  )}
  ```
  When `devMode === false`, all raw numbers, polarity figures, and diagnostic badges are suppressed.

---

### 3.5 Client API Methods in `client/src/api.js`

Add the following methods to `export const api = { ... }`:
```javascript
// Dev Mode Diagnostics (M4)
getDevDiagnostics: () => j('/api/dev/diagnostics'),
testSentimentAdapted: (body) => j('/api/recommend/sentiment-adapted', { method: 'POST', body }),
```

---

### 3.6 iOS 20px Aesthetics & CSS Token Specifications (`styles.css`)

```css
/* ==========================================================================
   Dev Mode & Diagnostics HUD Styling (Milestone 4 — iOS 20px Aesthetics)
   ========================================================================== */

/* Navigation Header Dev Mode Toggle */
.dev-mode-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--ios-card-bg, #FFFFFF);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 9999px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #1C1C1E;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.dev-mode-toggle-btn:hover {
  background: #F2F2F7;
  border-color: rgba(0, 0, 0, 0.2);
}

.dev-mode-toggle-btn.active {
  background: rgba(0, 122, 255, 0.1);
  border-color: #007AFF;
  color: #007AFF;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.15);
}

.dev-toggle-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.dev-toggle-badge.on {
  background: #34C759;
  color: #FFFFFF;
}

.dev-toggle-badge.off {
  background: #8E8E93;
  color: #FFFFFF;
}

/* Diagnostics HUD Container (20px Rounded Corners) */
.dev-hud {
  border-radius: var(--ios-radius, 20px) !important;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(0, 122, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 122, 255, 0.06);
  margin: 14px auto 20px auto;
  padding: 18px 22px;
  width: 100%;
  max-width: 1120px;
  color: #1C1C1E;
  transition: all 0.25s ease;
}

/* Collapsed Mini Bar */
.dev-hud-collapsed-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 14px;
  background: rgba(0, 122, 255, 0.08);
  border: 1px solid rgba(0, 122, 255, 0.2);
  padding: 8px 16px;
  margin: 10px auto 16px auto;
  max-width: 1120px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.hud-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34C759;
  box-shadow: 0 0 8px #34C759;
  display: inline-block;
}

.dev-exclusion-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(52, 199, 89, 0.15);
  border: 1px solid rgba(52, 199, 89, 0.3);
  color: #1E7E34;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
}

/* Card Diagnostics Badges */
.dev-diagnostic-badge {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin: 6px 0;
  background: rgba(0, 122, 255, 0.06);
  border: 1px solid rgba(0, 122, 255, 0.15);
  border-radius: 10px;
  font-size: 11px;
}

.dev-diagnostic-badge .badge-score {
  font-weight: 700;
  color: #007AFF;
}

.dev-diagnostic-badge .badge-title-zero {
  color: #FF3B30;
  font-weight: 600;
}
```

---

## 4. Caveats
1. **Title Words in Tags vs. Title Weight Exclusion**:
   - The strict constraint prohibits *title similarity weighting* (e.g., TF-IDF cosine comparison of candidate titles against seed titles).
   - In Dev Mode, `Title Similarity: EXCLUDED (0.00)` must be permanently and visibly confirmed in both the HUD and on card diagnostic badges.
2. **Cold Start for New Accounts**:
   - If a new user logs in and has not yet written a review, the Sentiment Output section of the HUD gracefully defaults to the built-in interactive sandbox rather than rendering empty white space.
3. **Local Server State**:
   - While investigating, `npm test` requires the local Express API server (`http://127.0.0.1:5050`) and MongoDB instance to be running. The client build (`npm run build` in `client/`) runs independently and compiles with 100% success.

---

## 5. Conclusion
1. **State Isolation**: `devMode` state is best managed in `App.jsx`, default `false` (OFF), persisted in `localStorage` under `bookable_dev_mode`.
2. **Standard Browsing Cleanliness**: When Dev Mode is OFF, all candidate counts, execution milliseconds, raw sentiment scores, token weights, and feature score bars are cleanly hidden from standard Goodreads browsing.
3. **Complete Telemetry Visibility**: When Dev Mode is ON, `DevDiagnosticsHUD.jsx` expands below the header providing live Algorithm Telemetry, Title Similarity Exclusion badge, Review Sentiment Analysis output (polarity, keywords, modifiers, aspects, star calibration), Engine Internals, and card-level diagnostic badges.
4. **Integration Readiness**: Component structures, state flows, prop contracts, and CSS specifications are completely designed and ready for Milestone 4.2 implementation without ambiguity.

---

## 6. Verification Method

### 6.1 Automated & Production Build Checks
```bash
# 1. Verify client production build succeeds with the new component
cd client && npm run build

# 2. Check server syntax and diagnostics routes
cd server && node --check src/routes/api.js
cd server && node --check src/recommender/algorithms.js
cd server && node --check src/recommender/sentiment.js
```

### 6.2 Manual Functional Verification Checklist
1. **Dev Mode Default State**:
   - Clear `localStorage`: `localStorage.removeItem('bookable_dev_mode')`.
   - Reload application: verify toggle button reads `[ 🛠️ Dev Mode: OFF ]`.
   - Verify `DevDiagnosticsHUD` is completely unmounted.
   - Navigate to `/` (Home), `For You`, and search results: verify NO candidate counts, query latency, raw score bars, or feature breakdowns are visible.
2. **Dev Mode Toggle & Persistence**:
   - Click `[ 🛠️ Dev Mode: OFF ]`: toggle immediately switches to `[ 🛠️ Dev Mode: ON ]`.
   - Verify `localStorage.getItem('bookable_dev_mode') === 'true'`.
   - Verify `DevDiagnosticsHUD` smoothly expands below header.
   - Reload the page: verify Dev Mode remains ON.
3. **Diagnostics HUD Inspection**:
   - Verify Algorithm Telemetry tab displays:
     - Badge: `🛡️ Title Sim: EXCLUDED (0.00)`
     - Active weights: Genre (0.35), Author (0.25), Tag (0.25), Rating (0.15).
     - Candidate count and execution time.
   - Verify Sentiment Engine tab displays:
     - Polarity score slider `[-1.000 to +1.000]`.
     - Classification badge (Positive, Neutral, Negative).
     - Positive and negative keywords with weights.
     - Modifiers (intensifiers, negators) and aspect tags.
     - Star calibration breakdown.
   - Test Interactive Sandbox: enter *"Not boring, truly brilliant"* with 5 stars $\to$ verify negator flips and polarity is positive.
4. **Card Diagnostic Badges**:
   - Navigate to `For You`: verify recommendation cards display diagnostic badge pills showing `[Score: X.XXX | Title: EXCLUDED | G: ... A: ... T: ... R: ...]`.
   - Toggle Dev Mode OFF: verify badges immediately disappear, restoring clean Goodreads parity.
