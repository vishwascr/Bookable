# Milestone 4 Handoff Report: Top-Level Algorithm Customizer Drawer & Controls

**Agent**: `teamwork_explorer_2` (`sub_orch_m4_explorer_2`)  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_2`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**Scope**: Requirement R3 & Acceptance Criteria AC3 — Top-Level Algorithm Customization Drawer (`AlgorithmCustomizer.jsx`), Heuristic Weights State Management, Title Similarity Weight Exclusion ($w_{\text{title}} = 0$), Presets, Real-Time Reactivity, and Compatibility with `ThreeSeedSelector.jsx`, `ForYou.jsx`, and `App.jsx`.

---

## 1. Observation

### 1.1 Existing Recommendation Parameter & Weight Handling in Client
Direct code audit of `client/src/App.jsx`, `client/src/components/WeightSliders.jsx`, `client/src/components/ForYou.jsx`, and `client/src/api.js` reveals:

1. **Client Weight State in `App.jsx`** (`client/src/App.jsx:34, 88-94`):
   ```javascript
   const [weights, setWeights] = useState(null);
   // ...
   useEffect(() => {
     api.algorithms()
       .then((d) => {
         setAlgos(d.algorithms);
         setWeights(d.defaultWeights);
       })
       .catch((e) => setError(e.message));
   ```
   - `api.algorithms()` returns `{ defaultWeights, defaultThreeWeights, algorithms }`.
   - Currently, `App.jsx` exclusively loads `d.defaultWeights` = `{ title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 }` (the legacy single-seed hybrid weights).
   - `d.defaultThreeWeights` = `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }` is completely ignored by the client.

2. **WeightSliders Placement & Features** (`client/src/components/WeightSliders.jsx:1-17`):
   - Defined as:
     ```javascript
     export const FEATURE_LABELS = { title: 'Title', author: 'Author', publisher: 'Publisher', year: 'Year' };
     ```
   - Rendered only inside `<aside>` in `App.jsx:513` and `ForYou.jsx:78` under condition `(algo === 'hybrid' || compare) && weights`.
   - It is buried in the sidebar rather than positioned at the top of the interface.
   - It lacks genre, tag, and rating heuristic sliders, and prominently features `Title` (which violates R3).

3. **Client API Helper Gaps** (`client/src/api.js:41-78`):
   - `client/src/api.js` contains:
     - `api.recommend(isbn, algo, weights, limit)` -> calls `GET /api/recommend/:isbn` with `w_title, w_author, w_publisher, w_year`.
     - `api.forYou(algo, weights, limit)` -> calls `GET /api/me/recommend` with `w_title, w_author, w_publisher, w_year`.
   - **Critical Gap**: `api.recommendThree` (`POST /api/recommend/three`) and `api.recommendSentimentAdapted` (`POST /api/recommend/sentiment-adapted`) are **NOT implemented** in `client/src/api.js`, even though the backend endpoints and tests are fully implemented and verified!

### 1.2 Backend Recommendation & Heuristic Endpoints
Direct inspection of `server/src/routes/api.js` and `server/src/recommender/algorithms.js` reveals:

1. **`POST /api/recommend/three`** (`server/src/routes/api.js:95-129`):
   - Accepts body:
     ```json
     {
       "seeds": ["0618002219", "0441172717", "0439136369"],
       "weights": {
         "genre": 0.35,
         "author": 0.25,
         "tag": 0.25,
         "rating": 0.15
       },
       "limit": 12
     }
     ```
   - Validates that `seeds` contains exactly 3 distinct valid catalog ISBN strings (`server/src/routes/api.js:103-109`).
   - Parses weights via `parseThreeWeights` (`server/src/routes/api.js:71-90`): allowed keys are strictly `['genre', 'author', 'tag', 'rating']`.
   - Title similarity is completely omitted. Any passed `w_title` or `title` is stripped or forced to 0.
   - Returns:
     ```json
     {
       "candidates": [
         {
           "isbn": "0441172717",
           "title": "Dune",
           "author": "Frank Herbert",
           "year": 1965,
           "publisher": "Ace",
           "imageM": "...",
           "score": 0.8234,
           "features": { "author": 1.0, "genre": 0.6667, "tag": 0.5, "rating": 0.84 },
           "bestSeed": "0441172660",
           "matchedSeeds": 2,
           "explanation": "Matches author Frank Herbert and genre Science Fiction from \"Dune\""
         }
       ],
       "diagnostics": {
         "seedCount": 3,
         "titleExcluded": true,
         "weightsUsed": { "genre": 0.35, "author": 0.25, "tag": 0.25, "rating": 0.15 },
         "candidatesEvaluated": 1840,
         "queryTimeMs": 3.42
       }
     }
     ```

2. **Default Heuristic Weights** (`server/src/recommender/algorithms.js:232`):
   ```javascript
   export const DEFAULT_THREE_WEIGHTS = { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 };
   ```

3. **`tests/recommendation-heuristics.test.js`** (30 passing tests):
   - `T1-REC-01` to `T1-REC-05`: 3-seed recommendations happy path, seed exclusion, normalized scores [0, 1], metadata explanations.
   - `T1-TTL-01` to `T1-TTL-05`: Title similarity exclusion ($w_{\text{title}} = 0$), `diagnostics.titleExcluded: true`, rejection of title weights.
   - `T1-CST-01` to `T1-CST-05`: Dynamic weight customization: genre dominance (`genre: 0.85`), author dominance (`author: 0.85`), tag dominance (`tag: 0.75`), rating dominance (`rating: 0.70`), and active weights echo.
   - `T4-SCN-03`: Personalized 3-seed tuning scenario using `{ author: 0.70, genre: 0.15, tag: 0.05, rating: 0.10 }`.

### 1.3 Missing Components in Client
- `client/src/components/AlgorithmCustomizer.jsx`: **Does not exist yet.**
- `client/src/components/ThreeSeedSelector.jsx`: **Does not exist yet.**
- `client/src/components/DevDiagnosticsHUD.jsx`: **Does not exist yet** (assigned to Explorer 3).

---

## 2. Logic Chain

### 2.1 Decoupling Top-Level Controls from Sidebar Legacy Sliders
1. **Deduction from Observations 1.1 & 1.2**:
   - The user requested: *"Include a toggle at the top of the interface to customize recommendation algorithm parameters"* (R3) and *"A toggle at the top allows users to customize recommendation algorithm weights and parameters"* (AC3).
   - Currently, `WeightSliders.jsx` only exists in the sidebar of single-book `explore` and `ForYou`, and only controls the old single-seed weights (`title`, `author`, `publisher`, `year`).
   - Therefore, a dedicated, top-level component `AlgorithmCustomizer.jsx` must be mounted near the top of the viewport in `App.jsx`, controlling the 4 metadata heuristic weights: `genre`, `author`, `tag`, and `rating`.
   - Legacy `WeightSliders.jsx` can remain in `aside` for the legacy single-seed hybrid view to prevent breaking existing single-book exploration, or be linked to the customizer.

### 2.2 Aesthetic & Interaction Architecture for `AlgorithmCustomizer.jsx`
1. **Top Toggle Button**:
   - Must be positioned prominently in the application header or top controls bar.
   - Styled as an iOS pill button: `[ ⚙️ Customize Algorithm ▾ ]`.
   - Displays active preset name as a subtitle or badge (e.g., `[ ⚙️ Algorithm: Balanced ▾ ]`).
   - Accessible keyboard trigger: `aria-expanded={isOpen}`, `aria-controls="algo-customizer-drawer"`.
2. **Collapsible Tray (iOS 20px Aesthetics)**:
   - When clicked, smoothly expands an iOS-styled tray directly below the header.
   - Must strictly adhere to `--ios-radius: 20px` (`border-radius: 20px`).
   - Background: elevated card styling (`--ios-card: #FFFFFF`), subtle hairline border (`rgba(0, 0, 0, 0.08)`), and soft elevation shadow (`box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08)`).
   - iOS sheet drag indicator / grabber pill at top center.
3. **Four Active Heuristic Sliders**:
   - Genre weight ($w_{\text{genre}}$, default `0.35`, range `0.00` to `1.00`, step `0.05`).
   - Author weight ($w_{\text{author}}$, default `0.25`, range `0.00` to `1.00`, step `0.05`).
   - Tag weight ($w_{\text{tag}}$, default `0.25`, range `0.00` to `1.00`, step `0.05`).
   - Rating weight ($w_{\text{rating}}$, default `0.15`, range `0.00` to `1.00`, step `0.05`).
   - Each slider displays both raw value (`0.35`) and normalized percentage share (`35%`).
4. **Permanent Title Similarity Exclusion Display**:
   - Per requirement: *"Explicitly display Title Similarity Weight as permanently EXCLUDED / 0.00 (with an explanatory tooltip or note that title similarity is strictly excluded per requirements)."*
   - Render a dedicated, locked row:
     - Label: `Title Similarity (TF-IDF Cosine)`
     - Value: `🔒 EXCLUDED (0.00)`
     - Track: Disabled/locked at 0 with a slashed-circle or lock icon.
     - Explanatory callout:
       `ℹ️ Title similarity weighting is permanently excluded ($w_{\text{title}} = 0$) per project specification. Recommendations are driven purely by author, genre, tag, and rating heuristics to prevent superficial title word collisions from skewing discovery.`
5. **Presets & Reset Action**:
   - **Balanced (Default)**: `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }`
   - **Author Focus**: `{ genre: 0.15, author: 0.70, tag: 0.05, rating: 0.10 }` (matches Tier 4 test `T4-SCN-03`)
   - **Genre Focus**: `{ genre: 0.75, author: 0.10, tag: 0.10, rating: 0.05 }` (matches Tier 1 test `T1-CST-01`)
   - **Top Rated**: `{ genre: 0.10, author: 0.10, tag: 0.10, rating: 0.70 }` (matches Tier 1 test `T1-CST-04`)
   - **Thematic Tags**: `{ genre: 0.10, author: 0.10, tag: 0.70, rating: 0.10 }` (matches Tier 1 test `T1-CST-03`)
   - **Reset Button**: `↺ Reset to Defaults` button restoring `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }`.

### 2.3 Real-Time Reactivity & State Propagation
1. **Global State in `App.jsx`**:
   - `const [algoWeights, setAlgoWeights] = useState(() => { ...loadFromLocalStorage or DEFAULT_THREE_WEIGHTS })`
   - Persisted to `localStorage.setItem('bookable_algo_weights', JSON.stringify(algoWeights))`.
   - Pass `algoWeights` and `setAlgoWeights` into:
     - `AlgorithmCustomizer.jsx`
     - `ThreeSeedSelector.jsx`
     - `ForYou.jsx`
     - `DevDiagnosticsHUD.jsx` (for telemetry synchronization).
2. **Debounced Fetching**:
   - Sliders update `algoWeights` on every `input` event for instantaneous visual UI response.
   - When fetching recommendations from `POST /api/recommend/three` or `POST /api/recommend/sentiment-adapted`, a 150ms–200ms debounce prevents API flooding while providing snappy real-time ranking adjustments.

### 2.4 Compatibility with `ThreeSeedSelector.jsx` & Other Components
1. **`ThreeSeedSelector.jsx` Interaction**:
   - Fulfills the R3 requirement: *"Selecting three books produces tailored recommendations using author, genre, tag, and rating heuristics, with title similarity weight excluded."*
   - Displays 3 seed slots (Empty or Populated with book cover/title).
   - Allows users to populate seeds from:
     - Their favorite books (`me.favorites`).
     - Their shelves (`me.wantToRead`, `me.read`).
     - Quick catalog search.
   - When 3 seeds are selected:
     - Invokes `api.recommendThree(seeds.map(s => s.isbn), algoWeights, limit)`.
     - Automatically re-fetches when `algoWeights` change in `AlgorithmCustomizer`.
     - Displays candidates with explanation, similarity score, and `ReadingStatusButton`.
2. **`ForYou.jsx` Integration**:
   - Can display the active `AlgorithmCustomizer` preset in its header.
   - If user has $\ge 3$ favorites, provides a 1-click button: *"Generate 3-Seed Recs from Favourites"* which invokes `ThreeSeedSelector` or displays the 3-seed heuristic candidates.
   - Displays dynamic sentiment-adapted recommendations row (`POST /api/recommend/sentiment-adapted`).
3. **`DevDiagnosticsHUD.jsx` Integration**:
   - Dev Mode HUD reflects `algoWeights` dynamically in its "Active Heuristic Weights" telemetry panel.

---

## 3. Caveats

1. **Legacy Single-Seed Algorithm vs. Modern 3-Seed Heuristic Engine**:
   - The legacy `explore` view (`/api/recommend/:isbn?algo=hybrid`) uses single-seed weights `{ title, author, publisher, year }`.
   - The modern engine (`POST /api/recommend/three`) uses 3-seed heuristic weights `{ genre, author, tag, rating }` with title similarity excluded.
   - To prevent breaking backward compatibility while satisfying R3, `AlgorithmCustomizer` at the top of the app controls the primary 3-seed heuristic weights. In the legacy single-seed explore page, `WeightSliders.jsx` can continue operating or display a note.
2. **Sum of Weights Boundary**:
   - If a user drags all 4 sliders to `0.00`, the backend validation in `server/src/routes/api.js:88` returns `400 Bad Request: "At least one weight must be greater than zero"`.
   - `AlgorithmCustomizer` must guard against this on the client side: if all weights are 0, it should either disable the 0-position on the last slider, auto-normalize, or display a warning banner: *"Please assign a non-zero weight to at least one heuristic signal."*
3. **Seed Count Invariant**:
   - `POST /api/recommend/three` requires exactly 3 distinct seeds. If fewer than 3 seeds are chosen, `ThreeSeedSelector` must display unfilled slots with clear callouts (*"Select 1 more book to generate recommendations"*) rather than firing a premature API request.

---

## 4. Conclusion & Technical Specifications

### 4.1 Component Specification: `AlgorithmCustomizer.jsx`

#### File Location: `client/src/components/AlgorithmCustomizer.jsx`

```jsx
import { useId, useMemo } from 'react';

export const ALGO_PRESETS = [
  {
    id: 'balanced',
    name: 'Balanced',
    badge: 'Default',
    description: 'Even balance across genre, author, tags, and community rating',
    weights: { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
  },
  {
    id: 'author',
    name: 'Author Focus',
    badge: 'Author 70%',
    description: 'Prioritizes other works by the same authors as your seed books',
    weights: { genre: 0.15, author: 0.70, tag: 0.05, rating: 0.10 },
  },
  {
    id: 'genre',
    name: 'Genre Focus',
    badge: 'Genre 75%',
    description: 'Explores books sharing identical genres across different authors',
    weights: { genre: 0.75, author: 0.10, tag: 0.10, rating: 0.05 },
  },
  {
    id: 'top_rated',
    name: 'Top Rated',
    badge: 'Rating 70%',
    description: 'Surfaces highest community-rated books matching seed profiles',
    weights: { genre: 0.10, author: 0.10, tag: 0.10, rating: 0.70 },
  },
  {
    id: 'thematic',
    name: 'Thematic Tags',
    badge: 'Tags 70%',
    description: 'Emphasizes narrative tropes, vibes, and thematic tags',
    weights: { genre: 0.10, author: 0.10, tag: 0.70, rating: 0.10 },
  },
];

export const DEFAULT_ALGO_WEIGHTS = ALGO_PRESETS[0].weights;

const HEURISTIC_CONFIG = [
  {
    key: 'genre',
    label: 'Genre Weight',
    symbol: 'w_genre',
    icon: '🎭',
    color: '#007AFF', // iOS blue
    description: 'Matches books sharing literary genres (e.g. Sci-Fi, Classics, Fantasy)',
  },
  {
    key: 'author',
    label: 'Author Weight',
    symbol: 'w_author',
    icon: '✍️',
    color: '#5856D6', // iOS purple
    description: 'Boosts works written by the same author(s) as the selected seeds',
  },
  {
    key: 'tag',
    label: 'Tag Weight',
    symbol: 'w_tag',
    icon: '🏷️',
    color: '#34C759', // iOS green
    description: 'Matches narrative tropes, themes (e.g. space-opera, dystopian, slow-burn)',
  },
  {
    key: 'rating',
    label: 'Rating Weight',
    symbol: 'w_rating',
    icon: '⭐',
    color: '#FF9500', // iOS orange
    description: 'Weights community star ratings and proximity to seed baseline ratings',
  },
];

export default function AlgorithmCustomizer({
  weights = DEFAULT_ALGO_WEIGHTS,
  onChange,
  isOpen = false,
  onToggle,
}) {
  const drawerId = useId();

  // Calculate normalized total
  const rawTotal = useMemo(() => {
    return (
      (weights.genre || 0) +
      (weights.author || 0) +
      (weights.tag || 0) +
      (weights.rating || 0)
    );
  }, [weights]);

  const effectiveTotal = rawTotal > 0 ? rawTotal : 1;

  // Active preset matching
  const activePresetId = useMemo(() => {
    for (const p of ALGO_PRESETS) {
      const match =
        Math.abs(p.weights.genre - (weights.genre || 0)) < 0.02 &&
        Math.abs(p.weights.author - (weights.author || 0)) < 0.02 &&
        Math.abs(p.weights.tag - (weights.tag || 0)) < 0.02 &&
        Math.abs(p.weights.rating - (weights.rating || 0)) < 0.02;
      if (match) return p.id;
    }
    return 'custom';
  }, [weights]);

  const handleSliderChange = (key, val) => {
    const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
    onChange({
      ...weights,
      [key]: Math.round(num * 100) / 100,
    });
  };

  const handleApplyPreset = (preset) => {
    onChange({ ...preset.weights });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_ALGO_WEIGHTS });
  };

  return (
    <div className="algo-customizer-container">
      {/* Top Toggle Button */}
      <button
        type="button"
        className={`algo-customizer-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={drawerId}
        aria-label="Customize Recommendation Algorithm Parameters"
      >
        <span className="toggle-icon">⚙️</span>
        <span className="toggle-title">Customize Algorithm</span>
        <span className="toggle-preset-badge">
          {ALGO_PRESETS.find((p) => p.id === activePresetId)?.name || 'Custom'}
        </span>
        <span className="toggle-caret">{isOpen ? '▴' : '▾'}</span>
      </button>

      {/* Collapsible iOS-Styled Tray */}
      {isOpen && (
        <section
          id={drawerId}
          className="algo-customizer-drawer ios-card"
          aria-label="Algorithm Customization Drawer"
        >
          <div className="drawer-grabber" aria-hidden="true" />

          <header className="drawer-header">
            <div>
              <h3 className="drawer-title">⚙️ Recommendation Algorithm Parameters</h3>
              <p className="drawer-subtitle">
                Fine-tune heuristic weights for 3-seed book recommendations. Title similarity is strictly excluded per system constraints.
              </p>
            </div>
            <button
              type="button"
              className="btn-reset-algo"
              onClick={handleReset}
              title="Reset weights to default values"
            >
              ↺ Reset to Defaults
            </button>
          </header>

          {/* Presets Row */}
          <div className="presets-section">
            <span className="presets-label">Presets:</span>
            <div className="presets-pills">
              {ALGO_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-pill ${activePresetId === p.id ? 'active' : ''}`}
                  onClick={() => handleApplyPreset(p)}
                  title={p.description}
                >
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-badge">{p.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Distribution Stacked Bar */}
          <div className="distribution-bar-wrapper">
            <div className="distribution-bar">
              {HEURISTIC_CONFIG.map(({ key, color, label }) => {
                const pct = Math.round(((weights[key] || 0) / effectiveTotal) * 100);
                if (pct <= 0) return null;
                return (
                  <div
                    key={key}
                    className="distribution-segment"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    title={`${label}: ${pct}%`}
                  >
                    {pct >= 12 && <span>{pct}%</span>}
                  </div>
                );
              })}
            </div>
            <div className="distribution-legend">
              {HEURISTIC_CONFIG.map(({ key, color, label }) => {
                const pct = Math.round(((weights[key] || 0) / effectiveTotal) * 100);
                return (
                  <div key={key} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: color }} />
                    <span className="legend-text">{label}: <b>{pct}%</b></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Sliders Grid */}
          <div className="sliders-grid">
            {HEURISTIC_CONFIG.map(({ key, label, symbol, icon, color, description }) => {
              const val = weights[key] ?? 0;
              const pct = Math.round((val / effectiveTotal) * 100);

              return (
                <div key={key} className="slider-card">
                  <div className="slider-header">
                    <span className="slider-label">
                      <span className="slider-icon">{icon}</span>
                      <b>{label}</b>
                      <code className="slider-symbol">{symbol}</code>
                    </span>
                    <div className="slider-value-group">
                      <span className="slider-val-num">{val.toFixed(2)}</span>
                      <span className="slider-val-pct mono" style={{ color }}>{pct}%</span>
                    </div>
                  </div>

                  <p className="slider-description">{description}</p>

                  <div className="slider-control-row">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={val}
                      onChange={(e) => handleSliderChange(key, e.target.value)}
                      className="ios-slider"
                      style={{ accentColor: color }}
                      aria-label={`${label} slider`}
                      aria-valuenow={val}
                      aria-valuetext={`${label}: ${val.toFixed(2)} (${pct}%)`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* MANDATORY: Permanently Excluded Title Similarity Row */}
          <div className="title-exclusion-banner">
            <div className="exclusion-header">
              <div className="exclusion-title-row">
                <span className="lock-icon">🔒</span>
                <b>Title Similarity Weight (w_title)</b>
                <span className="excluded-badge">PERMANENTLY EXCLUDED (0.00)</span>
              </div>
              <span className="mono excluded-zero">0.00 (0%)</span>
            </div>

            <div className="disabled-slider-track" aria-hidden="true">
              <div className="disabled-slider-thumb" />
            </div>

            <div className="exclusion-callout">
              <span className="info-icon">ℹ️</span>
              <p>
                <strong>Title similarity is strictly excluded</strong> per requirements ($w_{{\text{{title}}}} = 0$). Recommendations are computed using pure metadata heuristics (genres, authors, tags, and ratings) without title TF-IDF cosine comparison, preventing superficial word matches from skewing recommendations.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
```

---

### 4.2 Component Specification: `ThreeSeedSelector.jsx`

#### File Location: `client/src/components/ThreeSeedSelector.jsx`

```jsx
import { useEffect, useState, useMemo } from 'react';
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
    if (seeds.length !== 3) {
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
    <section className="three-seed-selector-section ios-card">
      <div className="three-seed-head">
        <div>
          <h2>🎯 3-Book Recommendation Engine</h2>
          <p className="section-desc">
            Pick 3 books to discover tailored suggestions using author, genre, tag, and rating heuristics.
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
                  <Cover src={book.imageM} size="md" title={book.title} />
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
                    + Pick Seed Book
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot Search Popover / Drawer if picking a slot */}
      {activeSlot !== null && (
        <div className="slot-picker-drawer ios-card">
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
            <span className="mono">
              Evaluated {recommendations.diagnostics?.candidatesEvaluated || 0} candidates in {recommendations.diagnostics?.queryTimeMs}ms
            </span>
          </div>

          <div className="three-seed-candidates-grid">
            {recommendations.candidates.map((cand, idx) => (
              <article key={cand.isbn} className="candidate-card ios-card">
                <span className="candidate-rank">#{idx + 1}</span>
                <div className="candidate-cover-wrap" onClick={() => onSelectBook?.(cand)}>
                  <Cover src={cand.imageM} size="md" title={cand.title} />
                </div>
                <div className="candidate-details">
                  <h4 className="candidate-title" onClick={() => onSelectBook?.(cand)}>
                    {cand.title}
                  </h4>
                  <div className="candidate-author">{cand.author} · {cand.year || 'n/a'}</div>
                  <p className="candidate-explanation">💡 {cand.explanation}</p>

                  <div className="candidate-score-bar">
                    <span className="mono score-tag">Score: {cand.score.toFixed(3)}</span>
                    <span className="match-tag">Matched {cand.matchedSeeds}/3 seeds</span>
                  </div>

                  {/* Dev Mode Feature Breakdown Badges */}
                  {devMode && cand.features && (
                    <div className="dev-feature-chips">
                      <span className="dev-chip">🎭 Genre: {cand.features.genre}</span>
                      <span className="dev-chip">✍️ Author: {cand.features.author}</span>
                      <span className="dev-chip">🏷️ Tag: {cand.features.tag}</span>
                      <span className="dev-chip">⭐ Rating: {cand.features.rating}</span>
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
```

---

### 4.3 Client API Updates (`client/src/api.js`)

Add the following methods to `client/src/api.js`:

```javascript
// Recommendation Engine Endpoints (M2, M4)
recommendThree: (seeds, weights, limit = 12) =>
  j('/api/recommend/three', {
    method: 'POST',
    body: { seeds, weights, limit },
  }),

recommendSentimentAdapted: (body) =>
  j('/api/recommend/sentiment-adapted', {
    method: 'POST',
    body,
  }),

getDevDiagnostics: () => j('/api/dev/diagnostics'),
```

---

### 4.4 App Integration Blueprints (`client/src/App.jsx`)

1. **State Declaration**:
   ```javascript
   import AlgorithmCustomizer, { DEFAULT_ALGO_WEIGHTS } from './components/AlgorithmCustomizer.jsx';
   import ThreeSeedSelector from './components/ThreeSeedSelector.jsx';
   // ...
   const [algoWeights, setAlgoWeights] = useState(() => {
     try {
       const saved = localStorage.getItem('bookable_algo_weights');
       return saved ? JSON.parse(saved) : DEFAULT_ALGO_WEIGHTS;
     } catch {
       return DEFAULT_ALGO_WEIGHTS;
     }
   });
   const [algoDrawerOpen, setAlgoDrawerOpen] = useState(false);
   ```

2. **Persistence Effect**:
   ```javascript
   useEffect(() => {
     try {
       localStorage.setItem('bookable_algo_weights', JSON.stringify(algoWeights));
     } catch { /* ignore quota */ }
   }, [algoWeights]);
   ```

3. **Top Bar Rendering in `App.jsx`**:
   Directly inside or beneath `<header className="top">`:
   ```jsx
   <div className="top-controls-bar">
     <AlgorithmCustomizer
       weights={algoWeights}
       onChange={setAlgoWeights}
       isOpen={algoDrawerOpen}
       onToggle={() => setAlgoDrawerOpen((prev) => !prev)}
     />
     {/* DevDiagnosticsHUD will be placed here by Worker / Explorer 3 */}
   </div>
   ```

---

### 4.5 CSS Style Specifications for `AlgorithmCustomizer` (`client/src/styles.css`)

```css
/* ==========================================================================
   Algorithm Customizer Drawer & Controls (iOS 20px Aesthetics)
   ========================================================================== */

:root {
  --ios-radius: 20px;
  --ios-card: #FFFFFF;
  --ios-border: 1px solid rgba(0, 0, 0, 0.08);
  --ios-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
}

.top-controls-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

/* iOS Toggle Pill Button */
.algo-customizer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: var(--ios-card);
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.algo-customizer-toggle:hover {
  background: #f7f7f9;
  border-color: rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.algo-customizer-toggle:active {
  transform: scale(0.98);
}

.algo-customizer-toggle.open {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.toggle-preset-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
}

.algo-customizer-toggle.open .toggle-preset-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

/* Collapsible iOS Tray Drawer */
.algo-customizer-drawer {
  width: 100%;
  margin-top: 12px;
  margin-bottom: 24px;
  padding: 24px;
  border-radius: var(--ios-radius) !important; /* STRICT 20px */
  background: var(--ios-card);
  border: var(--ios-border);
  box-shadow: var(--ios-shadow-lg);
  animation: slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDownFade {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.drawer-grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.15);
  margin: 0 auto 16px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.drawer-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.drawer-subtitle {
  margin: 4px 0 0;
  font-size: 0.88rem;
  color: var(--muted);
}

.btn-reset-algo {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 9999px;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset-algo:hover {
  color: var(--ink);
  border-color: var(--ink);
}

/* Presets */
.presets-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.presets-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.presets-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #f2f2f7;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-pill:hover {
  background: #e5e5ea;
}

.preset-pill.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.preset-badge {
  font-size: 0.72rem;
  opacity: 0.85;
}

/* Distribution Bar */
.distribution-bar-wrapper {
  margin-bottom: 24px;
}

.distribution-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: #e5e5ea;
}

.distribution-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.68rem;
  font-weight: bold;
  transition: width 0.2s ease;
}

.distribution-legend {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Sliders Grid */
.sliders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.slider-card {
  padding: 16px;
  border-radius: 14px;
  background: #f9f9fb;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.slider-symbol {
  font-size: 0.72rem;
  color: var(--muted);
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 4px;
}

.slider-value-group {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.slider-val-num {
  font-size: 0.95rem;
  font-weight: 600;
}

.slider-val-pct {
  font-size: 0.8rem;
}

.slider-description {
  font-size: 0.76rem;
  color: var(--muted);
  margin: 0 0 12px;
  line-height: 1.3;
}

.ios-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  cursor: pointer;
}

/* Permanently Excluded Title Similarity Banner */
.title-exclusion-banner {
  padding: 16px 20px;
  border-radius: 14px;
  background: #fff8f5;
  border: 1px solid rgba(232, 93, 59, 0.2);
}

.exclusion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.exclusion-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
}

.excluded-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  background: #fde8e4;
  color: #b5562b;
  letter-spacing: 0.03em;
}

.disabled-slider-track {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e5ea;
  margin-bottom: 12px;
  opacity: 0.6;
}

.disabled-slider-thumb {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #8e8e93;
}

.exclusion-callout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.78rem;
  color: #7a3e20;
  line-height: 1.4;
}

.exclusion-callout p {
  margin: 0;
}
```

---

## 5. Verification Method

### 5.1 Verification Commands
To independently verify that the client build succeeds without syntax or module errors:
```bash
# 1. Verify client build
cd client && npm run build

# 2. Verify server syntax
cd server && node --check src/index.js && node --check src/routes/api.js && node --check src/recommender/algorithms.js

# 3. Verify automated E2E tests for recommendation heuristics and customization
node tests/run-all.js --suite=rec
```

### 5.2 Behavioral Invalidation Checklist
The implementation will be invalid if:
1. `AlgorithmCustomizer.jsx` allows moving `w_title` above `0.00` or fails to label title similarity as strictly `EXCLUDED (0.00)`.
2. The customizer drawer does not enforce `--ios-radius: 20px` (`border-radius: 20px`).
3. Moving sliders fails to trigger re-fetching in `ThreeSeedSelector` or `ForYou`.
4. Sliders fail to reset to `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }` on clicking "Reset to Defaults".
5. Presets (Balanced, Author Focus, Genre Focus, Top Rated) do not load their designated weights.
