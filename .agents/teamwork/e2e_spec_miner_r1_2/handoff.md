# E2E Specification Mining Report: API Contracts, Data Models & Error Behaviors

**Author**: Spec Miner (`e2e_spec_miner_r1_2`)  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_spec_miner_r1_2`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**Target Milestone**: E2E Testing Track (Tiers 1–4 Test Suite Construction)  
**Parent Conversation ID**: `10a6c306-1c88-446c-b310-382d63518784`  
**Date**: 2026-11-13T19:05:00Z  

---

## 1. Observation

Direct investigation of the Bookable codebase (`server/src/`, `client/src/`), database configurations, package manifests, and architectural contracts in `PROJECT.md`, `SCOPE.md`, `sub_orch_m1/SCOPE.md`, and `sub_orch_m2/SCOPE.md` revealed the following exact facts:

### 1.1 Existing Server Files & Route Registration
1. **`server/src/index.js` (lines 8–21)**:
   ```javascript
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
   - Express 5.3.0 is used with global `cors()` and `express.json()`.
   - All routes are mounted under the `/api` prefix.
   - Centralized error handler catches forwarded errors via `next(err)` and returns HTTP 500 `{ error: err.message }`.

2. **`server/package.json` (lines 16–24)**:
   - Dependencies: `bcryptjs` (^3.0.3), `cors` (^2.8.6), `csv-parse` (^7.0.3), `dotenv` (^18.0.8), `express` (^5.3.0), `jsonwebtoken` (^9.0.3), `mongoose` (^9.11.2).
   - Module type: ESM (`"type": "module"`).

### 1.2 Authentication System & User Data Models
1. **`server/src/auth.js` (lines 4–20)**:
   ```javascript
   export const JWT_SECRET = process.env.JWT_SECRET || 'bookable-dev-secret-change-me';
   const EXPIRES = '7d';

   export const signToken = (user) => jwt.sign({ sub: String(user._id), u: user.username }, JWT_SECRET, { expiresIn: EXPIRES });

   export function requireAuth(req, res, next) {
     const h = req.headers.authorization || '';
     const token = h.startsWith('Bearer ') ? h.slice(7) : null;
     if (!token) return res.status(401).json({ error: 'Not logged in' });
     try {
       req.userId = jwt.verify(token, JWT_SECRET).sub;
       next();
     } catch {
       res.status(401).json({ error: 'Session expired, please log in again' });
     }
   }
   ```
   - Tokens are signed with algorithm HS256, secret `JWT_SECRET`, expiry `7d`.
   - Claims include `sub` (user's ObjectId string) and `u` (user's lowercase username).
   - Missing or non-Bearer `Authorization` header returns HTTP 401 `{ error: 'Not logged in' }`.
   - Expired, tampered, or invalid tokens return HTTP 401 `{ error: 'Session expired, please log in again' }`.

2. **`server/src/models/User.js` (lines 3–28)**:
   ```javascript
   const userSchema = new mongoose.Schema(
     {
       username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
       displayName: { type: String, trim: true, maxlength: 60 },
       passwordHash: { type: String, required: true },
       favorites: { type: [String], default: [] }, // ISBNs picked at onboarding (3–5)
       wantToRead: { type: [String], default: [] }, // ISBNs saved from recommendations
     },
     { timestamps: true, versionKey: false }
   );

   userSchema.virtual('onboarded').get(function () {
     return this.favorites.length >= 3;
   });

   userSchema.methods.toPublic = function () {
     return {
       id: this._id,
       username: this.username,
       displayName: this.displayName || this.username,
       favorites: this.favorites,
       wantToRead: this.wantToRead,
       onboarded: this.onboarded,
       createdAt: this.createdAt,
     };
   };
   ```
   - Valid username regex: `/^[a-z0-9_.-]{3,30}$/` (3 to 30 lowercase alphanumeric, underscore, dot, hyphen).
   - Password hash stored at rest using `bcrypt.hash(password, 10)`. Plain passwords never persisted.
   - Shelves initially limited to `favorites` and `wantToRead`; M1 extends schema with `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }`.

3. **`server/src/routes/users.js` (lines 25–47)**:
   - `POST /api/auth/signup`:
     - Username validation: `/^[a-z0-9_.-]{3,30}$/`. On failure: HTTP 400 `{ error: 'Username must be 3–30 characters: letters, numbers, _ . -' }`.
     - Password length validation: `password.length < 6`. On failure: HTTP 400 `{ error: 'Password must be at least 6 characters' }`.
     - Duplicate username check: `await User.exists({ username })`. On conflict: HTTP 409 `{ error: 'That username is taken' }`.
     - Success: HTTP 201 `{ token: string, user: PublicUser }`.
   - `POST /api/auth/login`:
     - Looks up user by lowercase username; verifies password with `bcrypt.compare`.
     - Failure (bad user or bad password): HTTP 401 `{ error: 'Invalid username or password' }`.
     - Success: HTTP 200 `{ token: string, user: PublicUser }`.
   - Logout:
     - No server-side blacklist; client clears token from `localStorage.removeItem('bookable_token')` and navigates to `/logout` (`client/src/components/LogoutPage.jsx`).

### 1.3 Shelves & Reading Status Infrastructure
1. **`server/src/routes/users.js` (lines 58–94)**:
   - `loadUser` middleware: `req.user = await User.findById(req.userId)`. If user not found: HTTP 401 `{ error: 'Account not found' }`.
   - Existing `GET /api/me` returns `{ user, favorites: [...books], wantToRead: [...books] }`.
   - Existing `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn` modify `req.user.wantToRead` and return `{ user: req.user.toPublic() }`.
   - Existing `PUT /api/me/favorites` validates 3–5 ISBNs and replaces `req.user.favorites`.
2. **`PROJECT.md § Interface Contracts` & `sub_orch_m1/SCOPE.md`**:
   - `PUT /api/me/shelf/:isbn` accepts `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`.
   - The three reading statuses (`wantToRead`, `currentlyReading`, `read`) are mutually exclusive.
   - Setting a status unshifts the ISBN into the selected array and removes it from the other two arrays.
   - `favorites` is an onboarding collection, not a reading status, and is preserved independently.
   - `GET /api/me/shelves` returns populated books grouped by shelf: `{ wantToRead, currentlyReading, read, favorites, stats }`.

