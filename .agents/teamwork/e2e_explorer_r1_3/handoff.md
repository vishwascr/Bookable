# Handoff Report: 4-Tier E2E Test Case Matrix Catalog

**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_explorer_r1_3`  
**Date**: 2026-11-13  
**Role**: Explorer (E2E Test Architecture & Catalog Design)  
**Parent Conversation ID**: `10a6c306-1c88-446c-b310-382d63518784`  

---

## 1. Observation

Direct observations from inspecting the codebase, specifications, and architecture contracts:

1. **Test Scope & Coverage Thresholds (`SCOPE.md:28-33`)**:
   - Tier 1: Feature Coverage (happy path, >=5 tests per feature for all 10 features in SCOPE.md, minimum 50 tests).
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature, minimum 50 tests).
   - Tier 3: Cross-Feature Combinations (pairwise coverage of auth, shelving, reviews, sentiment, reset/delete, minimum 10 tests).
   - Tier 4: Real-World Application Scenarios (>=5 realistic multi-step user workflows).
   - Test suites mapped to 4 target files: `tests/auth-isolation.test.js`, `tests/recommendation-heuristics.test.js`, `tests/sentiment-analysis.test.js`, and `tests/e2e-scenarios.test.js`.

2. **Interface Contracts & Requirements (`PROJECT.md § Interface Contracts`)**:
   - `User Model` (`server/src/models/User.js:8-10`): Currently contains `favorites` and `wantToRead`. Extended in M1 to include `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }`.
   - `Review Model` (`PROJECT.md:63-76`): Schema includes `userId`, `username`, `displayName`, `isbn`, `rating` (1-5), `text` (maxlength 5000), `sentiment: { score: Number, label: 'positive'|'neutral'|'negative', keywords: [String] }`.
   - `Reading Status & Shelves Endpoints` (`PROJECT.md:78-83`):
     - `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`. Mutually exclusive reading statuses.
     - `GET /api/me/shelves`: Returns populated books grouped by shelf (`wantToRead`, `currentlyReading`, `read`, `favorites`).
   - `Review Endpoints` (`PROJECT.md:84-89`):
     - `GET /api/books/:isbn/reviews`: Public aggregation `{ averageRating, totalReviews, ratingCounts: { 1: n, ... }, reviews: [...] }`.
     - `POST /api/books/:isbn/reviews`: Authenticated (`requireAuth`), runs local sentiment analysis, persists review.
     - `DELETE /api/reviews/:id`: Authenticated, owner-guarded deletion (HTTP 204 or 403).
     - `GET /api/me/reviews`: Authenticated, returns requesting user's authored reviews.
   - `Settings Endpoints` (`PROJECT.md:90-93`):
     - `POST /api/me/reset-books`: Authenticated, clears `wantToRead`, `currentlyReading`, `read`, `favorites`, leaving reviews untouched.
     - `DELETE /api/me/reviews`: Authenticated, removes user's reviews, leaving shelves untouched.
   - `Recommendation Endpoints` (`PROJECT.md:98-136`):
     - `POST /api/recommend/three`: Accepts `{ seeds: [isbn1, isbn2, isbn3], weights: { genre, author, tag, rating }, limit }`. Strictly excludes title similarity ($w_{\text{title}} = 0$).
     - `POST /api/recommend/sentiment-adapted`: Accepts `{ reviewText, targetIsbn, rating }`, returns `{ sentiment: { score, label, keywords }, adaptedRecommendations: [...] }`.

3. **Current Server Implementation & Dependencies (`server/package.json` & `server/src/`)**:
   - Dependencies: `bcryptjs`, `cors`, `dotenv`, `express` (v5.3.0), `jsonwebtoken` (v9.0.3), `mongoose` (v9.11.2).
   - Node built-in `node:test` and `node:assert` available for ESM tests.
   - Seed book catalog contains verified popular ISBNs (`server/src/routes/users.js:11-17`): `'059035342X'`, `'0345339681'`, `'0385504209'`, `'0446310786'`, `'0451524934'`, `'055321215X'`, `'0441172660'`, `'0671461494'`, `'0439136350'`, `'0316769487'`.

---

## 2. Logic Chain

1. **Mapping 10 Features to 4 Test Suites**:
   - **`tests/auth-isolation.test.js`**: Contains Feature 1 (*User Auth & Session*) and Feature 2 (*Multi-User Data Isolation*). All authentication mechanisms, token validation, password hashing, and user-to-user boundary enforcement belong in this suite.
   - **`tests/recommendation-heuristics.test.js`**: Contains Feature 6 (*3-Seed Book Recommendations*), Feature 7 (*Title Similarity Exclusion*), and Feature 10 (*Algorithm Customization*). All mathematical recommendation heuristics, seed validations, title exclusion guarantees, and weight customizations belong here.
   - **`tests/sentiment-analysis.test.js`**: Contains Feature 8 (*Review Sentiment Analysis*) and Feature 9 (*Sentiment-Adapted Recommendations*). Lexicon scoring, polarity classification, keyword extraction, and recommendation adaptation based on review sentiment belong here.
   - **`tests/e2e-scenarios.test.js`**: Contains Feature 3 (*Reading Statuses & Shelves*), Feature 4 (*Reviews & Star Ratings*), Feature 5 (*Settings Reset & Delete*), plus Tier 3 (*Cross-Feature Combinations*) and Tier 4 (*Real-World Application Scenarios*). End-to-end user workflows, shelf lifecycles, and multi-feature sequences belong here.

2. **Tier Sizing & Quotas**:
   - **Tier 1 (Feature Coverage)**: 10 features $\times$ 5 tests = **50 tests** (meets minimum $\ge 50$).
   - **Tier 2 (Boundary & Corner Cases)**: 10 features $\times$ 5–6 tests = **52 tests** (meets minimum $\ge 50$).
   - **Tier 3 (Cross-Feature Combinations)**: Pairwise interactions across auth, shelving, reviews, sentiment, reset/delete = **12 tests** (meets minimum $\ge 10$).
   - **Tier 4 (Real-World Application Scenarios)**: Multi-step realistic user journeys = **6 tests** (meets minimum $\ge 5$).
   - **Grand Total**: **120 test cases**.

3. **Concrete Test Specification Standard**:
   Every test case below provides:
   - Unique identifier (`T1-AUTH-01`, etc.)
   - Test Case Name
   - Target File mapping
   - Target HTTP Method & Endpoint
   - Concrete Test Inputs / Payloads
   - Exact Expected Outcome & Status Codes

---

## 3. Concrete Test Case Catalog

### 3.1 Tier 1: Feature Coverage (50 Tests, 5 per Feature)

#### Feature 1: User Auth & Session (`tests/auth-isolation.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-AUTH-01` | Register new user success | `auth-isolation.test.js` | `POST /api/auth/signup` | `{ username: "reader_alice", password: "Password123!", displayName: "Alice R." }` | HTTP 201; returns JWT token and sanitized user object with `username: "reader_alice"`, `displayName: "Alice R."`; `passwordHash` is absent |
| `T1-AUTH-02` | Login existing user success | `auth-isolation.test.js` | `POST /api/auth/login` | `{ username: "reader_alice", password: "Password123!" }` | HTTP 200; returns valid JWT token and user profile object |
| `T1-AUTH-03` | Fetch current user profile with valid Bearer token | `auth-isolation.test.js` | `GET /api/me` | Header: `Authorization: Bearer <valid_token>` | HTTP 200; returns user object matching token `userId`, with `favorites`, `wantToRead`, `currentlyReading`, `read` arrays |
| `T1-AUTH-04` | Password stored as bcrypt hash at rest | `auth-isolation.test.js` | Direct Mongo Query / DB Hook | Query `User` model by username `"reader_alice"` | `user.passwordHash` starts with `$2a$` or `$2b$`, salt rounds $\ge 10$, plain password string does not appear in document |
| `T1-AUTH-05` | JWT token contains standard claims and expiration | `auth-isolation.test.js` | Token decoder verification | Decoded token from `POST /api/auth/login` | Payload contains `sub` (matching user `_id`), `u: "reader_alice"`, `iat` timestamp, and `exp` timestamp set for 7 days ahead |

#### Feature 2: Multi-User Data Isolation (`tests/auth-isolation.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-ISO-01` | User A shelves are isolated from User B | `auth-isolation.test.js` | `PUT /api/me/shelf/0345339681` (User A), then `GET /api/me/shelves` (User B) | User A sets `want_to_read`; User B queries `GET /api/me/shelves` | User B's shelves contain 0 books; `0345339681` appears only in User A's `wantToRead` |
| `T1-ISO-02` | User A and User B maintain distinct reading statuses for same book | `auth-isolation.test.js` | `PUT /api/me/shelf/0441172660` with different statuses | User A sends `{ status: 'currently_reading' }`; User B sends `{ status: 'read' }` | User A's shelf has book in `currentlyReading`; User B's shelf has same book in `read`; no cross-contamination |
| `T1-ISO-03` | My reviews endpoint returns only authenticated user's reviews | `auth-isolation.test.js` | `GET /api/me/reviews` | User A posts review for ISBN `059035342X`; User B calls `GET /api/me/reviews` | User B receives `[]`; User A receives array containing exactly their review |
| `T1-ISO-04` | User B cannot delete User A's review | `auth-isolation.test.js` | `DELETE /api/reviews/:id` | User A creates review (gets `reviewId`); User B calls DELETE with User B's token | HTTP 403 Forbidden (or 404); review remains in database and is not deleted |
| `T1-ISO-05` | Reset books by User A does not modify User B's shelves | `auth-isolation.test.js` | `POST /api/me/reset-books` | Both users have books shelved; User A calls reset-books; User B queries `/api/me/shelves` | User A's shelves are cleared to empty arrays; User B's shelves retain all previously shelved books intact |

#### Feature 3: Reading Statuses & Shelves (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-SHF-01` | Add book to Want to Read shelf | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | `{ status: "want_to_read" }` with valid user token | HTTP 200; `wantToRead` contains `"0345339681"`; `currentlyReading` and `read` do not contain it |
| `T1-SHF-02` | Transition book from Want to Read to Currently Reading | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | `{ status: "currently_reading" }` | HTTP 200; book is moved to `currentlyReading` and automatically removed from `wantToRead` |
| `T1-SHF-03` | Transition book from Currently Reading to Read | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | `{ status: "read" }` | HTTP 200; book is moved to `read` and automatically removed from `currentlyReading` |
| `T1-SHF-04` | Remove book from all reading shelves with status none | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | `{ status: "none" }` | HTTP 200; book is removed from `wantToRead`, `currentlyReading`, and `read` arrays |
| `T1-SHF-05` | Get populated shelves grouped by status | `e2e-scenarios.test.js` | `GET /api/me/shelves` | Valid user token with books in multiple shelves | HTTP 200; returns `{ favorites: [...], wantToRead: [...], currentlyReading: [...], read: [...] }` with populated book details (title, author, isbn) |

