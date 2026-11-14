# Scope: Milestone 1 — Backend Data Models, Auth, Shelves & Settings

## Architecture
- **Data Models**:
  - `server/src/models/User.js`: Extend schema to include `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }` while maintaining `favorites` and `wantToRead`. Include helper methods/virtuals if appropriate.
  - `server/src/models/Review.js`: New model with fields:
    - `userId`: ObjectId referencing User, required, indexed
    - `username`: String, required
    - `displayName`: String, default ''
    - `isbn`: String, required, indexed
    - `rating`: Number, required, min: 1, max: 5
    - `text`: String, default '', trim, maxlength: 5000
    - `sentiment`: `{ score: { type: Number, default: 0 }, label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' }, keywords: { type: [String], default: [] } }`
    - Timestamps: true, versionKey: false
    - Indices: unique compound index on `{ userId: 1, isbn: 1 }` (one review per user per book), and `{ isbn: 1, createdAt: -1 }`.
- **API Endpoints**:
  - Shelves & Statuses (`server/src/routes/users.js`):
    - `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`: Exclusive status transitions between reading shelves.
    - `GET /api/me/shelves`: Returns populated book lists partitioned into `{ wantToRead, currentlyReading, read, favorites }`.
    - `POST /api/me/want/:isbn` & `DELETE /api/me/want/:isbn`: Preserved for backwards compatibility with smoke tests.
    - `GET /api/me`: Extended to return `currentlyReading` and `read` books populated, along with shelf statistics.
  - Reviews (`server/src/routes/reviews.js` mounted at `/api`):
    - `GET /api/books/:isbn/reviews`: Public (optional auth). Returns `{ averageRating, totalReviews, ratingDistribution: { 1: n, 2: n, 3: n, 4: n, 5: n }, reviews: [...], userReview: review | null }`.
    - `POST /api/books/:isbn/reviews`: Authenticated (`requireAuth`). Accepts `{ rating: 1-5, text: string }`. Upserts user's review for ISBN, sets default/local sentiment, adds book to `read` shelf if not present, and returns created/updated review with stats.
    - `DELETE /api/reviews/:id`: Authenticated. Verifies `review.userId.equals(req.userId)`. Returns 204 or 403/404 if unauthorized.
    - `GET /api/me/reviews`: Authenticated. Returns all reviews by `req.userId` populated with book details.
  - Settings (`server/src/routes/users.js`):
    - `POST /api/me/reset-books`: Authenticated. Clears user's `wantToRead`, `currentlyReading`, `read`, and `favorites` arrays (leaves reviews intact).
    - `DELETE /api/me/reviews`: Authenticated. Deletes all reviews written by `req.userId` (leaves shelves intact).
- **Express App Wiring (`server/src/index.js`)**:
  - Import and mount `reviewsRouter` under `/api`.
  - Ensure CORS and JSON body parser handle requests properly.

## Feature Inventory
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 1 | Reading Statuses | Full 3-status management (Want to read, Currently reading, Read) with exclusive transitions | M1 | DONE |
| 2 | Book Catalog Reviews & Ratings | 1-5 star ratings and written reviews for any catalog book | M1 | DONE |
| 3 | Community Review Stream | Display community reviews and user's review on book endpoints | M1 | DONE |
| 4 | Multi-Shelf Personal Libraries | Shelves endpoints returning populated books across all reading statuses | M1 | DONE |
| 5 | Multi-User Data Isolation | Strict isolation of libraries, shelves, and review mutations by authenticated userId | M1 | DONE |
| 6 | Settings Page Endpoints | Reset library books (POST /api/me/reset-books) and delete user reviews (DELETE /api/me/reviews) | M1 | DONE |

## Write Boundaries (Exclusively Owned)
- `server/src/models/Review.js`
- `server/src/models/User.js`
- `server/src/routes/reviews.js`
- `server/src/routes/users.js`
- `server/src/index.js`
- `server/src/auth.js`

## Milestones & Status
| Iteration | Status | Key Output / Verification |
|-----------|--------|---------------------------|
| Iteration 1 | FAIL | Gate failed on rating type coercion in Challenger 1 |
| Iteration 2 | **DONE (PASS)** | All tests passed (63/63 M1, 92/92 stress, 174/174 challenger 2, 120/120 run-all, 100% smoke). Both Reviewers APPROVE. Both Challengers APPROVE. Auditor CLEAN. Git commit `9ce36d9`. |