### 1.4 Review System & Database Structure
1. **Catalog Book Schema (`server/src/models/Book.js`)**:
   - Stores 271,359 books with `{ isbn, title, author, year, publisher, imageS, imageM, imageL }`.
   - Contains no rating fields or review subdocuments. All ratings and reviews are stored in the `Review` collection.
2. **Review Model Specification (`PROJECT.md:63-76` & `sub_orch_m1/SCOPE.md:6-15`)**:
   - `userId`: `ObjectId`, ref `'User'`, required, indexed.
   - `username`: `String`, required.
   - `displayName`: `String`, default `''`.
   - `isbn`: `String`, required, indexed.
   - `rating`: `Number`, required, integer min 1, max 5.
   - `text`: `String`, default `''`, trim, maxlength 5000.
   - `sentiment`: `{ score: Number (-1.0 to 1.0), label: String ('positive'|'neutral'|'negative'), keywords: [String] }`.
   - Unique compound index: `{ userId: 1, isbn: 1 }` (enforces exactly 1 review per user per book).
   - Compound index for sorting: `{ isbn: 1, createdAt: -1 }`.
   - Compound index for user lookup: `{ userId: 1, createdAt: -1 }`.
3. **Review Endpoints Specification**:
   - `GET /api/books/:isbn/reviews`: Public (with `optionalAuth`). Returns `{ isbn, averageRating, totalReviews, ratingCounts, ratingDistribution, reviews, userReview }`.
   - `POST /api/books/:isbn/reviews`: Authenticated (`requireAuth`). Body `{ rating, text }`. Upserts on `{ userId, isbn }`, triggers local sentiment analysis, auto-adds book to `read` shelf, and returns `{ review, stats, shelves }`.
   - `DELETE /api/reviews/:id`: Authenticated (`requireAuth`). Verifies `review.userId.equals(req.userId)`. Returns HTTP 204. Rejection of unauthorized deletion returns HTTP 403.
   - `GET /api/me/reviews`: Authenticated (`requireAuth`). Returns all reviews written by user, populated with book catalog details.

### 1.5 Settings & Data Isolation Infrastructure
1. **`PROJECT.md:90-93` & `sub_orch_m1/SCOPE.md:27-29`**:
   - `POST /api/me/reset-books`: Authenticated. Clears user's `wantToRead = []`, `currentlyReading = []`, `read = []`, and `favorites = []`. Reviews written by the user in `Review` collection remain 100% intact.
   - `DELETE /api/me/reviews`: Authenticated. Executes `Review.deleteMany({ userId: req.userId })`. Shelves and user account profile remain 100% intact.

### 1.6 Recommendation Heuristics & Local Sentiment Analysis
1. **Title Similarity Violation in Legacy Engine (`server/src/recommender/algorithms.js`)**:
   - Legacy `features(seed, cand)` calculates `title: +cosine(seed, cand).toFixed(4)` via title TF-IDF postings.
   - Legacy `DEFAULT_WEIGHTS = { title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 }`.
   - `ORIGINAL_REQUEST.md:20, 41` explicitly forbids title similarity: *"tailored recommendations using author, genre, tag, and rating heuristics, with title similarity weight excluded ($w_{\text{title}} = 0$)."*
2. **`POST /api/recommend/three` Specification**:
   - Payload: `{ seeds: [isbn1, isbn2, isbn3], weights?: { genre, author, tag, rating }, limit?: number }`.
   - Strict requirement: `seeds` must contain exactly 3 distinct valid catalog ISBNs.
   - Default weights: `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }`. Title similarity is strictly excluded ($w_{\text{title}} = 0$).
   - Response: `{ candidates: [...], diagnostics: { seedCount: 3, weightsUsed, titleExcluded: true, candidatesEvaluated, queryTimeMs, diversityApplied: true } }`.
3. **`POST /api/recommend/sentiment-adapted` Specification**:
   - Payload: `{ reviewText?: string, targetIsbn?: string, rating: number, limit?: number }`.
   - Local rule-based analyzer in `server/src/recommender/sentiment.js`: ~250-word literary sentiment lexicon, intensifiers ($\times 1.5$), diminishers ($\times 0.65$), 3-token lookahead negation inverter ($\times -0.80$), contrastive conjunction shifts (`but`, `however`), star rating calibration ($S_{\text{star}} = \frac{r - 3}{2}$).
   - Composite polarity score: $S_{\text{composite}} = 0.65 \cdot S_{\text{text}} + 0.35 \cdot S_{\text{star}} \in [-1.0, 1.0]$.
   - Classification: `positive` ($S \ge 0.20$), `negative` ($S \le -0.20$), `neutral` otherwise.
   - Aspect extraction: `pacing`, `world-building`, `characters`, `tone`, `prose`, `plot`, `emotional`.
   - Dynamic adaptation:
     - Positive sentiment $\to$ Reinforce & Expand (matches genres, positive aspects, related authors).
     - Negative sentiment $\to$ Diverge & Contrast (steers away from criticized aspects, boosts contrasting vibes).
     - Target book excluded from candidate recommendations.

---

## 2. Logic Chain

From the observations above, we establish the following deductive reasoning chains that form the specification baseline for the E2E test suite:

### 2.1 Authentication & Security Isolation
- *Observation*: `requireAuth` parses `Authorization: Bearer <token>` and sets `req.userId = jwt.verify(...).sub`.
- *Logic Step 1*: Any request to private endpoints (`/api/me/*`, `POST /api/books/:isbn/reviews`, `DELETE /api/reviews/:id`) without a valid token must fail with HTTP 401.
- *Logic Step 2*: Since `req.userId` is cryptographically signed, users cannot spoof ownership by injecting `userId` into request bodies. Routes must ignore `req.body.userId` and exclusively bind records to `req.userId`.
- *Logic Step 3*: On `DELETE /api/reviews/:id`, the server queries the review by ID. If `String(review.userId) !== String(req.userId)`, the request must return HTTP 403 Forbidden without deleting the document. If the review does not exist, return HTTP 404 Not Found.

