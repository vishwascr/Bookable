# Milestone 1 Review & Adversarial Challenge Report

## Review Summary

**Verdict**: APPROVE  
**Adversarial Risk Assessment**: LOW  
**Integrity Assessment**: CLEAN — 0 integrity violations, 0 hardcoded test shortcuts, authentic Mongoose schemas and queries.

---

## 1. Observation

Direct code examination, syntax validation, automated test execution, and adversarial boundary checks were conducted on the Milestone 1 deliverables at `/Users/admin/Documents/Bookable`:

### 1.1 Source Code Inspection
- **`server/src/models/User.js`**:
  - `currentlyReading` and `read` added as `[String]` arrays with `default: []` (lines 10–11).
  - `toPublic()` method returns `id`, `username`, `displayName`, `favorites`, `wantToRead`, `currentlyReading`, `read`, `onboarded`, and `createdAt` (lines 20–32).
  - Sensitive `passwordHash` is excluded from `toPublic()`.
- **`server/src/models/Review.js`**:
  - Defined with fields: `userId` (ObjectId ref User, required, indexed), `username` (String, required), `displayName` (String, default `''`), `isbn` (String, required, indexed), `rating` (Number, required, min: 1, max: 5, with `Number.isInteger` validator), `text` (String, maxlength: 5000), `sentiment` (`{ score, label, keywords }`).
  - Indexes created: compound unique `{ userId: 1, isbn: 1 }` (line 63), `{ isbn: 1, createdAt: -1 }` (line 65), and `{ userId: 1, createdAt: -1 }` (line 67).
- **`server/src/auth.js`**:
  - `requireAuth` properly checks Bearer token, returns HTTP 401 when missing or expired, sets `req.userId` (lines 11–21).
  - `optionalAuth` extracts Bearer token if present, sets `req.userId` on success, or sets `req.userId = null` and proceeds without throwing on missing or expired tokens (lines 24–34).
- **`server/src/routes/users.js`**:
  - `GET /api/me`: returns `{ user, favorites, wantToRead, currentlyReading, read, stats }` with populated book details. Preserves top-level `favorites` and `wantToRead` for 100% backward compatibility with `smoke.js:70`.
  - `GET /api/me/shelves`: returns populated `{ wantToRead, currentlyReading, read, favorites, stats }`.
  - `PUT /api/me/shelf/:isbn`: accepts `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`. Validates status (400 if invalid), checks book existence (404 if not found), enforces mutual exclusivity between `wantToRead`, `currentlyReading`, and `read`, and preserves `favorites`.
  - Preserved `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn` for backward compatibility.
  - `POST /api/me/reset-books`: resets all 4 shelf arrays to `[]` and saves user; leaves `Review` collection intact.
- **`server/src/routes/reviews.js`**:
  - `GET /api/books/:isbn/reviews`: public endpoint with `optionalAuth`. Returns `{ isbn, averageRating, totalReviews, ratingCounts, ratingDistribution, reviews, userReview }`. Zero-review edge case safely handled with 0 average and 0 in all 5 distribution bins.
  - `POST /api/books/:isbn/reviews`: authenticated (`requireAuth`, `loadUser`). Validates integer rating 1–5, text <= 5000 chars, checks book existence. Upserts review on `{ userId, isbn }`, auto-transitions book to `read` shelf, pulls from `wantToRead` and `currentlyReading`, recalculates distribution and returns HTTP 201 with `{ review, stats, shelves }`.
  - `DELETE /api/reviews/:id`: authenticated. Validates ObjectId format (400 if invalid), checks existence (404), verifies ownership (`String(review.userId) === String(req.userId)`) returning 403 on IDOR mismatch, deletes review and returns HTTP 204.
  - `GET /api/me/reviews`: authenticated. Returns all reviews by `req.userId` populated with catalog book details (`{ total, reviews }`).
  - `DELETE /api/me/reviews`: authenticated. Deletes all reviews written by `req.userId` via `Review.deleteMany({ userId: req.userId })`; leaves user shelves intact.
- **`server/src/index.js`**:
  - Properly mounted `reviews` router at `/api` (line 14), exports default `app`.

### 1.2 Verification Commands Executed
1. Syntax validation:
   ```bash
   cd server && node -c src/index.js && node -c src/routes/users.js && node -c src/routes/reviews.js && node -c src/models/Review.js && node -c src/models/User.js && node -c src/auth.js
   ```
   Result: Exit code 0, 0 syntax errors.
