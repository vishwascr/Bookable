# Project: Bookable — iOS-Styled On-Device Goodreads Alternative

## Architecture
Bookable is an on-device MERN architecture (MongoDB, Express, React 19, Node.js ESM) web application.
- **Client (`client/`)**: Single-page application built with React 19 and Vite. Uses iOS-inspired styling (20px rounded corners on cards, modals, and key containers), top-of-viewport algorithm customization controls, an onboarding review carousel with left/right navigation, public community reviews, and a Dev Mode diagnostics toggle revealing real-time telemetry and sentiment analysis internal scores while keeping standard browsing clean.
- **Server (`server/`)**: Express 5 REST API running on Node.js ESM with Mongoose ODM connected to local MongoDB. Features JWT authentication, isolated user libraries, reading status state machine, reviews and star ratings, local rule-based sentiment analysis engine, and a 3-seed heuristic recommendation engine strictly excluding title similarity weighting.
- **Testing Track (`tests/` or dedicated runner)**: Standalone automated test runner and test suites (Tiers 1–4 requirement-driven E2E tests, plus Tier 5 adversarial stress tests) validating auth, isolation, recommendation heuristics, and sentiment processing.

---

## Feature Inventory
Every feature from the survey and requirements is assigned to a milestone. No feature is unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Gap Analysis Document | Comprehensive document detailing Bookable capabilities vs Goodreads alternative and implemented parity features | M3 | R1, Survey E2 |
| 2 | "Want to read" Action | One-click button on search results, single-book recommendations, seed panel, and feeds | M3 | R1, AC1 |
| 3 | Reading Statuses | Full 3-status management (Want to read, Currently reading, Read) with exclusive transitions | M1, M3 | R1, AC1 |
| 4 | Book Catalog Reviews & Ratings | 1-5 star ratings and written reviews for any catalog book | M1, M3 | R1, AC1 |
| 5 | Community Review Stream | Display community reviews and user's review on book modals/details | M1, M3 | R1, AC1 |
| 6 | User Registration, Login & Logout | Secure JWT auth with password hashing, persistent session handling | M1 | R2, AC2 |
| 7 | Multi-Shelf Personal Libraries | Shelves view with tabs (All, Want to Read, Currently Reading, Read, Favourites) | M1, M3 | R2, AC2 |
| 8 | Multi-User Data Isolation | Strict isolation of libraries, shelves, and review mutations by authenticated userId | M1 | R2, AC2 |
| 9 | Settings Page with Reset & Delete | Settings view to reset library books (POST /api/me/reset-books) and delete user reviews (DELETE /api/me/reviews) with confirmation modals | M1, M3 | R2, AC2 |
| 10 | 3-Book Seed Recommendation Engine | Generates suggestions from 3 selected seed books using metadata heuristics (genres, authors, tags, ratings) | M2 | R3, AC3 |
| 11 | Title Similarity Weight Exclusion | Strict exclusion of title similarity weighting (w_title = 0) from the recommendation engine | M2 | R3, AC3 |
| 12 | Algorithm Customization Toggle | Top-of-interface toggle and slider controls to dynamically adjust recommendation parameters | M2, M4 | R3, AC3 |
| 13 | Local Review Sentiment Analyzer | Fast, on-device rule-based sentiment analysis scoring review text on submission | M2 | R3, AC3 |
| 14 | Sentiment-Adapted Recommendations | Dynamic adaptation and expansion of recommendations reflecting sentiment of user reviews | M2, M4 | R3, AC3 |
| 15 | iOS-Inspired 20px Rounded UI | Visual redesign enforcing 20px border-radius on cards, modals, and primary containers | M4 | R4, AC4 |
| 16 | Dev Mode Diagnostics Toggle | Top-bar toggle revealing sentiment analysis outputs, algorithm metrics, and internal state when enabled | M4 | R4, AC4 |
| 17 | Automated Test Infrastructure | Standalone automated test runner and test suites for auth, isolation, recommendations, and sentiment | E2E, M5 | R5, AC5 |
| 18 | Test Suite Pass (Tiers 1-4 & Tier 5) | 100% pass on requirement-driven tests and adversarial coverage hardening | E2E, M5 | R5, AC5 |
| 19 | Production Build & Local Server Reliability | Client production build succeeds and local server operates reliably without fatal crashes | M5 | R5, AC5 |
| 20 | Onboarding Review Carousel Step | Optional review step after selecting 3-5 favorite books during onboarding, featuring left/right navigation arrows, star ratings, and optional text for sentiment analysis | M4 | User Req |
| 21 | Public Community Reviews | Reviews shared by a user are public and visible to any other user viewing that book (in BookDetailModal / community stream) | M1, M3, M4 | User Req |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Independent requirement-driven test suite (Tiers 1-4) covering auth, isolation, recommendations without title similarity, and review sentiment. Publishes TEST_READY.md. | None | DONE |
| M1 | Backend Data Models, Auth, Shelves & Settings | Mongoose Review schema, User schema extension (currentlyReading, read), review endpoints, shelf endpoints, settings reset/delete endpoints with isolation enforcement. | None | DONE |
| M2 | 3-Book Recommendation Engine & Local Sentiment Analyzer | Recommendation algorithm using author, genre, tag, rating heuristics with strict title similarity exclusion. Local rule-based sentiment analyzer and sentiment-adapted recommendations endpoint. | None | DONE |
| M3 | Goodreads Core UX, Shelves, Reviews & Gap Analysis | Universal ReadingStatusButton, overhauled Shelves tab (All, Want to Read, Currently Reading, Read, Favourites), Review submission modal with 1-5 stars & text, SettingsPage.jsx with confirmation modals, and GAP_ANALYSIS.md. | M1 | DONE |
| M4 | iOS-Inspired UI Overhaul, Top Controls, Onboarding Reviews & Dev Mode | 20px rounded corners across cards, modals, containers; top-level Algorithm Customization toggle drawer; Onboarding review carousel with left/right arrows; public review stream verification; Dev Mode toggle & Diagnostics HUD revealing sentiment outputs and algorithm telemetry. | M2, M3 | IN_PROGRESS |
| M5 | Final Milestone: E2E Test Pass, Adversarial Hardening & Production Build | Phase 1: Pass 100% of E2E test suite (Tiers 1-4). Phase 2: Tier 5 adversarial coverage hardening. Production web build and server reliability verification. | M1, M2, M3, M4, E2E | PLANNED |

