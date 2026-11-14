# M2 Investigation Report: API Route Specifications, Dev Mode Diagnostics & Integration Plan

**Agent**: `teamwork_explorer_m2_3` (API & Integration Explorer)  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3`  
**Milestone**: Milestone 2 — 3-Book Recommendation Engine & Local Sentiment Analyzer  
**Target Files**: `server/src/routes/api.js`, `server/src/index.js`, `client/src/api.js`  
**Date**: 2026-11-13T18:55:00Z  

---

## 1. Observation

### 1.1 Existing Server Route Architecture
Direct inspection of `server/src/index.js` (lines 1–21) shows how routes and background jobs are initialized:
```javascript
// server/src/index.js:8-21
const PORT = process.env.PORT || 5050;
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', users);
app.use('/api', api);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

await connect();
app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
buildIndex().catch((e) => console.error('[engine] failed', e));
```
- The Express app mounts `users.js` and `api.js` directly under the `/api` prefix.
- JSON body parsing (`express.json()`) and CORS (`cors()`) are already globally applied.
- Unhandled synchronous/asynchronous route errors are caught by `next(err)` and forwarded to the 4-argument Express error handler returning `{ error: err.message }` with HTTP 500.
- An in-memory recommendation index is built asynchronously at startup via `buildIndex()`.

### 1.2 Existing Route Patterns and Middleware in `server/src/routes/api.js`
Direct inspection of `server/src/routes/api.js` (lines 9–92) reveals existing conventions:
- **Readiness Middleware** (`server/src/routes/api.js:9-10`):
  ```javascript
  const ready = (req, res, next) =>
    engine().ready ? next() : res.status(503).json({ error: 'Index is still building, try again in a few seconds.' });
  ```
  Every route requiring access to catalog data or recommendation indexes relies on this `ready` middleware to guard against early calls during startup.
- **Health Endpoint** (`server/src/routes/api.js:12`):
  ```javascript
  r.get('/health', (req, res) => res.json({ ok: true, ready: engine().ready, stats: engine().stats }));
  ```
- **Algorithms Metadata Endpoint** (`server/src/routes/api.js:14-19`):
  ```javascript
  r.get('/algorithms', (req, res) =>
    res.json({
      defaultWeights: DEFAULT_WEIGHTS,
      algorithms: Object.entries(ALGORITHMS).map(([key, a]) => ({ key, name: a.name, short: a.short, formula: a.formula, explain: a.explain })),
    })
  );
  ```
- **Single-Book Recommendation Endpoint** (`server/src/routes/api.js:78-90`):
  ```javascript
  r.get('/recommend/:isbn', ready, (req, res) => {
    const i = engine().byIsbn.get(req.params.isbn);
    if (i === undefined) return res.status(404).json({ error: 'Book not found' });
    const algo = String(req.query.algo || 'hybrid');
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    const weights = parseWeights(req.query);
    ...
  ```
  Observations:
  1. Routes look up books in memory via `engine().byIsbn.get(isbn)`.
  2. Unknown ISBN returns HTTP 404 `{ error: 'Book not found' }`.
  3. Limits are clamped between a minimum and 50.
  4. Query parameters are parsed with fallback defaults.

### 1.3 Input Validation Patterns in `server/src/routes/users.js`
Direct inspection of `server/src/routes/users.js` (lines 67–77) shows existing validation patterns for ISBN lists:
```javascript
// Replace favourites (onboarding + editing). 3–5 valid ISBNs.
r.put('/me/favorites', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbns = [...new Set((req.body.isbns || []).map(String))];
    if (isbns.length < 3 || isbns.length > 5) return res.status(400).json({ error: 'Pick between 3 and 5 books' });
    const unknown = isbns.filter((i) => !engine().byIsbn.has(i));
    if (unknown.length) return res.status(400).json({ error: `Unknown ISBN(s): ${unknown.join(', ')}` });
    req.user.favorites = isbns;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});
```
- Sets are used to deduplicate ISBN arrays.
- Length validation returns HTTP 400 `{ error: '...' }`.
- Unknown ISBN check verifies against `engine().byIsbn.has(i)`.

### 1.4 Existing Client API Layer (`client/src/api.js`)
Inspection of `client/src/api.js` (lines 12–30, 48–50) shows:
```javascript
const j = async (url, opts = {}) => {
  const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
};
```
Client functions communicate using JSON POST/PUT/GET requests with automatic `Authorization: Bearer <token>` attachment and structured error throwing.

### 1.5 Title Similarity Reliance in Current Code
Direct inspection of `server/src/recommender/algorithms.js` shows:
- Lines 18–23: Feature vector computes `title: +cosine(seed, cand).toFixed(4)`.
- Line 30: `DEFAULT_WEIGHTS = { title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 }`.
- Line 43, 54, 65, 76, 95: All five algorithms explicitly weight title cosine similarity.
- Conflict with Project Requirements (`ORIGINAL_REQUEST.md:20`, `PROJECT.md:112`, `SCOPE.md:29`):
  *"Strict exclusion of title similarity weighting ($w_{\text{title}} = 0$) from the recommendation engine."*
  Neither `POST /api/recommend/three` nor `POST /api/recommend/sentiment-adapted` must compute, use, or expose title similarity in scoring.

---

## 2. Logic Chain

1. **Endpoint Placement**:
   - `server/src/routes/api.js` currently handles catalog search, book inspection, and recommendation queries (`/recommend/:isbn`).
   - Therefore, `POST /api/recommend/three` and `POST /api/recommend/sentiment-adapted` belong directly in `server/src/routes/api.js`.
   - Both endpoints must be protected by the `ready` middleware to ensure in-memory index availability before query processing.

2. **Payload Design & Seed Invariant for `POST /api/recommend/three`**:
   - The user requirement specifically defines a 3-book recommendation engine.
   - The payload format defined in `SCOPE.md` is `{ seeds: [isbn1, isbn2, isbn3], weights: { genre, author, tag, rating }, limit }`.
   - The route must enforce:
     - `seeds` is an Array.
     - `seeds.length === 3`.
     - De-duplicated seed count is 3 (no duplicate ISBNs within seeds).
     - Every seed ISBN exists in `engine().byIsbn`. If any seed is missing from the catalog, return HTTP 400 or 404 with the list of missing ISBNs.
   - Candidate exclusion: The candidates returned must exclude the 3 seeds and any alternate editions sharing the seeds' work deduplication key (`dKey`).

3. **Weight Customization and Strict Title Exclusion**:
   - Supported heuristic weights are: `{ genre, author, tag, rating }`.
   - Default weights: `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }`.
   - Invariant: Title similarity is strictly excluded ($w_{\text{title}} = 0$).
   - If a client supplies `title` or `w_title` in the request body, the endpoint must ignore/clamp it to 0, return `titleExcluded: true` in `diagnostics`, and ensure no title cosine computation occurs.
   - Weights must be non-negative numbers, with at least one weight $> 0$.

4. **Sentiment-Adapted Recommendations Design (`POST /api/recommend/sentiment-adapted`)**:
   - Input payload: `{ reviewText, targetIsbn, rating, limit }`.
   - `rating` must be validated as a number between 1 and 5.
   - `reviewText` is trimmed and capped at 5000 characters.
   - `targetIsbn` is optional: if provided, it is validated against `engine().byIsbn`. If unknown, return HTTP 404.
   - The route calls `analyzeReviewSentiment(reviewText, rating)` from `server/src/recommender/sentiment.js`, returning:
     - Polarity `score` in `[-1.0, 1.0]`.
     - `label` ('positive' | 'neutral' | 'negative').
     - `keywords` (salient affective tokens).
     - `aspects` (extracted literary aspects: 'pacing', 'world-building', 'character-depth', etc.).
     - `breakdown` (lexical breakdown with token valences and star calibration delta for Dev Mode).
   - The route then calls `adaptRecommendationsBySentiment(sentimentResult, targetBook, { limit })` to produce adapted candidates.

5. **Dev Mode Diagnostics & Telemetry**:
   - Dev Mode in M4 needs to display engine internals, latencies, seed weights, candidate pool sizes, and sentiment breakdown.
   - All response payloads must return clean `diagnostics` objects.
   - Normal users only render candidate book cards, while Dev Mode users (when `devMode === true`) render the `DevDiagnosticsHUD` and candidate badges populated directly from `diagnostics` and per-candidate `features`.

6. **Test Strategy**:
   - 4-Tier test strategy covering:
     - Tier 1: Happy paths for both endpoints with valid inputs.
     - Tier 2: Boundary conditions, invalid inputs, edge cases, and strict title exclusion invariants.
     - Tier 3: Cross-feature combinations (auth + shelves + recommendations + sentiment).
     - Tier 4: End-to-end Goodreads user workflow.

---

## 3. API Route Specifications & Implementation Contracts

### 3.1 Endpoint 1: `POST /api/recommend/three`

#### Request Specification
- **Method**: `POST`
- **Path**: `/api/recommend/three`
- **Authentication**: None (public; callable with or without auth token)
- **Headers**: `Content-Type: application/json`
- **Payload Schema**:
  ```json
  {
    "seeds": ["string", "string", "string"],
    "weights": {
      "genre": 0.35,
      "author": 0.25,
      "tag": 0.25,
      "rating": 0.15
    },
    "limit": 12
  }
  ```

#### Field Specifications:
| Field | Type | Required | Default | Validation Rules |
|---|---|---|---|---|
| `seeds` | `Array<string>` | Yes | — | Exactly 3 valid, distinct ISBN strings present in catalog |
| `weights` | `Object` | No | `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }` | Keys: `genre`, `author`, `tag`, `rating`. Numbers $\ge 0$. Sum $> 0$. `title` strictly ignored/set to 0. |
| `limit` | `number` | No | `12` | Integer clamped between 1 and 50 |

#### Response Specification (HTTP 200 OK)
```json
{
  "candidates": [
    {
      "book": {
        "isbn": "0441172660",
        "title": "Dune",
        "author": "Frank Herbert",
        "year": 1965,
        "publisher": "Ace Books",
        "imageM": "http://images.amazon.com/...",
        "imageL": "http://images.amazon.com/..."
      },
      "score": 0.892,
      "features": {
        "genre": 0.95,
        "author": 0.0,
        "tag": 0.90,
        "rating": 0.88
      },
      "matchedSeeds": 2,
      "bestSeed": "0345339681",
      "contributions": {
        "0345339681": 0.85,
        "0439136350": 0.91
      },
      "explanation": "Matched high genre affinity (Sci-Fi/Fantasy), strong rating (4.7/5), tags: epic, world-building"
    }
  ],
  "diagnostics": {
    "seedCount": 3,
    "seeds": [
      { "isbn": "0439136350", "title": "Harry Potter and the Prisoner of Azkaban", "author": "J.K. Rowling" },
      { "isbn": "0345339681", "title": "The Hobbit", "author": "J.R.R. Tolkien" },
      { "isbn": "0060973129", "title": "The Joy Luck Club", "author": "Amy Tan" }
    ],
    "weightsUsed": {
      "genre": 0.35,
      "author": 0.25,
      "tag": 0.25,
      "rating": 0.15
    },
    "titleExcluded": true,
    "candidatesEvaluated": 450,
    "candidatesReturned": 12,
    "queryTimeMs": 14.8,
    "diversityApplied": true
  }
}
```

#### Error Handling Matrix:
| Condition | HTTP Status | Response Body |
|---|---|---|
| Index building in progress | `503 Service Unavailable` | `{"error": "Index is still building, try again in a few seconds."}` |
| Missing request body | `400 Bad Request` | `{"error": "Request body must be a JSON object"}` |
| Missing or non-array `seeds` | `400 Bad Request` | `{"error": "Field \"seeds\" must be an array of 3 book ISBN strings"}` |
| `seeds.length !== 3` | `400 Bad Request` | `{"error": "Exactly 3 seed book ISBNs must be provided"}` |
| Duplicate ISBNs in seeds | `400 Bad Request` | `{"error": "Seed ISBNs must be 3 distinct books"}` |
| Unknown seed ISBN | `400 Bad Request` (or `404`) | `{"error": "Unknown seed ISBN(s): 9999999999"}` |
| Invalid weight (negative, NaN) | `400 Bad Request` | `{"error": "Weight for \"genre\" must be a non-negative number"}` |
| Sum of all weights is 0 | `400 Bad Request` | `{"error": "At least one weight must be greater than zero"}` |
| Title similarity passed | Accepted with `titleExcluded: true` | Title weight forced to 0; `diagnostics.titleExcluded = true` |

---

### 3.2 Endpoint 2: `POST /api/recommend/sentiment-adapted`

#### Request Specification
- **Method**: `POST`
- **Path**: `/api/recommend/sentiment-adapted`
- **Authentication**: None (public; optionally authenticated)
- **Headers**: `Content-Type: application/json`
- **Payload Schema**:
  ```json
  {
    "reviewText": "string",
    "targetIsbn": "string",
    "rating": 4,
    "limit": 10
  }
  ```

#### Field Specifications:
| Field | Type | Required | Default | Validation Rules |
|---|---|---|---|---|
| `reviewText` | `string` | No (can be empty string) | `""` | String, max length 5000 characters |
| `targetIsbn` | `string` | No | `null` | If provided, must exist in catalog (`engine().byIsbn`) |
| `rating` | `number` | Yes | — | Number between 1 and 5 (inclusive) |
| `limit` | `number` | No | `10` | Integer clamped between 1 and 50 |

#### Response Specification (HTTP 200 OK)
```json
{
  "sentiment": {
    "score": 0.74,
    "label": "positive",
    "keywords": ["masterpiece", "world-building", "compelling"],
    "aspects": ["world-building", "pacing"],
    "breakdown": {
      "rawLexiconScore": 0.68,
      "starCalibrationOffset": +0.10,
      "positiveTokens": ["masterpiece", "compelling"],
      "negativeTokens": [],
      "intensifiers": ["absolutely"]
    }
  },
  "adaptedRecommendations": [
    {
      "book": {
        "isbn": "0345339681",
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "year": 1937,
        "publisher": "Del Rey",
        "imageM": "http://...",
        "imageL": "http://..."
      },
      "score": 0.91,
      "adaptationReason": "Reinforced positive world-building and character depth from Dune",
      "matchedAspects": ["world-building"],
      "features": {
        "genre": 0.95,
        "author": 0.0,
        "tag": 0.90,
        "rating": 0.92
      }
    }
  ],
  "diagnostics": {
    "targetIsbn": "0441172660",
    "rating": 4,
    "adaptationStrategy": "reinforce_positive_aspects",
    "queryTimeMs": 12.3,
    "candidatesEvaluated": 310,
    "candidatesReturned": 10,
    "titleExcluded": true
  }
}
```

#### Error Handling Matrix:
| Condition | HTTP Status | Response Body |
|---|---|---|
| Index building in progress | `503 Service Unavailable` | `{"error": "Index is still building, try again in a few seconds."}` |
| Missing or invalid rating | `400 Bad Request` | `{"error": "Rating must be a number between 1 and 5"}` |
| Non-string `reviewText` | `400 Bad Request` | `{"error": "Field \"reviewText\" must be a string"}` |
| Review text $> 5000$ characters | `400 Bad Request` | `{"error": "Review text exceeds maximum length of 5000 characters"}` |
| Non-existent `targetIsbn` | `404 Not Found` | `{"error": "Target book with ISBN \"...\" not found"}` |

---

## 4. Dev Mode Diagnostics Contracts & Telemetry Integration

### 4.1 Global Telemetry Contract
Dev Mode in M4 provides a top toggle button that reveals real-time telemetry while keeping normal Goodreads browsing clean.
To support this, the API contract defines these diagnostic surfaces:

1. **At Endpoint Level (`diagnostics` object in every recommendation response)**:
   - `seedCount`: Number of seeds evaluated (e.g. 3).
   - `weightsUsed`: Feature weights used in scoring (`genre`, `author`, `tag`, `rating`).
   - `titleExcluded`: Boolean (always `true` in M2).
   - `candidatesEvaluated`: Total candidate pool size evaluated before truncation/ranking.
   - `candidatesReturned`: Final candidate count returned to client.
   - `queryTimeMs`: Execution time in milliseconds (high-precision `performance.now()`).
   - `diversityApplied`: Flag indicating greedy seed diversity re-ranking was executed.
   - `adaptationStrategy`: Strategy employed (e.g., `'reinforce_positive_aspects'`, `'pivot_contrasting_aspects'`, `'balanced_neutral'`).

2. **At Candidate Level (`candidates[i]` properties)**:
   - `features`: `{ genre, author, tag, rating }` normalized between `0.0` and `1.0`. (Strictly no `title` property).
   - `score`: Composite recommendation score.
   - `contributions`: Dictionary mapping each seed ISBN to its individual contribution score.
   - `matchedSeeds`: Count of seeds that contributed positively to this candidate.
   - `bestSeed`: ISBN of the seed with the highest affinity.
   - `explanation`: Human-readable summary of reasons (e.g. "High genre overlap, same author, top community rating").

3. **At Sentiment Level (`sentiment.breakdown`)**:
   - `rawLexiconScore`: Lexical polarity calculated purely from text $[-1.0, 1.0]$.
   - `starCalibrationOffset`: Calibration offset applied from star rating $[-0.3, +0.3]$.
   - `positiveTokens`: Array of matched positive terms from the literary lexicon.
   - `negativeTokens`: Array of matched negative terms.
   - `intensifiers`: Array of detected modifier words (e.g. "extremely", "deeply").
   - `aspectSentiments`: Map of aspect -> polarity score (e.g. `{"world-building": 0.8, "pacing": -0.4}`).

### 4.2 Health & Capabilities Check (`GET /api/health`)
Extended response schema:
```json
{
  "ok": true,
  "ready": true,
  "stats": {
    "books": 271379,
    "vocabulary": 48215,
    "authors": 101284,
    "publishers": 16807,
    "buildMs": 2412
  },
  "features": {
    "recommenderM2": true,
    "titleExcluded": true,
    "sentimentEngine": true,
    "supportedAspects": ["pacing", "world-building", "character-depth", "plot", "writing-style", "emotional-resonance"]
  }
}
```

---

## 5. Proposed Implementation Code Design

### 5.1 Route Handler Code for `server/src/routes/api.js`
The following code snippet is designed for direct integration by the M2 implementer into `server/src/routes/api.js`:

```javascript
import { Router } from 'express';
import Book from '../models/Book.js';
import { engine, termsOf } from '../recommender/engine.js';
import { decode } from '../recommender/text.js';
import { ALGORITHMS, DEFAULT_WEIGHTS, recommend, publicBook } from '../recommender/algorithms.js';
import { recommendThree, DEFAULT_THREE_WEIGHTS } from '../recommender/algorithms.js';
import { analyzeReviewSentiment, adaptRecommendationsBySentiment } from '../recommender/sentiment.js';