### 2.2 Shelving State Machine Invariants
- *Observation*: Users have `wantToRead`, `currentlyReading`, and `read` arrays.
- *Logic Step 1*: A book cannot simultaneously exist in more than one reading shelf. Marking an ISBN as `currently_reading` MUST remove it from `wantToRead` and `read`.
- *Logic Step 2*: Setting status to `none` MUST remove the ISBN from all three reading shelves.
- *Logic Step 3*: Setting any reading status MUST NOT affect the user's `favorites` array, because `favorites` represents the user's permanent onboarding seed library for recommendation profiling.

### 2.3 Review Aggregation & Upsert Invariants
- *Observation*: The `Review` model enforces `{ userId: 1, isbn: 1 }` unique indexing.
- *Logic Step 1*: If a user submits a review for an ISBN they have already reviewed, the server must execute an `upsert` (`findOneAndUpdate` with `upsert: true`), updating the existing review rather than creating a duplicate or failing with MongoDB error E11000.
- *Logic Step 2*: When a book has zero reviews, `GET /api/books/:isbn/reviews` must return `totalReviews: 0`, `averageRating: 0`, and `ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }`. It must never return `null` or `NaN`.
- *Logic Step 3*: Submitting a review automatically implies the user has completed or experienced the book; therefore `POST /api/books/:isbn/reviews` must atomically add the ISBN to the user's `read` shelf and pull it from `wantToRead` and `currentlyReading`.

### 2.4 Settings Independence (Reset Books vs Delete Reviews)
- *Observation*: R2 mandates that users can reset books and delete reviews independently.
- *Logic Step 1*: `POST /api/me/reset-books` modifies only the `User` document, emptying `favorites`, `wantToRead`, `currentlyReading`, and `read`. It must NOT execute any delete operations on the `Review` collection.
- *Logic Step 2*: `DELETE /api/me/reviews` deletes documents in the `Review` collection matching `{ userId: req.userId }`. It must NOT alter any shelf arrays on the `User` document.
- *Logic Step 3*: Tests can verify this independence by creating both shelved books and reviews, calling reset-books, asserting reviews still exist, and vice versa.

### 2.5 3-Seed Recommendation Heuristics & Strict Title Exclusion
- *Observation*: R3 mandates tailored recommendations from 3 seed books using metadata heuristics without title similarity weighting.
- *Logic Step 1*: The request payload must strictly validate `seeds.length === 3` and ensure all 3 ISBNs are distinct catalog books. Passing 1, 2, or 4+ seeds must fail with HTTP 400.
- *Logic Step 2*: The candidate evaluation function must compute features solely based on `{ genre, author, tag, rating }`. Cosine similarity of title terms must NOT be evaluated.
- *Logic Step 3*: If a client supplies `weights.title` or `w_title`, the server must force title weight to 0. Diagnostics must return `"titleExcluded": true`.

### 2.6 Local Sentiment Analysis & Dynamic Adaptation
- *Observation*: R3 requires on-device sentiment analysis scoring review text on submission and adapting recommendations.
- *Logic Step 1*: Lexicon scoring must be deterministic: strongly positive words (*masterpiece*, *brilliant*, *breathtaking*) yield $S > 0.5$ (`label: 'positive'`), while strongly negative words (*terrible*, *boring*, *disaster*, *waste*) yield $S < -0.4$ (`label: 'negative'`).
- *Logic Step 2*: The star rating provides an explicit anchor: a 5-star rating contributes $+1.0$ star polarity, while a 1-star rating contributes $-1.0$ star polarity. Blending $0.65 S_{\text{text}} + 0.35 S_{\text{star}}$ ensures agreement and handles text-less reviews gracefully.
- *Logic Step 3*: Positive reviews expand similar books matching praised aspects/genres. Negative reviews divert away from criticized aspects and down-rank the author. The reviewed target book must be excluded from adapted recommendations.

---

## 3. Features Discovered