#### Feature 4: Reviews & Star Ratings (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-REV-01` | Submit valid 5-star review with commentary | `e2e-scenarios.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "An absolute sci-fi masterpiece with unparalleled lore." }` | HTTP 201; returns review object with `rating: 5`, `text`, `username`, `sentiment` populated |
| `T1-REV-02` | Fetch aggregated reviews and ratings for catalog book | `e2e-scenarios.test.js` | `GET /api/books/0441172660/reviews` | Public GET request | HTTP 200; returns `{ averageRating: 5.0, totalReviews: 1, ratingCounts: { 1:0, 2:0, 3:0, 4:0, 5:1 }, reviews: [...] }` |
| `T1-REV-03` | Fetch user's own reviews list | `e2e-scenarios.test.js` | `GET /api/me/reviews` | Valid user token | HTTP 200; returns array containing the user's reviews, sorted by creation date descending |
| `T1-REV-04` | Delete own review successfully | `e2e-scenarios.test.js` | `DELETE /api/reviews/:id` | Review ID created by caller with caller's token | HTTP 204 No Content (or 200); review is deleted from database |
| `T1-REV-05` | Aggregated ratings update dynamically after review deletion | `e2e-scenarios.test.js` | `GET /api/books/0441172660/reviews` (after deletion) | Public GET request | HTTP 200; `totalReviews` decreases to 0, `averageRating` updates to 0, `reviews` array is empty |