const r = Router();

const ready = (req, res, next) =>
  engine().ready ? next() : res.status(503).json({ error: 'Index is still building, try again in a few seconds.' });

// Helper: Validate and parse 3-seed heuristic weights with strict title exclusion
function parseThreeWeights(weights) {
  if (!weights) return { weights: { ...DEFAULT_THREE_WEIGHTS } };
  if (typeof weights !== 'object' || Array.isArray(weights)) {
    return { error: 'Field "weights" must be an object' };
  }
  const allowed = ['genre', 'author', 'tag', 'rating'];
  const w = {};
  for (const k of allowed) {
    if (weights[k] !== undefined) {
      const val = Number(weights[k]);
      if (isNaN(val) || val < 0) return { error: `Weight for "${k}" must be a non-negative number` };
      w[k] = val;
    } else {
      w[k] = DEFAULT_THREE_WEIGHTS[k];
    }
  }
  const sum = w.genre + w.author + w.tag + w.rating;
  if (sum <= 0) return { error: 'At least one weight must be greater than zero' };
  return { weights: w };
}

// POST /api/recommend/three
r.post('/recommend/three', ready, async (req, res, next) => {
  try {
    const { seeds, weights, limit } = req.body || {};

    if (!Array.isArray(seeds)) {
      return res.status(400).json({ error: 'Field "seeds" must be an array of 3 book ISBN strings' });
    }
    const cleanSeeds = seeds.map((s) => String(s || '').trim()).filter(Boolean);
    if (cleanSeeds.length !== 3) {
      return res.status(400).json({ error: 'Exactly 3 seed book ISBNs must be provided' });
    }
    const uniqueSeeds = [...new Set(cleanSeeds)];
    if (uniqueSeeds.length !== 3) {
      return res.status(400).json({ error: 'Seed ISBNs must be 3 distinct books' });
    }

    const e = engine();
    const missing = uniqueSeeds.filter((isbn) => !e.byIsbn.has(isbn));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Unknown seed ISBN(s): ${missing.join(', ')}` });
    }

    const parsedWeights = parseThreeWeights(weights);
    if (parsedWeights.error) {
      return res.status(400).json({ error: parsedWeights.error });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

    const result = recommendThree(uniqueSeeds, parsedWeights.weights, parsedLimit);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/recommend/sentiment-adapted
r.post('/recommend/sentiment-adapted', ready, async (req, res, next) => {
  try {
    const { reviewText, targetIsbn, rating, limit } = req.body || {};

    const numRating = Number(rating);
    if (rating === undefined || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    if (reviewText !== undefined && typeof reviewText !== 'string') {
      return res.status(400).json({ error: 'Field "reviewText" must be a string' });
    }
    const cleanText = String(reviewText || '').trim();
    if (cleanText.length > 5000) {
      return res.status(400).json({ error: 'Review text exceeds maximum length of 5000 characters' });
    }

    const e = engine();
    let targetBook = null;
    if (targetIsbn) {
      const idx = e.byIsbn.get(String(targetIsbn).trim());
      if (idx === undefined) {
        return res.status(404).json({ error: `Target book with ISBN "${targetIsbn}" not found` });
      }
      targetBook = e.books[idx];
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const sentiment = analyzeReviewSentiment(cleanText, numRating);
    const adaptation = adaptRecommendationsBySentiment(sentiment, targetBook, { limit: parsedLimit });

    res.json({
      sentiment: {
        score: sentiment.score,
        label: sentiment.label,
        keywords: sentiment.keywords,
        aspects: sentiment.aspects,
        breakdown: sentiment.breakdown,
      },
      adaptedRecommendations: adaptation.recommendations,
      diagnostics: {
        targetIsbn: targetIsbn || null,
        rating: numRating,
        adaptationStrategy: adaptation.strategy,
        queryTimeMs: adaptation.queryTimeMs,
        candidatesEvaluated: adaptation.candidatesEvaluated,
        titleExcluded: true,
      },
    });
  } catch (e) {
    next(e);
  }
});
```

### 5.2 Client API Integration (`client/src/api.js`)
Additions to `client/src/api.js`:
```javascript
export const api = {
  ...
  // M2 Endpoints
  recommendThree: (seeds, weights, limit = 12) =>
    j('/api/recommend/three', { method: 'POST', body: { seeds, weights, limit } }),
  recommendSentimentAdapted: (reviewText, targetIsbn, rating, limit = 10) =>
    j('/api/recommend/sentiment-adapted', { method: 'POST', body: { reviewText, targetIsbn, rating, limit } }),
};
```

---

## 6. Comprehensive Test Strategy & Verification Plan

### 6.1 Four-Tier Test Architecture Mapping

#### Tier 1: Feature Coverage (Isolated Happy Path)
Target test files: `tests/recommendation-heuristics.test.js` & `tests/sentiment-analysis.test.js`
1. **`three_seeds_default_weights`**:
   - Input: `seeds: ['0439136350', '0345339681', '0060973129']`.
   - Assertions: Status 200, `candidates.length >= 10`, `diagnostics.titleExcluded === true`, `diagnostics.seedCount === 3`, `diagnostics.queryTimeMs > 0`.
2. **`three_seeds_custom_weights`**:
   - Input: Custom weights `{ genre: 0.6, author: 0.3, tag: 0.1, rating: 0.0 }`.
   - Assertions: Status 200, `diagnostics.weightsUsed` exactly equals input weights.
3. **`three_seeds_limit_control`**:
   - Input: `limit: 5`.
   - Assertions: Status 200, `candidates.length === 5`.
4. **`sentiment_adapted_positive`**:
   - Input: `{ reviewText: "A breathtaking masterpiece with rich world-building!", rating: 5, targetIsbn: "0345339681" }`.
   - Assertions: Status 200, `sentiment.label === 'positive'`, `sentiment.score > 0.4`, `sentiment.aspects` includes `'world-building'`, `adaptedRecommendations.length > 0`.
5. **`sentiment_adapted_negative`**:
   - Input: `{ reviewText: "Utterly boring with dreadful pacing and thin characters.", rating: 1, targetIsbn: "0345339681" }`.
   - Assertions: Status 200, `sentiment.label === 'negative'`, `sentiment.score < -0.4`, `sentiment.aspects` includes `'pacing'`.
6. **`sentiment_adapted_neutral`**:
   - Input: `{ reviewText: "Average read, neither bad nor exceptional.", rating: 3, targetIsbn: "0345339681" }`.
   - Assertions: Status 200, `sentiment.label === 'neutral'`, `-0.2 <= sentiment.score <= 0.2`.

#### Tier 2: Boundary Cases, Error Validation & Invariant Proofs
1. **`title_similarity_strict_exclusion_invariant`**:
   - Test A: Pass `weights: { title: 0.9, genre: 0.1 }` in body. Verify that `candidates[i].features` does NOT contain `title` property and `diagnostics.titleExcluded === true`.
   - Test B: Find two catalog books: Book A shares title words with seed but has distinct genre/author; Book B shares genre/author with seed but has zero title word overlap. Verify Book B ranks higher than Book A.
2. **`seed_exclusion_and_deduplication_invariant`**:
   - Verify that none of the 3 seed ISBNs appear in `candidates`.
   - Verify that alternative editions sharing work keys (`dKey`) with seeds do not appear in `candidates`.
   - Verify that no two candidates share the same work key (`dKey`).
3. **`three_seeds_validation_errors`**:
   - Empty body `{}` -> 400 Bad Request.
   - `seeds: []` -> 400 Bad Request.
   - `seeds: ['0439136350', '0345339681']` (2 seeds) -> 400 Bad Request.
   - `seeds: ['0439136350', '0345339681', '0060973129', '0441172660']` (4 seeds) -> 400 Bad Request.
   - Duplicate seeds `['0439136350', '0439136350', '0345339681']` -> 400 Bad Request.
   - Non-existent ISBN `['0439136350', '0345339681', 'UNKNOWN999']` -> 400 Bad Request.
   - Negative weights `{ genre: -0.5 }` -> 400 Bad Request.
   - Non-numeric weights `{ genre: 'super' }` -> 400 Bad Request.
   - All zero weights `{ genre: 0, author: 0, tag: 0, rating: 0 }` -> 400 Bad Request.
4. **`sentiment_boundary_errors`**:
   - Missing rating `{ reviewText: "Great book" }` -> 400 Bad Request.
   - Out of range rating `{ rating: 0 }` and `{ rating: 6 }` -> 400 Bad Request.
   - Empty review text with 5 stars -> 200 OK, sentiment score positive (calibrated from stars).
   - Empty review text with 1 star -> 200 OK, sentiment score negative (calibrated from stars).
   - Non-string review text `{ reviewText: 12345, rating: 4 }` -> 400 Bad Request.
   - Review text $> 5000$ chars -> 400 Bad Request.
   - Non-existent `targetIsbn: "UNKNOWN999"` -> 404 Not Found.
5. **`engine_readiness_503`**:
   - When `engine().ready === false`, requests return 503 Service Unavailable.

#### Tier 3: Cross-Feature Combinations
1. **`three_seed_customizer_rerank`**:
   - Compare candidate order between `{ genre: 1, author: 0, tag: 0, rating: 0 }` and `{ genre: 0, author: 1, tag: 0, rating: 0 }`.
   - Verify rankings adapt dynamically and author-matched books dominate the author-weighted run.
2. **`review_sentiment_to_recommendation_consistency`**:
   - Review submitted with negative tone on "pacing".
   - Adapted recommendations verify that books with high-tempo / thriller / fast-pacing tags are recommended over slow-burn titles.

#### Tier 4: Real-World Scenarios
1. **`full_reading_discovery_loop`**:
   - User picks 3 seed books from catalog.
   - Calls `POST /api/recommend/three`.
   - Power user activates Dev Mode, inspecting `diagnostics.queryTimeMs`, `weightsUsed`, and candidate `features`.
   - User picks top candidate, writes a 5-star review highlighting "world-building".
   - Calls `POST /api/recommend/sentiment-adapted` to expand recommendations.
   - Verifies returned recommendations reinforce world-building and carry diagnostic metadata.

---

## 7. Caveats

1. **Concurrent Milestone 1 Execution**:
   - Milestone 1 is actively implementing the `Review` model and `server/src/routes/reviews.js`.
   - Our design for `POST /api/recommend/sentiment-adapted` is intentionally decoupled from persisted review IDs: it evaluates sentiment on-demand from raw `{ reviewText, rating, targetIsbn }`, allowing it to serve both interactive previews in Dev Mode and automated adaptation upon review submission.
2. **Metadata Inference Dependency**:
   - As documented by Explorer 1, `Books.csv` does not natively contain `genre` or `tag` columns. The engine will infer genres and tags from titles, author bibliographies, and catalog metadata. The API route design consumes the output of `computeHeuristicFeatures` and `scoreCandidate` without coupling to the underlying inference heuristics.
3. **Database Precondition**:
   - The test strategy assumes MongoDB is accessible locally with indexed book documents.

---

## 8. Conclusion

1. The API route layer in `server/src/routes/api.js` provides the optimal location for `POST /api/recommend/three` and `POST /api/recommend/sentiment-adapted`.
2. Strict exclusion of title similarity ($w_{\text{title}} = 0$) is enforced at the route boundary: weight parsing ignores or clamps any title inputs, candidates feature vectors strictly omit title metrics, and responses explicitly report `titleExcluded: true`.
3. Dev Mode diagnostics are cleanly exposed in top-level `diagnostics` objects and candidate `features`/`contributions` properties, ensuring zero leakage into standard Goodreads browsing while providing full transparency for the Dev Mode Diagnostics HUD.
4. Comprehensive error handling and validation matrices are defined, returning appropriate HTTP 400, 404, and 503 status codes.
5. The 4-tier test strategy ensures verified compliance with requirements R3, R4, and R5.

---

## 9. Verification Method

### 9.1 Independent Manual Verification Commands
Once the implementation is applied, run the following verification commands against the local server (`http://localhost:5050`):

1. **Verify 3-Seed Recommendation with Default Weights**:
   ```bash
   curl -s -X POST http://localhost:5050/api/recommend/three \
     -H "Content-Type: application/json" \
     -d '{"seeds": ["0439136350", "0345339681", "0060973129"], "limit": 5}' | jq .
   ```
   *Expected*: HTTP 200, 5 candidates, `diagnostics.titleExcluded == true`, `diagnostics.seedCount == 3`.

2. **Verify Title Similarity Exclusion Invariant**:
   ```bash
   curl -s -X POST http://localhost:5050/api/recommend/three \
     -H "Content-Type: application/json" \
     -d '{"seeds": ["0439136350", "0345339681", "0060973129"], "weights": {"title": 0.8, "genre": 0.2}}' | jq .
   ```
   *Expected*: Response has `diagnostics.titleExcluded == true`, `candidates[0].features.title == null` (absent), and weights strictly applied to supported signals (`genre`, `author`, `tag`, `rating`).

3. **Verify Seed Validation Errors (Duplicate Seeds, Invalid Count)**:
   ```bash
   # Less than 3 seeds -> 400
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5050/api/recommend/three \
     -H "Content-Type: application/json" -d '{"seeds": ["0439136350", "0345339681"]}'
   # Duplicate seeds -> 400
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5050/api/recommend/three \
     -H "Content-Type: application/json" -d '{"seeds": ["0439136350", "0439136350", "0345339681"]}'
   ```
   *Expected*: Both return HTTP `400`.

4. **Verify Sentiment Adaptation (Positive Review)**:
   ```bash
   curl -s -X POST http://localhost:5050/api/recommend/sentiment-adapted \
     -H "Content-Type: application/json" \
     -d '{"reviewText": "An astounding epic with marvelous world-building!", "targetIsbn": "0441172660", "rating": 5}' | jq .
   ```
   *Expected*: HTTP 200, `sentiment.label == "positive"`, `sentiment.score > 0.4`, `sentiment.aspects` contains `"world-building"`, `adaptedRecommendations` returned.

5. **Verify Sentiment Adaptation (Negative Review)**:
   ```bash
   curl -s -X POST http://localhost:5050/api/recommend/sentiment-adapted \
     -H "Content-Type: application/json" \
     -d '{"reviewText": "Painfully slow pacing and utterly boring.", "targetIsbn": "0441172660", "rating": 1}' | jq .
   ```
   *Expected*: HTTP 200, `sentiment.label == "negative"`, `sentiment.score < -0.4`, `sentiment.aspects` contains `"pacing"`.

### 9.2 Automated Test Execution
Run the automated test runner covering recommendation and sentiment test suites:
```bash
node server/src/scripts/smoke.js
node --test tests/recommendation-heuristics.test.js tests/sentiment-analysis.test.js
```

### 9.3 Invalidation Conditions
The design or implementation shall be deemed invalid if:
1. Candidate feature vectors contain a `title` cosine score or if `title` similarity is factored into candidate ranking.
2. `diagnostics.titleExcluded` is `false` or absent.
3. Requests with fewer or more than 3 seeds return HTTP 200 instead of HTTP 400.
4. Duplicate seeds in `seeds` are permitted and result in biased recommendations.
5. Review sentiment polarity contradicts star rating calibration and lexicon indicators (e.g. 5-star glowing review classified as `'negative'`).