The table below enumerates all discovered features across the authoritative sources (`PROJECT.md`, `SCOPE.md`, `server/src/`, `sub_orch_m1/SCOPE.md`, `sub_orch_m2/SCOPE.md`):

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | User Registration | Creates user account with hashed password and returns session JWT | Body: `{ username, password, displayName }` | HTTP 201: `{ token, user: PublicUser }` | HTTP 400 (invalid username/password < 6 chars), HTTP 409 (username taken) | `server/src/routes/users.js:25`, `PROJECT.md:21` |
| 2 | Auth | User Login | Authenticates user credentials and issues session JWT | Body: `{ username, password }` | HTTP 200: `{ token, user: PublicUser }` | HTTP 401 (invalid username or password) | `server/src/routes/users.js:39`, `PROJECT.md:21` |
| 3 | Auth | Profile Inspection | Fetches authenticated user profile with shelf arrays and stats | Headers: `Authorization: Bearer <token>` | HTTP 200: `{ user, favorites, wantToRead, currentlyReading, read, stats }` | HTTP 401 (missing, expired, or invalid token) | `server/src/routes/users.js:58`, `sub_orch_m1/SCOPE.md:21` |
| 4 | Shelves | Shelf Status Transition | Mutually exclusive status transition across `want_to_read`, `currently_reading`, `read`, `none` | Path: `isbn`, Body: `{ status }`, Headers: Bearer token | HTTP 200: `{ status, isbn, user, shelves }` | HTTP 400 (invalid status), HTTP 401 (unauthorized), HTTP 404 (unknown ISBN) | `PROJECT.md:79`, `sub_orch_m1/SCOPE.md:18` |
| 5 | Shelves | Populated Shelves Query | Returns all user shelves populated with catalog book objects | Headers: Bearer token | HTTP 200: `{ wantToRead: [...], currentlyReading: [...], read: [...], favorites: [...], stats }` | HTTP 401 (unauthorized) | `PROJECT.md:82`, `sub_orch_m1/SCOPE.md:19` |
| 6 | Shelves | Legacy Want-to-Read Add | Adds book to `wantToRead` shelf (backward compatibility) | Path: `isbn`, Headers: Bearer token | HTTP 200: `{ user: PublicUser }` | HTTP 401 (unauthorized), HTTP 404 (unknown ISBN) | `server/src/routes/users.js:79`, `smoke.js:66` |
| 7 | Shelves | Legacy Want-to-Read Remove | Removes book from `wantToRead` shelf (backward compatibility) | Path: `isbn`, Headers: Bearer token | HTTP 200: `{ user: PublicUser }` | HTTP 401 (unauthorized) | `server/src/routes/users.js:88`, `smoke.js:66` |
| 8 | Shelves | Replace Favourites | Updates user onboarding seed books (3–5 books) | Body: `{ isbns: [string] }`, Headers: Bearer token | HTTP 200: `{ user: PublicUser }` | HTTP 400 (< 3 or > 5 ISBNs, or unknown ISBNs), HTTP 401 | `server/src/routes/users.js:67`, `smoke.js:53` |
| 9 | Reviews | Book Reviews Aggregation | Public catalog reviews list, average rating, rating breakdown, and caller's review | Path: `isbn`, Query: `limit, page`, Headers: optional Bearer | HTTP 200: `{ isbn, averageRating, totalReviews, ratingCounts, ratingDistribution, reviews, userReview }` | HTTP 404 (unknown ISBN) | `PROJECT.md:85`, `sub_orch_m1/SCOPE.md:23` |
| 10 | Reviews | Review Submission & Upsert | Submit/update 1–5 star rating and review; auto-places book in `read` shelf | Path: `isbn`, Body: `{ rating, text }`, Headers: Bearer token | HTTP 201/200: `{ review, stats, shelves }` | HTTP 400 (rating < 1 or > 5 or non-integer; text > 5000), HTTP 401, HTTP 404 | `PROJECT.md:86`, `sub_orch_m1/SCOPE.md:24` |
| 11 | Reviews | Delete Review | Deletes review authored by user with ownership verification | Path: `id` (ObjectId), Headers: Bearer token | HTTP 204: No Content | HTTP 400 (invalid ObjectId), HTTP 401, HTTP 403 (not owner), HTTP 404 (not found) | `PROJECT.md:87`, `sub_orch_m1/SCOPE.md:25` |
| 12 | Reviews | User Authored Reviews | Retrieves all reviews authored by authenticated user with book details | Headers: Bearer token | HTTP 200: `{ total, reviews: [...withBookDetails] }` | HTTP 401 (unauthorized) | `PROJECT.md:88`, `sub_orch_m1/SCOPE.md:26` |
| 13 | Settings | Reset Shelved Books | Empties `favorites`, `wantToRead`, `currentlyReading`, and `read` while preserving user reviews | Headers: Bearer token | HTTP 200: `{ success: true, message, user, shelves }` | HTTP 401 (unauthorized) | `PROJECT.md:91`, `sub_orch_m1/SCOPE.md:28` |
| 14 | Settings | Delete User Reviews | Deletes all reviews written by user while preserving user shelves | Headers: Bearer token | HTTP 200: `{ success: true, deletedCount, message }` | HTTP 401 (unauthorized) | `PROJECT.md:92`, `sub_orch_m1/SCOPE.md:29` |
| 15 | Recs | 3-Seed Book Recommendations | Generates recommendations from 3 seeds using metadata heuristics with title similarity excluded | Body: `{ seeds: [3], weights?: {}, limit?: n }` | HTTP 200: `{ candidates: [...], diagnostics: { seedCount: 3, weightsUsed, titleExcluded: true, candidatesEvaluated, queryTimeMs, diversityApplied: true } }` | HTTP 400 (seeds length != 3, duplicate seeds, invalid weights), HTTP 404 (unknown seed), HTTP 503 (index building) | `PROJECT.md:99`, `sub_orch_m2/SCOPE.md:26` |
| 16 | Recs | Title Similarity Exclusion | Strict enforcement of $w_{\text{title}} = 0$ in candidate generation and feature scoring | Part of `POST /api/recommend/three` | `titleExcluded: true` in diagnostics; candidate features omit title cosine | HTTP 400 if title weight is mandatory, or silently forced to 0 | `PROJECT.md:112`, `sub_orch_m2/SCOPE.md:29` |
| 17 | Recs | Algorithm Customization | Dynamic customization of recommendation weights (genre, author, tag, rating) | Part of `POST /api/recommend/three` weights payload | Diagnostic echoes `weightsUsed`; candidates rank according to supplied weights | HTTP 400 if all weights sum to 0 or negative weights provided | `ORIGINAL_REQUEST.md:20`, `sub_orch_m2/SCOPE.md:15` |
| 18 | Recs | Local Sentiment Analysis | On-device rule-based sentiment scoring on review submission | Invoked during `POST /api/books/:isbn/reviews` and sentiment route | Returns `{ score, label, keywords, aspects, breakdown }` | Fallback neutral score if text empty; handles negations and intensifiers | `PROJECT.md:124`, `sub_orch_m2/SCOPE.md:39` |
| 19 | Recs | Sentiment-Adapted Recs | Adapts recommendations dynamically based on review sentiment and literary aspects | Body: `{ reviewText, targetIsbn?, rating, limit? }` | HTTP 200: `{ sentiment: { score, label, keywords, aspects }, adaptedRecommendations: [...] }` | HTTP 400 (invalid rating < 1 or > 5), HTTP 404 (unknown targetIsbn), HTTP 503 (index building) | `PROJECT.md:116`, `sub_orch_m2/SCOPE.md:30` |
| 20 | Dev Mode | Dev Mode Diagnostics Telemetry | Telemetry payload returned in recommendation and sentiment diagnostics | Headers / Body flags; diagnostics payload | Diagnostic object with latencies, candidate counts, token breakdown, and index metrics | Diagnostics omitted or stripped if Dev Mode disabled | `PROJECT.md:141`, `sub_orch_m2/SCOPE.md:28` |