#### Feature 5: Settings Reset & Delete (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-SET-01` | Reset library books clears all shelves | `e2e-scenarios.test.js` | `POST /api/me/reset-books` | Valid token for user with books in `wantToRead`, `currentlyReading`, `read`, `favorites` | HTTP 200; user shelves are reset: `{ favorites: [], wantToRead: [], currentlyReading: [], read: [] }` |
| `T1-SET-02` | Reset library books leaves submitted reviews intact | `e2e-scenarios.test.js` | `GET /api/me/reviews` (after reset-books) | User with 2 submitted reviews calls reset-books then calls GET /api/me/reviews | HTTP 200; all 2 submitted reviews remain in database completely intact |
| `T1-SET-03` | Delete user reviews removes all reviews by user | `e2e-scenarios.test.js` | `DELETE /api/me/reviews` | Valid token for user who wrote 3 reviews | HTTP 200; removes all 3 reviews; subsequent `GET /api/me/reviews` returns `[]` |
| `T1-SET-04` | Delete user reviews leaves personal shelves intact | `e2e-scenarios.test.js` | `GET /api/me/shelves` (after delete-reviews) | User with shelved books calls DELETE /api/me/reviews then GET /api/me/shelves | HTTP 200; all shelved books remain intact in their respective shelf arrays |
| `T1-SET-05` | Sequential reset books and delete reviews clears both | `e2e-scenarios.test.js` | `POST /api/me/reset-books` then `DELETE /api/me/reviews` | User with both shelves and reviews calls both endpoints sequentially | HTTP 200 for both; shelves are empty and user reviews array is empty |

#### Feature 6: 3-Seed Book Recommendations (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-REC-01` | Generate recommendations from 3 valid seeds | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", "0345339681", "0441172660"], limit: 10 }` | HTTP 200; returns `{ candidates: [...], diagnostics: { seedCount: 3, candidatesEvaluated: n, queryTimeMs: t } }` |
| `T1-REC-02` | Seeds are strictly excluded from candidates | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seeds: `["0439136350", "0345339681", "0441172660"]` | All candidate items in response have `isbn !== "0439136350"`, `!= "0345339681"`, and `!= "0441172660"` |
| `T1-REC-03` | Candidate scores are normalized and sorted descending | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | 3 valid seeds | Every candidate score $\in [0, 1]$; for every index $i$, `candidates[i].score >= candidates[i+1].score` |
| `T1-REC-04` | Candidate items contain metadata explanation breakdown | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | 3 valid seeds | Each candidate includes `features` object detailing `genre`, `author`, `tag`, and `rating` contributions |
| `T1-REC-05` | Recommendation limit parameter is respected | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | 3 valid seeds with `limit: 5` | HTTP 200; `candidates.length === 5` |

#### Feature 7: Title Similarity Exclusion (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-TTL-01` | Default recommendation weights specify title weight 0 | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Payload without `weights` override; inspect diagnostics | `diagnostics.weightsUsed.title === 0` (or `title` key is absent from weights); non-zero weights on genre, author, tag, rating |
| `T1-TTL-02` | Title cosine similarity does not determine ranking | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seed: "The Hobbit"; candidate with similar title ("The Hobbit Companion", wrong genre/author) vs candidate with matching author/genre | Book with matching metadata scores higher than book with only title word overlap |
| `T1-TTL-03` | Supplying w_title in weights is rejected or forced to 0 | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { title: 0.9, author: 0.1 } }` | HTTP 400 Bad Request or server forces `weightsUsed.title = 0`, ignoring title parameter |
| `T1-TTL-04` | Candidate feature explanations exclude title similarity score | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | 3 valid seeds | Candidate `features` object contains `{ genre, author, tag, rating }`; no `title` score factor or `title === 0` |
| `T1-TTL-05` | Seed title word collisions do not surface irrelevant books | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seeds: "1984", "Brave New World", "Fahrenheit 451" (Dystopian fiction) | Top recommendations are classic dystopian fiction; books with "World" or "New" in unrelated non-fiction genres are not ranked top |

#### Feature 8: Review Sentiment Analysis (`tests/sentiment-analysis.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-SNT-01` | Strongly positive review produces positive score and label | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "A breathtaking masterpiece, extraordinary world-building and unforgettable characters!" }` | HTTP 201; `review.sentiment.score > 0.5`, `review.sentiment.label === "positive"`, `keywords` includes `["masterpiece", "extraordinary", "unforgettable"]` |
| `T1-SNT-02` | Strongly negative review produces negative score and label | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 1, text: "Terrible, boring, poorly written disaster of a book. Complete waste of time." }` | HTTP 201; `review.sentiment.score < -0.4`, `review.sentiment.label === "negative"`, `keywords` includes `["terrible", "boring", "waste"]` |
| `T1-SNT-03` | Balanced neutral review produces neutral label | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 3, text: "A standard read with some decent sections and average pacing throughout." }` | HTTP 201; `-0.25 <= review.sentiment.score <= 0.25`, `review.sentiment.label === "neutral"` |
| `T1-SNT-04` | Sentiment payload persisted in Review database record | `sentiment-analysis.test.js` | Direct Mongo verification | Read created review document from `reviews` collection | Document has sub-document `sentiment` with numeric `score`, string `label`, array of string `keywords` |
| `T1-SNT-05` | Keyword extraction filters out common English stopwords | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 4, text: "The book was quite fascinating and brilliant in the middle." }` | `sentiment.keywords` contains `["fascinating", "brilliant"]` and excludes `"the"`, `"was"`, `"and"`, `"in"` |

#### Feature 9: Sentiment-Adapted Recommendations (`tests/sentiment-analysis.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-ADP-01` | Positive review yields adapted recommendations aligned with themes | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 5, reviewText: "Magnificent epic space opera with complex political intrigue." }` | HTTP 200; `sentiment.label === "positive"`; `adaptedRecommendations` populated with related high-rated space opera titles |
| `T1-ADP-02` | Negative review steers recommendations away from disliked aspects | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 1, reviewText: "Too dense, dry, and slow-paced philosophy with no action." }` | HTTP 200; `sentiment.label === "negative"`; recommendations prioritize faster-paced or contrasting alternatives |
| `T1-ADP-03` | Sentiment-adapted response conforms to contract schema | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | Valid payload with targetIsbn, rating, reviewText | Response contains top-level keys `sentiment` (with `score`, `label`, `keywords`) and `adaptedRecommendations` (array of books) |
| `T1-ADP-04` | Target ISBN is excluded from adapted recommendations | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | Target ISBN `"0441172660"` | None of the books in `adaptedRecommendations` have `isbn === "0441172660"` |
| `T1-ADP-05` | Neutral review generates balanced baseline recommendations | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 3, reviewText: "Decent average story." }` | HTTP 200; `sentiment.label === "neutral"`; returns standard genre/author metadata recommendations without extreme polarity skew |