---

## Interface Contracts

### 1. Backend Data & API Contracts (M1 ↔ M3, M4, M5)

#### User Model Extension (`server/src/models/User.js`)
```javascript
favorites: { type: [String], default: [] },
wantToRead: { type: [String], default: [] },
currentlyReading: { type: [String], default: [] },
read: { type: [String], default: [] },
```

#### Review Model (`server/src/models/Review.js`)
```javascript
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
username: { type: String, required: true },
displayName: { type: String, default: '' },
isbn: { type: String, required: true, index: true },
rating: { type: Number, required: true, min: 1, max: 5 },
text: { type: String, default: '', trim: true, maxlength: 5000 },
sentiment: {
  score: { type: Number, default: 0 }, // -1.0 to 1.0
  label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
  keywords: { type: [String], default: [] },
}
```

#### Reading Status & Shelves Endpoints
- `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`:
  - Setting a status moves the ISBN into the corresponding array and removes it from the other two reading status arrays.
  - Returns updated user shelves object: `{ favorites, wantToRead, currentlyReading, read }`.
- `GET /api/me/shelves`: Returns populated books grouped by shelf (`wantToRead`, `currentlyReading`, `read`, `favorites`).

#### Review Endpoints
- `GET /api/books/:isbn/reviews`: Public. Returns `{ averageRating, totalReviews, ratingCounts: { 1: n, 2: n, ... }, reviews: [...] }`.
- `POST /api/books/:isbn/reviews`: Authenticated (`requireAuth`). Accepts `{ rating: 1-5, text: string }`. Runs local sentiment analyzer, saves review, and returns created review with sentiment data.
- `DELETE /api/reviews/:id`: Authenticated. Verifies `review.userId.equals(req.userId)`. Returns 204.
- `GET /api/me/reviews`: Authenticated. Returns all reviews written by the requesting user.

#### Settings Endpoints
- `POST /api/me/reset-books`: Authenticated. Clears user's `wantToRead`, `currentlyReading`, `read`, and `favorites`. Reviews remain intact.
- `DELETE /api/me/reviews`: Authenticated. Deletes all reviews written by `req.userId`. Shelves remain intact.

---

### 2. Recommendation & Sentiment Engine Contracts (M2 ↔ M3, M4, M5)

#### 3-Book Recommendation Endpoint
- `POST /api/recommend/three`: Accepts:
  ```json
  {
    "seeds": ["isbn1", "isbn2", "isbn3"],
    "weights": {
      "genre": 0.35,
      "author": 0.25,
      "tag": 0.25,
      "rating": 0.15
    },
    "limit": 20
  }
  ```
  - **STRICT ENFORCEMENT**: Title similarity is completely excluded ($w_{\text{title}} = 0$, no title TF-IDF cosine comparison in scoring).
  - Returns `{ candidates: [...booksWithExplanations], diagnostics: { seedCount: 3, weightsUsed, candidatesEvaluated, queryTimeMs } }`.