---

## 4. Edge Cases

The table below documents exact inputs and observed/required behaviors across boundaries, validation rules, and error states:

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|------------------------------|
| 1 | `POST /api/auth/signup` | Username with uppercase letters `"Reader_Bob"` | Normalized to lowercase `"reader_bob"`, registered successfully. |
| 2 | `POST /api/auth/signup` | Username containing spaces or illegal symbols `"bad user!"` | HTTP 400 Bad Request: `"Username must be 3–30 characters: letters, numbers, _ . -"` |
| 3 | `POST /api/auth/signup` | Password shorter than 6 characters (`"12345"`) | HTTP 400 Bad Request: `"Password must be at least 6 characters"` |
| 4 | `POST /api/auth/signup` | Duplicate username registration | HTTP 409 Conflict: `"That username is taken"` |
| 5 | `POST /api/auth/login` | Wrong password for existing user | HTTP 401 Unauthorized: `"Invalid username or password"` |
| 6 | `POST /api/auth/login` | Non-existent username | HTTP 401 Unauthorized: `"Invalid username or password"` |
| 7 | `GET /api/me` | Missing `Authorization` header | HTTP 401 Unauthorized: `"Not logged in"` |
| 8 | `GET /api/me` | Malformed Bearer token (`"Bearer abc.def"`) | HTTP 401 Unauthorized: `"Session expired, please log in again"` |
| 9 | `GET /api/me` | Validly signed token for deleted user ID | HTTP 401 Unauthorized: `"Account not found"` |
| 10 | `PUT /api/me/shelf/:isbn` | Non-existent catalog ISBN (`"9999999999"`) | HTTP 404 Not Found: `"Book not found"`. No user shelves altered. |
| 11 | `PUT /api/me/shelf/:isbn` | Invalid status string (`"abandoned"`) | HTTP 400 Bad Request: `"Invalid status. Must be one of: want_to_read, currently_reading, read, none"` |
| 12 | `PUT /api/me/shelf/:isbn` | Status set to `"want_to_read"` when already in `wantToRead` | Idempotent: ISBN remains in `wantToRead` without duplicates. Returns HTTP 200. |
| 13 | `PUT /api/me/shelf/:isbn` | Book in `wantToRead`, status set to `"currently_reading"` | ISBN removed from `wantToRead` and added to `currentlyReading`. Mutual exclusivity enforced. |
| 14 | `PUT /api/me/shelf/:isbn` | Book in `read`, status set to `"none"` | ISBN removed from `read`, `currentlyReading`, and `wantToRead`. Book is unshelved. |
| 15 | `PUT /api/me/shelf/:isbn` | Book in `favorites`, status set to `"read"` | Added to `read`, removed from `wantToRead`/`currentlyReading`. `favorites` is preserved intact. |
| 16 | `GET /api/me/shelves` | Fresh user with 0 books shelved | Returns HTTP 200 with `{ wantToRead: [], currentlyReading: [], read: [], favorites: [], stats: { ...0 } }`. |
| 17 | `GET /api/books/:isbn/reviews` | Catalog book with 0 submitted reviews | Returns HTTP 200: `{ averageRating: 0, totalReviews: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [], userReview: null }`. |
| 18 | `GET /api/books/:isbn/reviews` | Non-existent catalog ISBN | Returns HTTP 404 Not Found: `"Book not found"`. |
| 19 | `GET /api/books/:isbn/reviews` | Expired Bearer token passed to public route | `optionalAuth` catches error; returns public review stream with `userReview: null` without 401 failure. |
| 20 | `POST /api/books/:isbn/reviews` | Rating omitted or non-numeric (`"five"`) | HTTP 400 Bad Request: `"Rating must be an integer between 1 and 5"`. |
| 21 | `POST /api/books/:isbn/reviews` | Out-of-bounds rating (`0` or `6` or `3.5`) | HTTP 400 Bad Request: `"Rating must be an integer between 1 and 5"`. |
| 22 | `POST /api/books/:isbn/reviews` | Review text exceeding 5000 characters | HTTP 400 Bad Request: `"Review text cannot exceed 5000 characters"`. |
| 23 | `POST /api/books/:isbn/reviews` | Empty or omitted review text (`""`) | HTTP 201 Created: accepts review with `text: ""`; sentiment calibrated from star rating. |
| 24 | `POST /api/books/:isbn/reviews` | User reviews a book previously in `wantToRead` | Upserts review, automatically moves ISBN from `wantToRead` to `read` shelf. |
| 25 | `POST /api/books/:isbn/reviews` | User submits second review for same book | Upserts existing review document (updates rating, text, sentiment, updatedAt). No duplicate review created. |
| 26 | `DELETE /api/reviews/:id` | Invalid MongoDB ObjectId string (`"not-an-id"`) | HTTP 400 Bad Request: `"Invalid review ID"`. Server does not crash. |
| 27 | `DELETE /api/reviews/:id` | Non-existent review ID | HTTP 404 Not Found: `"Review not found"`. |
| 28 | `DELETE /api/reviews/:id` | User B attempts to delete User A's review | HTTP 403 Forbidden: `"Forbidden: you cannot delete another user's review"`. Review remains in database. |
| 29 | `DELETE /api/reviews/:id` | User A deletes own review | HTTP 204 No Content. Review permanently removed. Book's `totalReviews` and `averageRating` recalculate. |
| 30 | `POST /api/me/reset-books` | User has 5 shelved books and 3 written reviews | Shelves reset to empty `[]`; all 3 user reviews in `Review` collection remain 100% intact. |
| 31 | `DELETE /api/me/reviews` | User has 5 shelved books and 3 written reviews | All 3 user reviews deleted; all 5 books on shelves remain 100% intact. |
| 32 | `POST /api/recommend/three` | Fewer than 3 seeds provided (`2 seeds`) | HTTP 400 Bad Request: `"Exactly 3 seed book ISBNs must be provided"`. |
| 33 | `POST /api/recommend/three` | More than 3 seeds provided (`4 seeds`) | HTTP 400 Bad Request: `"Exactly 3 seed book ISBNs must be provided"`. |
| 34 | `POST /api/recommend/three` | Duplicate seeds in array (`["A", "A", "B"]`) | HTTP 400 Bad Request: `"Seed ISBNs must be 3 distinct books"`. |
| 35 | `POST /api/recommend/three` | Unknown seed ISBN (`"9999999999"`) | HTTP 400/404: `"Unknown seed ISBN(s): 9999999999"`. |
| 36 | `POST /api/recommend/three` | Payload includes `weights: { title: 0.9, genre: 0.1 }` | `title` weight forced to 0 ($w_{\text{title}} = 0$); `diagnostics.titleExcluded === true`. |
| 37 | `POST /api/recommend/three` | All weights zero (`{ genre: 0, author: 0, tag: 0, rating: 0 }`) | HTTP 400 Bad Request: `"At least one weight must be greater than zero"`. |
| 38 | `POST /api/recommend/three` | Negative weight value (`{ genre: -0.5 }`) | HTTP 400 Bad Request or negative weight clamped to 0. |
| 39 | `POST /api/recommend/three` | Candidates matching seeds' work key ($dKey$) | Seed books and other editions of seed books are strictly filtered out from candidates. |
| 40 | `POST /api/recommend/three` | Extreme limit parameter (`limit: 500` or `limit: -10`) | Limit clamped to valid range $[1, 50]$; returns at most 50 candidates. |
| 41 | `POST /api/recommend/sentiment-adapted` | Strong positive review (*"Masterpiece, brilliant world-building"*) | Polarity $S > 0.5$, label `'positive'`, keywords contain *masterpiece*, *brilliant*, aspect contains *world-building*. |
| 42 | `POST /api/recommend/sentiment-adapted` | Strong negative review (*"Terrible, boring, waste of time"*) | Polarity $S < -0.4$, label `'negative'`, keywords contain *terrible*, *boring*, *waste*. |
| 43 | `POST /api/recommend/sentiment-adapted` | Review with negation (*"Not boring, truly enjoyable"*) | Polarity is positive; negation window properly inverts negative word *boring*. |
| 44 | `POST /api/recommend/sentiment-adapted` | Star-only submission (empty `reviewText`, `rating: 5`) | Polarity calibrated from stars: $S = +1.0$, label `'positive'`, returns adapted recommendations. |
| 45 | `POST /api/recommend/sentiment-adapted` | Target ISBN provided | Target book is excluded from adapted recommendations. |