#### Feature 10: Algorithm Customization (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T1-CST-01` | Custom genre weight dominance alters recommendations | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: 0.8, author: 0.1, tag: 0.05, rating: 0.05 } }` | HTTP 200; top candidates have maximum genre overlap with seeds |
| `T1-CST-02` | Custom author weight dominance elevates author's other works | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", ...], weights: { genre: 0.05, author: 0.85, tag: 0.05, rating: 0.05 } }` | HTTP 200; top candidates are books by the same author(s) as the seeds |
| `T1-CST-03` | Custom tag weight dominance prioritizes shared tags | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: 0.1, author: 0.1, tag: 0.75, rating: 0.05 } }` | HTTP 200; candidate feature breakdowns show tag matching constitutes primary score contributor |
| `T1-CST-04` | Custom rating weight dominance elevates highest-rated books | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: 0.1, author: 0.1, tag: 0.1, rating: 0.7 } }` | HTTP 200; top candidates have higher average rating scores than in default weighting |
| `T1-CST-05` | Diagnostics echoes active weights used in computation | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Custom weights object `{ genre: 0.4, author: 0.3, tag: 0.2, rating: 0.1 }` | `diagnostics.weightsUsed` in response exactly equals input weights |

---

### 3.2 Tier 2: Boundary & Corner Cases (52 Tests, 5–6 per Feature)

#### Feature 1: User Auth & Session Boundary Cases (`tests/auth-isolation.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-AUTH-01` | Reject duplicate username registration (case-insensitive) | `auth-isolation.test.js` | `POST /api/auth/signup` | `{ username: "READER_ALICE", password: "Password123!" }` (when `"reader_alice"` exists) | HTTP 409 Conflict with error message indicating username is taken |
| `T2-AUTH-02` | Reject password shorter than minimum requirement | `auth-isolation.test.js` | `POST /api/auth/signup` | `{ username: "new_reader", password: "123" }` (< 6 chars) | HTTP 400 Bad Request: "Password must be at least 6 characters" |
| `T2-AUTH-03` | Reject username with invalid characters or spaces | `auth-isolation.test.js` | `POST /api/auth/signup` | `{ username: "bad user name!", password: "Password123!" }` | HTTP 400 Bad Request: "Username must be 3–30 characters..." |
| `T2-AUTH-04` | Reject login with incorrect password | `auth-isolation.test.js` | `POST /api/auth/login` | `{ username: "reader_alice", password: "WrongPassword" }` | HTTP 401 Unauthorized: "Invalid username or password" |
| `T2-AUTH-05` | Reject login with non-existent username | `auth-isolation.test.js` | `POST /api/auth/login` | `{ username: "ghost_user_999", password: "Password123!" }` | HTTP 401 Unauthorized: "Invalid username or password" |
| `T2-AUTH-06` | Reject requests with malformed or tampered Bearer token | `auth-isolation.test.js` | `GET /api/me` | Header: `Authorization: Bearer invalid.token.signature` | HTTP 401 Unauthorized: "Session expired, please log in again" |

#### Feature 2: Multi-User Data Isolation Boundary Cases (`tests/auth-isolation.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-ISO-01` | Reject shelf mutation without Authorization header | `auth-isolation.test.js` | `PUT /api/me/shelf/0345339681` | No `Authorization` header | HTTP 401 Unauthorized: "Not logged in" |
| `T2-ISO-02` | Token with non-existent userId in database rejected | `auth-isolation.test.js` | `GET /api/me` | Validly signed JWT whose `sub` is a random non-existent ObjectId | HTTP 401 Unauthorized: "Account not found" |
| `T2-ISO-03` | Malformed review ID in delete request does not crash server | `auth-isolation.test.js` | `DELETE /api/reviews/not-a-valid-object-id` | Valid user token with non-ObjectId string | HTTP 400 Bad Request or 404 Not Found; server does not crash |
| `T2-ISO-04` | Concurrent updates by distinct users do not overwrite | `auth-isolation.test.js` | Concurrent `PUT /api/me/shelf/:isbn` | User A shelves ISBN 1; User B shelves ISBN 2 concurrently in parallel `Promise.all` | Both user documents preserve their respective shelves without loss or data leakage |
| `T2-ISO-05` | Public review endpoints sanitize private user fields | `auth-isolation.test.js` | `GET /api/books/0441172660/reviews` | Request public reviews list | Review author objects expose only `username` / `displayName`; no `passwordHash`, `email`, or private shelf arrays |