2. Automated test suite:
   ```bash
   cd server && npm test
   ```
   Result: Exit code 0. `Milestone 1 Test Results: 63 passed, 0 failed`.
3. Independent adversarial boundary checks:
   - Validated negative rating rejection (`rating: -1` -> ValidationError).
   - Validated 5000 chars text allowed, 5001 chars rejected (`text.length > 5000` -> ValidationError).
   - Validated sentiment label enum rejection on unknown label (`sentiment.label: 'ecstatic'` -> ValidationError).
   - Validated expired JWT rejection in `requireAuth` (returns 401).
   - Validated expired JWT graceful fallback in `optionalAuth` (calls `next()`, `req.userId = null`).
   - Validated `User.toPublic()` exclusion of `passwordHash` and presence of `currentlyReading` and `read`.
   Result: All adversarial boundary checks passed.

---

## 2. Logic Chain

1. **User Schema Compliance**:
   - *Observation*: `PROJECT.md` and `SCOPE.md` require extending `User` with `currentlyReading` and `read` arrays and updating `toPublic()`.
   - *Evidence*: `User.js:10-11` and `User.js:20-32` define both fields as `[String]` and include them in `toPublic()`.
   - *Inference*: User model fully satisfies interface specifications without leaking password hash.

2. **Review Schema & Integrity**:
   - *Observation*: Reviews must enforce 1–5 integer ratings, 5000-char max text, subdocument sentiment, and uniqueness per (user, isbn).
   - *Evidence*: `Review.js:27-36` validates `Number.isInteger`, `min: 1, max: 5`. Line 63 creates unique compound index `{ userId: 1, isbn: 1 }`.
   - *Inference*: Schema guarantees database-level integrity, preventing duplicate reviews and invalid ratings.

3. **Status Transitions & Invariant Preservation**:
   - *Observation*: Reading status shelves (`wantToRead`, `currentlyReading`, `read`) must be mutually exclusive, while `favorites` remains independent.
   - *Evidence*: `PUT /api/me/shelf/:isbn` in `users.js:163-174` filters `isbn` from all 3 shelves before adding to the target shelf.
   - *Inference*: A book cannot appear in more than one reading status shelf simultaneously. `favorites` is preserved.

4. **Multi-User Data Isolation & IDOR Protection**:
   - *Observation*: Users must never be able to mutate or delete other users' reviews or shelves.
   - *Evidence*: `DELETE /api/reviews/:id` in `reviews.js:160-162` strictly checks `String(review.userId) !== String(req.userId)` and returns HTTP 403 Forbidden. All `/me/*` routes scope queries directly to verified `req.userId`.
   - *Inference*: IDOR vulnerabilities are mitigated; isolation is enforced.

5. **Settings Separation of Concerns**:
   - *Observation*: Resetting books must not delete reviews, and deleting reviews must not reset shelves.
   - *Evidence*: `POST /api/me/reset-books` only clears `User` shelf arrays and does not call `Review` collection. `DELETE /api/me/reviews` only runs `Review.deleteMany({ userId: req.userId })` and does not mutate `User` document.
   - *Inference*: Strict operational separation is maintained.

6. **Backward Compatibility**:
   - *Observation*: Existing `smoke.js:70` asserts `me.body.favorites.length === 3 && me.body.wantToRead.length === 1`.
   - *Evidence*: `GET /api/me` returns populated `favorites` and `wantToRead` at the root object level, along with `currentlyReading`, `read`, and `stats`. `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn` are preserved.
   - *Inference*: Zero regressions against existing smoke tests.

---

## 3. Findings & Advisories

### [Minor] Finding 1: Integration Hook for M2 Sentiment Engine
- **Location**: `server/src/routes/reviews.js:87-90`
- **What**: In `reviews.js`, the dynamic import check tests `if (typeof sentimentModule.analyzeSentiment === 'function')`. However, the M2 sentiment engine (`server/src/recommender/sentiment.js`) exports `analyzeReviewSentiment(text, starRating)`.
- **Impact**: Currently, `reviews.js` falls back to the built-in heuristic `computeSentiment(rating, text)`. This is completely acceptable for M1 (`SCOPE.md` specifies "sets default/local sentiment"), but in M2/M3, the function check should be updated to `sentimentModule.analyzeReviewSentiment || sentimentModule.analyzeSentiment` so the full literary lexicon is invoked seamlessly.
- **Suggestion**: In M2/M3 integration, check `sentimentModule.analyzeReviewSentiment || sentimentModule.analyzeSentiment`, or export `analyzeSentiment` as an alias in `sentiment.js`.