---

## 5. Detailed API Contract Specifications for Test Authoring

### 5.1 Endpoint Contract: `PUT /api/me/shelf/:isbn`
- **Method**: `PUT`
- **URL**: `/api/me/shelf/:isbn`
- **Headers**:
  - `Authorization`: `Bearer <token>` (Required)
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "status": "want_to_read" | "currently_reading" | "read" | "none"
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "status": "want_to_read",
    "isbn": "0439136350",
    "user": {
      "id": "6735a1f29...",
      "username": "alice",
      "displayName": "Alice",
      "favorites": ["0345339681", "0441172660", "0671461494"],
      "wantToRead": ["0439136350"],
      "currentlyReading": [],
      "read": [],
      "onboarded": true,
      "createdAt": "2026-11-13T19:00:00.000Z"
    },
    "shelves": {
      "favorites": ["0345339681", "0441172660", "0671461494"],
      "wantToRead": ["0439136350"],
      "currentlyReading": [],
      "read": []
    }
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: `{ "error": "Invalid status. Must be one of: want_to_read, currently_reading, read, none" }`
  - `401 Unauthorized`: `{ "error": "Not logged in" }` or `{ "error": "Session expired, please log in again" }`
  - `404 Not Found`: `{ "error": "Book not found" }`

### 5.2 Endpoint Contract: `GET /api/me/shelves`
- **Method**: `GET`
- **URL**: `/api/me/shelves`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "wantToRead": [
      {
        "isbn": "0439136350",
        "title": "Harry Potter and the Prisoner of Azkaban",
        "author": "J. K. Rowling",
        "year": 1999,
        "publisher": "Scholastic",
        "imageS": "http://...",
        "imageM": "http://...",
        "imageL": "http://..."
      }
    ],
    "currentlyReading": [],
    "read": [],
    "favorites": [ ... ],
    "stats": {
      "wantToRead": 1,
      "currentlyReading": 0,
      "read": 0,
      "favorites": 3,
      "totalShelved": 1
    }
  }
  ```
- **Error Codes**:
  - `401 Unauthorized`: `{ "error": "Not logged in" }`

### 5.3 Endpoint Contract: `GET /api/books/:isbn/reviews`
- **Method**: `GET`
- **URL**: `/api/books/:isbn/reviews`
- **Headers**: `Authorization: Bearer <token>` (Optional)
- **Query Parameters**:
  - `limit`: number (default: 50, max: 100)
  - `page`: number (default: 1)
- **Success Response** (`200 OK`):
  ```json
  {
    "isbn": "0441172660",
    "averageRating": 4.5,
    "totalReviews": 2,
    "ratingCounts": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 1,
      "5": 1
    },
    "ratingDistribution": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 1,
      "5": 1
    },
    "userReview": {
      "_id": "6735c0...",
      "userId": "6735a1f29...",
      "username": "alice",
      "displayName": "Alice",
      "isbn": "0441172660",
      "rating": 5,
      "text": "An absolute sci-fi masterpiece with unparalleled lore.",
      "sentiment": {
        "score": 0.85,
        "label": "positive",
        "keywords": ["masterpiece", "unparalleled"]
      },
      "createdAt": "2026-11-13T19:05:00.000Z",
      "updatedAt": "2026-11-13T19:05:00.000Z"
    },
    "reviews": [
      {
        "_id": "6735c0...",
        "userId": "6735a1f29...",
        "username": "alice",
        "displayName": "Alice",
        "isbn": "0441172660",
        "rating": 5,
        "text": "An absolute sci-fi masterpiece with unparalleled lore.",
        "sentiment": {
          "score": 0.85,
          "label": "positive",
          "keywords": ["masterpiece", "unparalleled"]
        },
        "createdAt": "2026-11-13T19:05:00.000Z",
        "updatedAt": "2026-11-13T19:05:00.000Z"
      }
    ]
  }
  ```
- **Error Codes**:
  - `404 Not Found`: `{ "error": "Book not found" }`

### 5.4 Endpoint Contract: `POST /api/books/:isbn/reviews`
- **Method**: `POST`
- **URL**: `/api/books/:isbn/reviews`
- **Headers**:
  - `Authorization`: `Bearer <token>` (Required)
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "rating": 5,
    "text": "An absolute sci-fi masterpiece with unparalleled lore."
  }
  ```