#### Feature 3: Reading Statuses & Shelves Boundary Cases (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-SHF-01` | Reject invalid reading status value | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | `{ status: "abandoned_reading" }` | HTTP 400 Bad Request with validation error on status enum |
| `T2-SHF-02` | Reject shelving of non-existent catalog ISBN | `e2e-scenarios.test.js` | `PUT /api/me/shelf/9999999999999` | `{ status: "want_to_read" }` | HTTP 404 Book not found |
| `T2-SHF-03` | Idempotent duplicate status assignment | `e2e-scenarios.test.js` | `PUT /api/me/shelf/0345339681` | Send `{ status: "want_to_read" }` twice consecutively | HTTP 200; `wantToRead` array contains ISBN exactly once (no duplicates) |
| `T2-SHF-04` | Empty shelves response for brand new user | `e2e-scenarios.test.js` | `GET /api/me/shelves` | Token of freshly registered user | HTTP 200; `{ favorites: [], wantToRead: [], currentlyReading: [], read: [] }` |
| `T2-SHF-05` | Handle ISBN with trailing uppercase X | `e2e-scenarios.test.js` | `PUT /api/me/shelf/059035342X` | `{ status: "want_to_read" }` | HTTP 200; properly matched and shelved without case truncation errors |

#### Feature 4: Reviews & Star Ratings Boundary Cases (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-REV-01` | Reject review rating less than 1 | `e2e-scenarios.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 0, text: "Bad" }` | HTTP 400 Bad Request; rating must be between 1 and 5 |
| `T2-REV-02` | Reject review rating greater than 5 | `e2e-scenarios.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 6, text: "Too good" }` | HTTP 400 Bad Request; rating must be between 1 and 5 |
| `T2-REV-03` | Allow review with rating only and empty text | `e2e-scenarios.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 4, text: "" }` | HTTP 201; review created with `text: ""`; sentiment defaults to neutral score 0 |
| `T2-REV-04` | Reject review text exceeding maximum length of 5000 chars | `e2e-scenarios.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "A".repeat(5001) }` | HTTP 400 Bad Request: text exceeds maximum permitted length |
| `T2-REV-05` | Review submission for non-existent ISBN rejected | `e2e-scenarios.test.js` | `POST /api/books/9999999999999/reviews` | `{ rating: 4, text: "Good" }` | HTTP 404 Book not found |
| `T2-REV-06` | Delete non-existent review ID returns 404 | `e2e-scenarios.test.js` | `DELETE /api/reviews/507f1f77bcf86cd799439011` | Valid token for non-existent review ObjectId | HTTP 404 Not Found |

#### Feature 5: Settings Reset & Delete Boundary Cases (`tests/e2e-scenarios.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-SET-01` | Reset books on already empty shelves is idempotent | `e2e-scenarios.test.js` | `POST /api/me/reset-books` | User has 0 books on all shelves | HTTP 200; returns empty shelves without errors |
| `T2-SET-02` | Delete reviews when user has 0 reviews is idempotent | `e2e-scenarios.test.js` | `DELETE /api/me/reviews` | User has 0 authored reviews | HTTP 200; reports 0 reviews deleted without error |
| `T2-SET-03` | Unauthenticated reset books request rejected | `e2e-scenarios.test.js` | `POST /api/me/reset-books` | No `Authorization` header | HTTP 401 Unauthorized: "Not logged in" |
| `T2-SET-04` | Unauthenticated delete reviews request rejected | `e2e-scenarios.test.js` | `DELETE /api/me/reviews` | No `Authorization` header | HTTP 401 Unauthorized: "Not logged in" |
| `T2-SET-05` | Mass review deletion updates multiple books' aggregate ratings | `e2e-scenarios.test.js` | `DELETE /api/me/reviews` | User who reviewed 3 distinct books triggers mass review deletion | HTTP 200; aggregate review counts across all 3 books decrease by 1 each |

#### Feature 6: 3-Seed Book Recommendations Boundary Cases (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-REC-01` | Reject recommendation request with fewer than 3 seeds | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", "0345339681"] }` (2 seeds) | HTTP 400 Bad Request: "Must provide exactly 3 seed books" |
| `T2-REC-02` | Reject recommendation request with more than 3 seeds | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", "0345339681", "0441172660", "059035342X"] }` | HTTP 400 Bad Request: "Must provide exactly 3 seed books" |
| `T2-REC-03` | Reject duplicate seeds in recommendation payload | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", "0439136350", "0345339681"] }` | HTTP 400 Bad Request: "Seed books must be unique" |
| `T2-REC-04` | Reject seeds containing non-existent catalog ISBN | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: ["0439136350", "0345339681", "9999999999999"] }` | HTTP 404 Book not found (or 400 with message identifying unknown seed) |
| `T2-REC-05` | Recommendation limit parameter clamps extreme values | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], limit: 500 }` and `{ seeds: [...], limit: -5 }` | Limit clamped to valid range $[1, 50]$; returns at most 50 candidates |