### [Minor] Finding 2: ISBN Case Normalization for Terminal 'X'
- **Location**: `server/src/routes/users.js:152` & `server/src/routes/reviews.js:35, 80`
- **What**: ISBN strings are trimmed (`String(isbn).trim()`) but not normalized with `.toUpperCase()`.
- **Impact**: Standard catalog ISBN-10s with terminal 'X' (e.g. `'059035342X'`) would return 404 if a user submits lowercase `'059035342x'`.
- **Suggestion**: Add `.toUpperCase()` when sanitizing ISBN params (`String(req.params.isbn || '').trim().toUpperCase()`).

---

## 4. Adversarial Stress-Test Results

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | Negative rating (`rating: -1`) | Rejected by schema validator | ValidationError on `rating` | PASS |
| 2 | Float rating (`rating: 4.5`) | Rejected by `Number.isInteger` | ValidationError / HTTP 400 | PASS |
| 3 | Review text boundary (`length: 5000`) | Accepted | Validation succeeds | PASS |
| 4 | Review text boundary (`length: 5001`) | Rejected by `maxlength: 5000` | ValidationError / HTTP 400 | PASS |
| 5 | Invalid sentiment label (`'ecstatic'`) | Rejected by enum `['positive', 'neutral', 'negative']` | ValidationError on `sentiment.label` | PASS |
| 6 | Expired JWT token on `requireAuth` | Rejected with HTTP 401 | HTTP 401 'Session expired...' | PASS |
| 7 | Expired JWT token on `optionalAuth` | Handled gracefully without crash | Sets `req.userId = null`, calls `next()` | PASS |
| 8 | Shelf transition exclusivity (`want_to_read` -> `currently_reading` -> `read` -> `none`) | Removed from other 2 shelves at each step | Maintained strictly across transitions | PASS |
| 9 | Preserving `favorites` during shelf changes | `favorites` untouched by status updates | Preserved across all status transitions | PASS |
| 10 | IDOR review deletion (User B deletes User A review) | HTTP 403 Forbidden | Ownership check fails, HTTP 403 returned | PASS |
| 11 | Settings reset-books impact on reviews | Reviews remain intact | 0 reviews deleted | PASS |
| 12 | Settings delete-reviews impact on shelves | Shelves remain intact | User shelves unmodified | PASS |
| 13 | Empty review distribution math | `averageRating: 0`, all 5 bins: 0 | Handled safely, 0 division prevented | PASS |

---

## 5. Verified Claims & Anti-Cheating Attestation

- [x] **No hardcoded test mocks**: Verified zero occurrences of test user IDs, hardcoded ratings, or mock returns in `server/src/routes/` and `server/src/models/`.
- [x] **Authentic Mongoose implementation**: Schemas, indexes, and queries use authentic Mongoose and Express APIs.
- [x] **No external shortcuts**: Implemented entirely within project boundaries.
- [x] **Automated test suite passing**: 63/63 checks passed in `server/src/scripts/test-m1.js`.

---

## 6. Caveats
- No critical caveats. Live end-to-end integration with the client and running HTTP daemon will be validated in milestone E2E and M3/M5 smoke runs.

---

## 7. Conclusion

Milestone 1 backend implementation meets all functional requirements, data integrity guarantees, and interface contracts specified in `PROJECT.md` and `SCOPE.md`. The code is clean, robust, well-structured, and backwards compatible.

**Verdict: APPROVE**.

---

## 8. Verification Method

To independently reproduce verification:
1. Syntax validation:
   ```bash
   cd /Users/admin/Documents/Bookable/server
   node -c src/index.js src/routes/users.js src/routes/reviews.js src/models/Review.js src/models/User.js src/auth.js
   ```
2. Run automated test suite:
   ```bash
   cd /Users/admin/Documents/Bookable/server
   npm test
   ```
3. Run adversarial test suite:
   ```bash
   cd /Users/admin/Documents/Bookable/server
   node -e "
   import assert from 'node:assert';
   import Review from './src/models/Review.js';
   import User from './src/models/User.js';
   const revNeg = new Review({ userId: new (await import('mongoose')).default.Types.ObjectId(), username: 't', isbn: '1', rating: -1 });
   assert.ok((await revNeg.validate().catch(e => e))?.errors?.rating);
   console.log('Adversarial check passed');
   "
   ```