#### Review Sentiment Analysis & Adaptation Endpoint
- `POST /api/recommend/sentiment-adapted`: Accepts:
  ```json
  {
    "reviewText": "string",
    "targetIsbn": "string",
    "rating": 1-5
  }
  ```
  - Analyzes review sentiment locally (lexicon-based polarity, star calibration, aspect extraction).
  - Returns:
    ```json
    {
      "sentiment": {
        "score": 0.82,
        "label": "positive",
        "keywords": ["masterpiece", "world-building"]
      },
      "adaptedRecommendations": [...books]
    }
    ```

---

### 3. Frontend & UI Contracts (M3, M4 ↔ User & Dev Mode)

#### Global State & Dev Mode Context
- `devMode: boolean` (persisted in localStorage or React context).
- When `devMode === false`: Dev Mode diagnostics, raw sentiment scores, and latency metrics are hidden from standard Goodreads browsing.
- When `devMode === true`: Dev Mode Diagnostics HUD is visible at the top, and cards render diagnostic badges (sentiment breakdown, candidate weights).
- iOS 20px corner radius applied to `.card`, `.auth-card`, `.modal-container`, `.shelf`, `.run`, `.book-card`.
- Onboarding Review Step: After selecting 3-5 onboarding favorites, display optional review carousel with left/right arrows (<kbd>←</kbd> / <kbd>→</kbd>) for each book, allowing 1-5 star ratings and review text for sentiment analysis.
- Public Reviews: Reviews submitted by any user are publicly displayed in the book detail modal for all users.

---

## Code Layout

```
/Users/admin/Documents/Bookable/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthPage.jsx
│   │   │   ├── LogoutPage.jsx
│   │   │   ├── Shelves.jsx              [Updated: 5-shelf tabs, removal, rating display]
│   │   │   ├── SettingsPage.jsx         [New: Reset books, delete reviews]
│   │   │   ├── ReadingStatusButton.jsx  [New: Universal 3-state Goodreads shelf button]
│   │   │   ├── ReviewModal.jsx          [New: 1-5 star rating & review submission]
│   │   │   ├── BookDetailModal.jsx      [New: Book details, reviews, recommendations]
│   │   │   ├── AlgorithmCustomizer.jsx  [New: Top drawer weight sliders]
│   │   │   ├── DevDiagnosticsHUD.jsx    [New: Dev mode telemetry & sentiment view]
│   │   │   ├── ThreeSeedSelector.jsx    [New: 3-seed book picker]
│   │   │   ├── OnboardingReviewStep.jsx [New: Optional review carousel with left/right arrows]
│   │   │   ├── SearchResults.jsx        [Updated: ReadingStatusButton & star rating]
│   │   │   └── ForYou.jsx               [Updated: Sentiment-adapted shelf recommendations]
│   │   ├── App.jsx                      [Updated: Top nav, DevMode state, Settings route, Onboarding flow]
│   │   └── styles.css                   [Updated: iOS 20px rounded containers & iOS tokens]
├── server/
│   ├── src/
│   │   ├── models/
│   │   │   ├── Book.js                  [Book schema with genre/tag/rating metadata helpers]
│   │   │   ├── User.js                  [User schema with currentlyReading & read]
│   │   │   └── Review.js                [New: Review schema with rating, text, sentiment]
│   │   ├── recommender/
│   │   │   ├── algorithms.js            [New 3-seed metadata heuristics: author, genre, tag, rating (NO title)]
│   │   │   ├── sentiment.js             [New: Local lexicon sentiment analysis engine]
│   │   │   ├── engine.js                [Recommender pipeline & candidate generation]
│   │   │   └── metadata.js              [Genre/tag classification & book metadata provider]
│   │   ├── routes/
│   │   │   ├── api.js                   [Book search, 3-seed recommendations, sentiment adaptation]
│   │   │   ├── reviews.js               [New: Review CRUD & community review aggregation]
│   │   │   └── users.js                 [Auth, shelves, settings reset-books & delete-reviews]
│   │   ├── auth.js                      [JWT & requireAuth middleware]
│   │   └── db.js                        [MongoDB connection]
│   │   └── index.js                     [Express route registration]
├── tests/
│   ├── run-all.js                       [Automated test runner script]
│   ├── auth-isolation.test.js           [User auth, token security & per-user data isolation]
│   ├── recommendation-heuristics.test.js[3-seed recommendation heuristics & title exclusion]
│   ├── sentiment-analysis.test.js       [Local review sentiment analysis & adaptation]
│   └── e2e-scenarios.test.js            [Real-world user workflows & Goodreads parity]
├── GAP_ANALYSIS.md                      [Comprehensive Goodreads parity gap analysis report]
├── TEST_INFRA.md                        [Test track index: methodology & coverage thresholds]
└── TEST_READY.md                        [Test track signal of completion]
```