#### Feature 7: Title Similarity Exclusion Boundary Cases (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-TTL-01` | Seeds containing only common stop words produce genre-driven results | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seeds with short/common titles ("The Road", "The Stand", "The Shining") | Recommendations driven by Stephen King / horror / post-apocalyptic metadata, not articles "The" |
| `T2-TTL-02` | Seed books with punctuation, dashes, or accented characters | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seeds: "Ender's Game", "Fahrenheit 451", "Le Petit Prince" | Engine processes metadata cleanly without regex syntax errors or crash |
| `T2-TTL-03` | Reject negative or NaN title weight injection | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { title: "NaN", genre: 0.5 } }` | HTTP 400 or weights sanitized to valid numbers with `title: 0` |
| `T2-TTL-04` | Seeds with pure numeric titles calculate recommendations on metadata | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Seed ISBN for "1984" | Candidates evaluated on George Orwell, classic, dystopian metadata without numeric token error |
| `T2-TTL-05` | Unrelated books with identical titles do not receive score boost | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | Two books sharing title "Collected Poems" across different genres/authors | Zero title similarity boost; candidate ranked purely by metadata features |

#### Feature 8: Review Sentiment Analysis Boundary Cases (`tests/sentiment-analysis.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-SNT-01` | Review with empty or whitespace-only text scores neutral | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 3, text: "     " }` | HTTP 201; `sentiment.score === 0.0`, `sentiment.label === "neutral"`, `keywords === []` |
| `T2-SNT-02` | Contradictory star rating and text safely handled | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "Horrible and disappointing." }` | HTTP 201; sentiment analysis executes without error, records both text polarity and star score |
| `T2-SNT-03` | Correct negation phrase handling | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 2, text: "Not good, not exciting, and definitely not recommended." }` | HTTP 201; `sentiment.score < 0`, `sentiment.label === "negative"` despite positive word "good" |
| `T2-SNT-04` | Repeated intensifiers and capitalization do not exceed score bounds | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "AMAZING AMAZING INCREDIBLE WONDERFUL MASTERPIECE!!!!" }` | HTTP 201; `sentiment.score <= 1.0` and `>= -1.0` (proper mathematical clamping) |
| `T2-SNT-05` | Text with emojis and unicode characters parsed without crashing | `sentiment-analysis.test.js` | `POST /api/books/0441172660/reviews` | `{ rating: 5, text: "Loved it! ❤️ 📚 🌟 🚀 Highly recommended! 👏" }` | HTTP 201; unicode characters handled safely, positive sentiment detected |

#### Feature 9: Sentiment-Adapted Recommendations Boundary Cases (`tests/sentiment-analysis.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-ADP-01` | Fallback to star rating when review text is absent | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 5 }` (no `reviewText`) | HTTP 200; uses 5-star rating to infer positive sentiment and returns adapted recommendations |
| `T2-ADP-02` | Reject sentiment adaptation for non-existent target ISBN | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "9999999999999", rating: 4, reviewText: "Nice" }` | HTTP 404 Book not found |
| `T2-ADP-03` | Extremely negative review still returns non-empty candidate list | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 1, reviewText: "Vile repulsive garbage." }` | HTTP 200; graceful fallback yields alternative non-empty candidates list |
| `T2-ADP-04` | Adapted recommendations list contains no duplicate ISBNs | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | Valid payload | Set of returned ISBNs has `size === adaptedRecommendations.length` (100% unique) |
| `T2-ADP-05` | Reject invalid rating parameter in sentiment-adapted payload | `sentiment-analysis.test.js` | `POST /api/recommend/sentiment-adapted` | `{ targetIsbn: "0441172660", rating: 7, reviewText: "Great" }` | HTTP 400 Bad Request; rating out of bounds |