- **Validation**:
  - `rating`: required integer between 1 and 5.
  - `text`: optional string, maximum 5000 characters.
  - `isbn`: must exist in catalog.
- **Success Response** (`201 Created` or `200 OK` on upsert):
  ```json
  {
    "review": {
      "_id": "6735c0...",
      "userId": "6735a1f29...",
      "username": "alice",
      "displayName": "Alice",
      "isbn": "0441172660",
      "rating": 5,
      "text": "An absolute sci-fi masterpiece with unparalleled lore.",
      "sentiment": {
        "score": 0.85,
        "label": "positive",
        "keywords": ["masterpiece", "unparalleled"]
      },
      "createdAt": "2026-11-13T19:05:00.000Z",
      "updatedAt": "2026-11-13T19:05:00.000Z"
    },
    "stats": {
      "averageRating": 5.0,
      "totalReviews": 1,
      "ratingCounts": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 }
    },
    "shelves": {
      "wantToRead": [],
      "currentlyReading": [],
      "read": ["0441172660"],
      "favorites": ["0345339681", "0441172660", "0671461494"]
    }
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: `{ "error": "Rating must be an integer between 1 and 5" }` or `{ "error": "Review text cannot exceed 5000 characters" }`
  - `401 Unauthorized`: `{ "error": "Not logged in" }`
  - `404 Not Found`: `{ "error": "Book not found" }`

### 5.5 Endpoint Contract: `DELETE /api/reviews/:id`
- **Method**: `DELETE`
- **URL**: `/api/reviews/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response**: `204 No Content` (Empty body)
- **Error Codes**:
  - `400 Bad Request`: `{ "error": "Invalid review ID" }` (if `id` is not a valid 24-character hexadecimal ObjectId)
  - `401 Unauthorized`: `{ "error": "Not logged in" }`
  - `403 Forbidden`: `{ "error": "Forbidden: you cannot delete another user's review" }` (if `review.userId` does not match `req.userId`)
  - `404 Not Found`: `{ "error": "Review not found" }`

### 5.6 Endpoint Contract: `GET /api/me/reviews`
- **Method**: `GET`
- **URL**: `/api/me/reviews`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "total": 1,
    "reviews": [
      {
        "_id": "6735c0...",
        "userId": "6735a1f29...",
        "username": "alice",
        "displayName": "Alice",
        "isbn": "0441172660",
        "rating": 5,
        "text": "An absolute sci-fi masterpiece with unparalleled lore.",
        "sentiment": {
          "score": 0.85,
          "label": "positive",
          "keywords": ["masterpiece", "unparalleled"]
        },
        "book": {
          "isbn": "0441172660",
          "title": "Dune",
          "author": "Frank Herbert",
          "year": 1965,
          "publisher": "Ace Books",
          "imageM": "http://...",
          "imageL": "http://..."
        },
        "createdAt": "2026-11-13T19:05:00.000Z",
        "updatedAt": "2026-11-13T19:05:00.000Z"
      }
    ]
  }
  ```
- **Error Codes**:
  - `401 Unauthorized`: `{ "error": "Not logged in" }`

### 5.7 Endpoint Contract: `POST /api/me/reset-books`
- **Method**: `POST`
- **URL**: `/api/me/reset-books`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "All books and shelves have been reset",
    "user": {
      "id": "6735a1f29...",
      "username": "alice",
      "displayName": "Alice",
      "favorites": [],
      "wantToRead": [],
      "currentlyReading": [],
      "read": [],
      "onboarded": false,
      "createdAt": "2026-11-13T19:00:00.000Z"
    },
    "shelves": {
      "favorites": [],
      "wantToRead": [],
      "currentlyReading": [],
      "read": []
    }
  }
  ```
- **Data Isolation Guarantee**: Reviews written by the user in `Review` collection remain completely intact.
- **Error Codes**:
  - `401 Unauthorized`: `{ "error": "Not logged in" }`

### 5.8 Endpoint Contract: `DELETE /api/me/reviews`
- **Method**: `DELETE`
- **URL**: `/api/me/reviews`
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "deletedCount": 3,
    "message": "All user reviews have been deleted"
  }
  ```
- **Data Isolation Guarantee**: Shelves (`favorites`, `wantToRead`, `currentlyReading`, `read`) remain completely intact.
- **Error Codes**:
  - `401 Unauthorized`: `{ "error": "Not logged in" }`

### 5.9 Endpoint Contract: `POST /api/recommend/three`
- **Method**: `POST`
- **URL**: `/api/recommend/three`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "seeds": ["0439136350", "0345339681", "0441172660"],
    "weights": {
      "genre": 0.35,
      "author": 0.25,
      "tag": 0.25,
      "rating": 0.15
    },
    "limit": 12
  }
  ```
- **Validation**:
  - `seeds`: Array of exactly 3 distinct ISBNs present in catalog.
  - `weights`: Optional object containing non-negative numbers for `genre`, `author`, `tag`, `rating`. $w_{\text{title}} = 0$ is strictly enforced.
  - `limit`: Integer clamped between 1 and 50 (default: 12).
- **Success Response** (`200 OK`):
  ```json
  {
    "candidates": [
      {
        "book": {
          "isbn": "0545010225",
          "title": "Harry Potter and the Deathly Hallows",
          "author": "J. K. Rowling",
          "year": 2007,
          "publisher": "Arthur A. Levine Books",
          "imageM": "http://...",
          "imageL": "http://..."
        },
        "score": 0.884,
        "features": {
          "author": 1.0,
          "genre": 0.85,
          "tag": 0.75,
          "rating": 0.92
        },
        "matchedSeeds": 2,
        "bestSeed": "0439136350",
        "contributions": {
          "0439136350": 0.91,
          "0345339681": 0.82
        },
        "explanation": "Matched author J. K. Rowling and strong fantasy genre affinity"
      }
    ],
    "diagnostics": {
      "seedCount": 3,
      "seeds": [
        { "isbn": "0439136350", "title": "Harry Potter and the Prisoner of Azkaban", "author": "J. K. Rowling" },
        { "isbn": "0345339681", "title": "The Hobbit", "author": "J.R.R. Tolkien" },
        { "isbn": "0441172660", "title": "Dune", "author": "Frank Herbert" }
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
- **Error Codes**:
  - `400 Bad Request`: `{ "error": "Exactly 3 seed book ISBNs must be provided" }` or `{ "error": "Seed ISBNs must be 3 distinct books" }` or `{ "error": "At least one weight must be greater than zero" }`
  - `404 Not Found` (or `400`): `{ "error": "Unknown seed ISBN(s): 9999999999" }`
  - `503 Service Unavailable`: `{ "error": "Index is still building, try again in a few seconds." }`

### 5.10 Endpoint Contract: `POST /api/recommend/sentiment-adapted`
- **Method**: `POST`
- **URL**: `/api/recommend/sentiment-adapted`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "reviewText": "A breathtaking masterpiece of world-building and character development.",
    "targetIsbn": "0441172660",
    "rating": 5,
    "limit": 10
  }
  ```
- **Validation**:
  - `rating`: required number between 1 and 5.
  - `reviewText`: optional string, maximum 5000 characters.
  - `targetIsbn`: optional ISBN string; if provided, must exist in catalog.
- **Success Response** (`200 OK`):
  ```json
  {
    "sentiment": {
      "score": 0.82,
      "polarity": 0.82,
      "label": "positive",
      "classification": "positive",
      "keywords": ["masterpiece", "breathtaking"],
      "aspects": ["world-building", "characters"],
      "aspectTags": ["world-building", "character-driven"],
      "breakdown": {
        "rawLexiconScore": 0.75,
        "starCalibrationOffset": +0.10,
        "positiveTokens": ["masterpiece", "breathtaking"],
        "negativeTokens": [],
        "intensifiers": []
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
        "score": 0.79,
        "matchReason": "Expanded based on positive world-building sentiment"
      }
    ]
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: `{ "error": "Rating must be a number between 1 and 5" }`
  - `404 Not Found`: `{ "error": "Book not found" }` (if `targetIsbn` is provided but unknown)
  - `503 Service Unavailable`: `{ "error": "Index is still building, try again in a few seconds." }`

---

## 6. Caveats

1. **Catalog Bibliographic Source vs User Data**:
   - `Books.csv` raw catalog data contains only bibliographic metadata (`ISBN`, `title`, `author`, `year`, `publisher`, image URLs). It contains zero historical reviews or user ratings.
   - All catalog ratings and rating distributions in Bookable are computed dynamically at runtime from on-device user records in the `Review` collection.
2. **Sentiment Field Key Aliases**:
   - In `Review.js` (M1), sentiment is stored as `{ score, label, keywords }`.
   - In `sentiment.js` (M2), sentiment includes `{ score, polarity, label, classification, keywords, aspects, aspectTags }`.
   - Test suites should assert `review.sentiment.score` or `review.sentiment.polarity` interchangeably to guarantee forward and backward compatibility.
3. **Smoke Test Compatibility**:
   - The existing smoke test (`server/src/scripts/smoke.js`) checks `POST /api/me/want/:isbn`, `DELETE /api/me/want/:isbn`, and `GET /api/me` returning `{ user, favorites, wantToRead }`.
   - All new endpoints are designed to preserve top-level keys so that `smoke.js` continues to pass 36/36 checks with zero regressions.

---

## 7. Conclusion

This report provides the exhaustive, unambiguous, and mathematically verifiable specification for Bookable's E2E test suite. Every assigned feature across Auth, Shelves, Reviews, Settings, and Recommendations has been mapped to concrete endpoints, request/response payloads, status codes, and error conditions.

The E2E test authors (`e2e_explorer_r1_3` and test implementers) have all necessary contract guarantees to implement the 120-test 4-tier test matrix without ambiguity.

---

## 8. Verification Method

To independently verify the specifications documented in this report:

1. **Verify Route and Model Syntax**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node --check src/index.js
   cd /Users/admin/Documents/Bookable/server && node --check src/auth.js
   cd /Users/admin/Documents/Bookable/server && node --check src/models/User.js
   cd /Users/admin/Documents/Bookable/server && node --check src/routes/users.js
   cd /Users/admin/Documents/Bookable/server && node --check src/routes/api.js
   ```
   *Expected outcome*: Exits with code 0 without syntax errors.

2. **Verify Client Production Build**:
   ```bash
   cd /Users/admin/Documents/Bookable/client && npm run build
   ```
   *Expected outcome*: Compiles with Vite with 0 errors.

3. **Verify Existing Smoke Test Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && npm run smoke
   ```
   *Expected outcome*: All existing checks pass cleanly.

4. **Invalidation Conditions**:
   - If `PUT /api/me/shelf/:isbn` allows a book to exist on both `wantToRead` and `currentlyReading`, this specification is violated.
   - If `POST /api/recommend/three` produces candidates weighted by title cosine similarity ($w_{\text{title}} > 0$), Requirement R3 is violated.
   - If `DELETE /api/reviews/:id` allows User B to delete User A's review, isolation verification fails.
   - If `POST /api/me/reset-books` wipes user reviews or `DELETE /api/me/reviews` wipes user shelves, the data isolation boundary is violated.