#### Feature 10: Algorithm Customization Boundary Cases (`tests/recommendation-heuristics.test.js`)
| ID | Test Name | Target File | Endpoint | Concrete Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T2-CST-01` | All-zero weights handle gracefully without divide-by-zero | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: 0, author: 0, tag: 0, rating: 0 } }` | HTTP 200; falls back to equal uniform weights or default weights without NaN scores |
| `T2-CST-02` | Non-normalized weights automatically normalized by engine | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: 10, author: 20, tag: 30, rating: 40 } }` | HTTP 200; relative weight ratios preserved; candidate scores bounded in $[0, 1]$ |
| `T2-CST-03` | Partial weights object merges with defaults | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { author: 0.9 } }` (other weights omitted) | HTTP 200; omitted weights default cleanly; query executes successfully |
| `T2-CST-04` | Negative weights clamped to zero | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: -0.5, author: 0.5, tag: 0.2, rating: 0.3 } }` | HTTP 200; `diagnostics.weightsUsed.genre === 0.0`; negative weight clamped |
| `T2-CST-05` | Non-numeric weight values sanitized or rejected | `recommendation-heuristics.test.js` | `POST /api/recommend/three` | `{ seeds: [...], weights: { genre: "high", author: "none" } }` | HTTP 400 Bad Request or sanitized to default numeric weights |

---

### 3.3 Tier 3: Cross-Feature Combinations (12 Tests)
All Tier 3 tests evaluate pairwise interactions between disparate subsystems and are mapped to `tests/e2e-scenarios.test.js`.

| ID | Test Name | Target File | Features Combined | Concrete Steps & Inputs | Expected Outcome |
|---|---|---|---|---|---|
| `T3-CMB-01` | Auth + Shelving Lifecycle | `e2e-scenarios.test.js` | Auth (F1) + Shelves (F3) | 1. User registers new account.<br>2. Shelves 3 distinct books into `want_to_read`, `currently_reading`, `read`.<br>3. Calls `GET /api/me/shelves`. | HTTP 200; all 3 books correctly placed in their respective shelf arrays under caller's account. |
| `T3-CMB-02` | Auth + Community Reviews Publishing | `e2e-scenarios.test.js` | Auth (F1) + Reviews (F4) | 1. Authenticated user posts review with rating 5 for ISBN `0345339681`.<br>2. Calls public `GET /api/books/0345339681/reviews`. | HTTP 200; public community review list shows review authored with user's `username` and rating 5. |
| `T3-CMB-03` | Shelving + Review Submission | `e2e-scenarios.test.js` | Shelves (F3) + Reviews (F4) | 1. User transitions book to `read` status.<br>2. User submits review for the same book.<br>3. Verifies shelves and reviews. | Both actions succeed; book remains in `read` shelf and user's review appears in `/api/me/reviews`. |
| `T3-CMB-04` | Review Submission + Automatic Sentiment Pipeline | `e2e-scenarios.test.js` | Reviews (F4) + Sentiment Analysis (F8) | 1. User posts review: `"A brilliant and enchanting tale."`<br>2. Inspects saved review payload. | Review automatically contains populated `sentiment: { score: > 0.4, label: "positive", keywords: [...] }`. |
| `T3-CMB-05` | Review Sentiment + Recommendation Adaptation | `e2e-scenarios.test.js` | Reviews (F4) + Sentiment Adaptation (F9) | 1. User posts positive review for sci-fi novel.<br>2. Calls `POST /api/recommend/sentiment-adapted`. | Adapted recommendations returned matching positive themes of the review. |
| `T3-CMB-06` | User Shelves as Seeds for 3-Seed Recommendation | `e2e-scenarios.test.js` | Shelves (F3) + 3-Seed Recs (F6) | 1. User shelves 3 books.<br>2. Queries `/api/me/shelves` to extract ISBNs.<br>3. Posts them as seeds to `POST /api/recommend/three`. | Valid recommendation list generated with seed exclusion verified. |
| `T3-CMB-07` | Reset Books preserves User Reviews intact | `e2e-scenarios.test.js` | Settings Reset (F5) + Reviews (F4) | 1. User shelves 4 books and writes 2 reviews.<br>2. Executes `POST /api/me/reset-books`.<br>3. Queries `/api/me/shelves` and `/api/me/reviews`. | Shelves are empty (`[]`), but both reviews remain completely intact. |
| `T3-CMB-08` | Delete Reviews preserves User Shelves intact | `e2e-scenarios.test.js` | Settings Delete (F5) + Shelves (F3) | 1. User shelves 4 books and writes 2 reviews.<br>2. Executes `DELETE /api/me/reviews`.<br>3. Queries `/api/me/shelves` and `/api/me/reviews`. | User reviews count is 0, but all 4 books remain on their respective shelves. |
| `T3-CMB-09` | Multi-User Concurrent Review Aggregation | `e2e-scenarios.test.js` | Multi-User (F2) + Reviews Aggregation (F4) | 1. User 1 submits rating 5 for ISBN.<br>2. User 2 submits rating 1 for same ISBN.<br>3. Public aggregation query. | `totalReviews === 2`, `averageRating === 3.0`, `ratingCounts: { 1: 1, 5: 1 }`. |
| `T3-CMB-10` | Custom Weights applied to User Shelf Seeds | `e2e-scenarios.test.js` | Shelves (F3) + Algorithm Customization (F10) | 1. Extract 3 seed ISBNs from user library.<br>2. Request recommendations with `weights: { author: 0.9, genre: 0.1 }`. | Top recommendations reflect author matching books for the user's shelved seeds. |
| `T3-CMB-11` | Sentiment Adaptation with User Shelf Exclusion | `e2e-scenarios.test.js` | Shelves (F3) + Sentiment Adaptation (F9) | 1. User marks Book B as `read`.<br>2. Reviews Book A and requests sentiment-adapted recs. | Recs generate candidate list; verify UI/endpoint identifies or excludes already read Book B. |
| `T3-CMB-12` | Token Expiry midway through Shelf Mutation | `e2e-scenarios.test.js` | Auth (F1) + Shelves (F3) | 1. User token expires or signature altered.<br>2. Attempts `PUT /api/me/shelf/:isbn`. | HTTP 401 rejected; previously existing shelf state remains uncorrupted. |

---

### 3.4 Tier 4: Real-World Application Scenarios (6 Multi-Step Workflows)
All Tier 4 tests model authentic end-to-end user journeys and are mapped to `tests/e2e-scenarios.test.js`.

#### `T4-SCN-01`: The Complete Reader Journey — From Discovery to Finished Book
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "Alice", a new avid reader joining Bookable.
- **Workflow Steps**:
  1. Alice registers via `POST /api/auth/signup` (`username: "alice_reader"`), receives JWT token.
  2. Searches the catalog for Tolkien books: `GET /api/books/search?q=tolkien&limit=5`.
  3. Discovers "The Hobbit" (`0345339681`) and adds it to her Want to Read shelf: `PUT /api/me/shelf/0345339681` with `{ status: "want_to_read" }`.
  4. When she starts reading, transitions status to Currently Reading: `PUT /api/me/shelf/0345339681` with `{ status: "currently_reading" }`.
  5. Upon finishing, transitions status to Read: `PUT /api/me/shelf/0345339681` with `{ status: "read" }`.
  6. Submits her rating and review: `POST /api/books/0345339681/reviews` with `{ rating: 5, text: "Magnificent adventure, loved Bilbo's journey!" }`.
  7. Verifies `GET /api/me/shelves` displays the book under `read`, and `GET /api/me/reviews` displays her 5-star review with positive sentiment.

#### `T4-SCN-02`: The Critical Reviewer & Community Impact
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "Bob", a critical reviewer monitoring book community ratings.
- **Workflow Steps**:
  1. Bob logs in with existing account: `POST /api/auth/login`.
  2. Inspects current baseline community score for Dune (`0441172660`): `GET /api/books/0441172660/reviews` (records $N$ total reviews and average $R$).
  3. Submits a critical 2-star review: `POST /api/books/0441172660/reviews` with `{ rating: 2, text: "Complex world but the pacing in the middle was painfully slow and tedious." }`.
  4. Confirms local sentiment analyzer classified text as negative (`sentiment.label === "negative"`, score $< 0$).
  5. Verifies community score immediately recalculates: `totalReviews === N + 1`, and `averageRating` adjusted downward.
  6. Bob later reconsiders and deletes his review: `DELETE /api/reviews/:reviewId`.
  7. Confirms community stats immediately restore to $N$ total reviews and previous average $R$.

#### `T4-SCN-03`: Personalized 3-Seed Discovery & Algorithm Tuning
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "Clara", a curator looking for tailored recommendations using custom weight sliders.
- **Workflow Steps**:
  1. Clara logs in and selects 3 favorite seed books: Dune (`0441172660`), The Hobbit (`0345339681`), and 1984 (`0451524934`).
  2. Runs baseline recommendation query: `POST /api/recommend/three` with default metadata weights.
  3. Examines returned candidates and confirms title similarity did not influence results ($w_{\text{title}} = 0$).
  4. Opens Algorithm Customizer and boosts author weight to 0.70 while setting genre to 0.15 and rating to 0.15.
  5. Runs customized recommendation query: `POST /api/recommend/three` with custom weights.
  6. Observes ranking shift: other works by Frank Herbert, J.R.R. Tolkien, and George Orwell advance to top positions.
  7. Selects the top recommended candidate and adds it to her `want_to_read` shelf: `PUT /api/me/shelf/:topIsbn`.

#### `T4-SCN-04`: Review Sentiment-Driven Reading Expansion
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "David", expanding his reading list based on his emotional reaction to a book.
- **Workflow Steps**:
  1. David logs in and submits an ecstatic review for Neuromancer: `POST /api/books/:isbn/reviews` with `{ rating: 5, text: "Astounding cyberpunk classic, gritty neon noir atmosphere and electrifying prose!" }`.
  2. Submits review text to sentiment-adapted recommendation endpoint: `POST /api/recommend/sentiment-adapted`.
  3. System parses keywords `["cyberpunk", "neon", "noir", "electrifying"]` with positive score $> 0.75$.
  4. System generates adapted recommendations favoring high-rated cyberpunk and tech-noir titles.
  5. Confirms the reviewed seed book is excluded from recommendations.
  6. David shelves the top two adapted recommendations into his Want to Read shelf.

#### `T4-SCN-05`: Strict Multi-User Privacy & Security Wall
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "User A" (Private reader) and "User B" (Adversary/Curious reader).
- **Workflow Steps**:
  1. User A registers and logs in; shelves 3 private books into `currently_reading` and writes a review.
  2. User B registers and logs in separately.
  3. User B queries `GET /api/me/shelves` -> receives empty shelves (0 books).
  4. User B queries `GET /api/me/reviews` -> receives empty list (0 reviews).
  5. User B obtains User A's review ID from public feed and attempts `DELETE /api/reviews/:userAReviewId` with User B's token.
  6. Server rejects deletion with HTTP 403 Forbidden.
  7. User A logs in and runs `POST /api/me/reset-books`.
  8. Verifies only User A's shelves were reset; User B's account is completely unaffected.

#### `T4-SCN-06`: Library Clean Slate & GDPR-Style Data Deletion
- **Target File**: `tests/e2e-scenarios.test.js`
- **Persona**: "Emma", conducting maintenance and reset of her reading profile.
- **Workflow Steps**:
  1. Emma has accumulated 5 books across `wantToRead`, `currentlyReading`, and `read`, plus 3 reviews.
  2. Navigates to Settings page.
  3. Executes Reset Library Books (`POST /api/me/reset-books`).
  4. Verifies `GET /api/me/shelves` returns empty arrays for all shelf types.
  5. Verifies `GET /api/me/reviews` still contains all 3 reviews with ratings and sentiments.
  6. Executes Delete All Reviews (`DELETE /api/me/reviews`).
  7. Verifies `GET /api/me/reviews` now returns empty array `[]`.
  8. Verifies public book pages recalculate aggregate ratings, removing Emma's former scores.

---

### 3.5 Target File Mapping Matrix Summary

| Target Test File | Tier 1 Tests | Tier 2 Tests | Tier 3 Tests | Tier 4 Tests | Total Tests |
|---|---|---|---|---|---|
| `tests/auth-isolation.test.js` | 10 (F1: 5, F2: 5) | 11 (F1: 6, F2: 5) | 0 | 0 | **21** |
| `tests/recommendation-heuristics.test.js` | 15 (F6: 5, F7: 5, F10: 5) | 15 (F6: 5, F7: 5, F10: 5) | 0 | 0 | **30** |
| `tests/sentiment-analysis.test.js` | 10 (F8: 5, F9: 5) | 10 (F8: 5, F9: 5) | 0 | 0 | **20** |
| `tests/e2e-scenarios.test.js` | 15 (F3: 5, F4: 5, F5: 5) | 16 (F3: 5, F4: 6, F5: 5) | 12 | 6 | **49** |
| **Total Across All Suites** | **50** | **52** | **12** | **6** | **120** |

---

## 4. Caveats

1. **In-Flight Endpoint Implementation**:
   - Several endpoints (`PUT /api/me/shelf/:isbn`, `POST /api/me/reset-books`, `DELETE /api/me/reviews`, `POST /api/recommend/three`, `POST /api/recommend/sentiment-adapted`) are defined in `PROJECT.md` contracts and currently being developed in milestones M1 and M2.
   - The test case matrix is designed to test against these formal contract specifications. Test implementations should run against these routes as they come online.

2. **Catalog Seed Availability**:
   - The test cases explicitly specify popular, guaranteed ISBNs (`'059035342X'`, `'0345339681'`, `'0441172660'`, `'0451524934'`) that exist in `POPULAR_ISBNS` and `Books.csv`. If tests run in an ephemeral or mock environment without the full 270,000 book database loaded, the test runner setup must seed these test fixtures.

3. **No Direct Title Similarity Weighting**:
   - Feature 7 explicitly mandates $w_{\text{title}} = 0$. The test runner must verify both that the recommendation endpoint rejects/zeros out title similarity and that results are not biased by title token overlaps.

---

## 5. Conclusion

A comprehensive, production-grade 4-tier E2E test case matrix has been designed, comprising **120 concrete test cases** (Tier 1: 50, Tier 2: 52, Tier 3: 12, Tier 4: 6), strictly exceeding all required coverage thresholds. Each test case is uniquely identified, fully specified with concrete inputs and expected outcomes, and mapped to its target test file. The matrix is ready for immediate test implementation by the test authoring agents.

---

## 6. Verification Method

1. **Test Count Verification**:
   - Count Tier 1 tests: 50 (5 per feature across 10 features).
   - Count Tier 2 tests: 52 (5–6 per feature across 10 features).
   - Count Tier 3 tests: 12 ($\ge 10$).
   - Count Tier 4 tests: 6 ($\ge 5$).
   - Total: 120 test cases.

2. **Target File Distribution Inspection**:
   - `tests/auth-isolation.test.js`: 21 test cases.
   - `tests/recommendation-heuristics.test.js`: 30 test cases.
   - `tests/sentiment-analysis.test.js`: 20 test cases.
   - `tests/e2e-scenarios.test.js`: 49 test cases.

3. **Independent Execution Command**:
   When test scripts are written:
   ```bash
   node tests/run-all.js
   ```
   or per-file execution:
   ```bash
   node --test tests/auth-isolation.test.js
   node --test tests/recommendation-heuristics.test.js
   node --test tests/sentiment-analysis.test.js
   node --test tests/e2e-scenarios.test.js
   ```
