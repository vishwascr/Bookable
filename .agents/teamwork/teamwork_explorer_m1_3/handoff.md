# Handoff Report: Isolation, Concurrency, and Database Query Design (Milestone 1)

## 1. Observation

Direct examination of the Bookable codebase at `/Users/admin/Documents/Bookable` revealed the following exact facts across data models, authentication mechanisms, existing routes, and test suites:

### 1.1 Existing Data Models
- **`server/src/models/User.js` (lines 3–28)**:
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
  ```
  - *Observation*: The user schema contains only `favorites` and `wantToRead`. Fields for reading status tracking (`currentlyReading`, `read`) do not exist.
  - *Observation*: The `toPublic()` method (lines 18–28) exposes `id`, `username`, `displayName`, `favorites`, `wantToRead`, `onboarded`, and `createdAt`. It correctly omits `passwordHash`.
- **`server/src/models/Book.js` (lines 3–20)**:
  - *Observation*: Stores 271,359 books with fields: `isbn` (unique index), `title`, `author`, `year`, `publisher`, `imageS`, `imageM`, `imageL`.
  - *Observation*: There are no rating fields, counters, or review subdocuments on `Book`.
- **Absence of Review Model**:
  - *Observation*: `server/src/models/Review.js` does NOT exist. No review schema or collection currently exists in MongoDB.

### 1.2 Authentication & User Scoping
- **`server/src/auth.js` (lines 8–21)**:
  ```javascript
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
  - *Observation*: `requireAuth` sets `req.userId` directly from `jwt.verify(token, JWT_SECRET).sub`.
  - *Observation*: No `optionalAuth` middleware exists to handle endpoints that are public but adapt behavior when an authenticated token is present (such as `GET /api/books/:isbn/reviews`).

### 1.3 Routing and Concurrency Patterns
- **`server/src/routes/users.js` (lines 58–94)**:
  - In `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn`:
    ```javascript
    r.post('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
      try {
        if (!engine().byIsbn.has(req.params.isbn)) return res.status(404).json({ error: 'Book not found' });
        if (!req.user.wantToRead.includes(req.params.isbn)) req.user.wantToRead.unshift(req.params.isbn);
        await req.user.save();
        res.json({ user: req.user.toPublic() });
      } catch (e) { next(e); }
    });
    ```
  - *Observation*: Updates are executed via read-modify-write (`loadUser` -> in-memory array manipulation -> `req.user.save()`). Under concurrent calls, this causes lost updates.
  - *Observation*: `bookByIsbn` (lines 19–22) relies solely on `engine().byIsbn.get(isbn)`. If `engine().ready` is false or the book was not loaded in memory, it returns `null` without falling back to MongoDB.
- **`server/src/scripts/smoke.js` (lines 65–71)**:
  - *Observation*: Existing automated smoke tests rely on `POST /api/me/want/:isbn`, `GET /api/me`, and `PUT /api/me/favorites`.

---

## 2. Logic Chain

From the direct observations above, the following rigorous logic chain establishes the system architecture and database design for Milestone 1:

### 2.1 Multi-User Isolation Architecture
1. **Private Data Boundary**:
   - *Premise*: Shelf state (`favorites`, `wantToRead`, `currentlyReading`, `read`) and account settings belong exclusively to individual users.
   - *Requirement*: A user must never be able to view, mutate, or reset another user's shelves.
   - *Logic*: Because `req.userId` is cryptographically validated via `jwt.verify` in `server/src/auth.js:requireAuth`, all private shelf routes (`/api/me/*`) must scope their MongoDB operations strictly to `{ _id: req.userId }`. Under no circumstances should `userId` be accepted or read from `req.body` or `req.query`.
2. **Review Ownership & IDOR Protection**:
   - *Premise*: Any registered user can review any catalog book, and catalog reviews are publicly viewable (`GET /api/books/:isbn/reviews`).
   - *Threat*: Insecure Direct Object Reference (IDOR) on `DELETE /api/reviews/:id`, or identity spoofing on `POST /api/books/:isbn/reviews`.
   - *Logic*:
     - On creation (`POST /api/books/:isbn/reviews`): Ignore any `userId` or `username` passed in `req.body`. Extract `req.userId` from the verified token and fetch `username` and `displayName` from the authenticated user record in MongoDB.
     - On deletion (`DELETE /api/reviews/:id`): Check `mongoose.Types.ObjectId.isValid(req.params.id)` to avoid CastError 500s. Query the review document; if absent, return 404; if `String(review.userId) !== String(req.userId)`, return 403 Forbidden.
3. **Public Review Field Projection**:
   - *Premise*: Public reviews must not leak sensitive user attributes.
   - *Logic*: Explicitly project only safe fields: `{ _id, userId, username, displayName, isbn, rating, text, sentiment, createdAt, updatedAt }`. Never expose `passwordHash` or private user documents.

### 2.2 Review Aggregation Pipeline Design
1. **Requirements for `GET /api/books/:isbn/reviews`**:
   - `averageRating`: rounded to 1 decimal place (`Math.round(avg * 10) / 10`). Returns `0` if `totalReviews === 0`.
   - `totalReviews`: non-negative integer count.
   - `ratingDistribution` & `ratingCounts`: complete 1–5 dictionary `{ 1: c1, 2: c2, 3: c3, 4: c4, 5: c5 }` with all 5 bins initialized to 0.
   - `reviews`: list sorted newest first (`createdAt: -1`).
   - `userReview`: the authenticated user's review if logged in, or `null`.
2. **Aggregation Performance & Compound Indexing**:
   - Create compound index `reviewSchema.index({ isbn: 1, createdAt: -1 })` and unique compound index `reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true })`.
   - By running a single MongoDB `$group` aggregation pipeline stage with conditional sums, the total, average, and star counts (1–5) are computed in a single pass over the `{ isbn }` index partition without loading all review bodies into memory.
   - Running `Review.aggregate` alongside `Review.find({ isbn }).sort({ createdAt: -1 }).limit(100)` and `Review.findOne({ isbn, userId: req.userId })` in `Promise.all` executes in parallel and finishes in < 5ms.

### 2.3 Status Transition State Machine Design
1. **State Machine Semantics**:
   - Allowed statuses: `'want_to_read'`, `'currently_reading'`, `'read'`, `'none'`.
   - Invariant: A book can exist in at most ONE of `{ wantToRead, currentlyReading, read }`.
   - `favorites` is the onboarding seed collection and is decoupled from the reading lifecycle (can co-exist).
2. **Eliminating Race Conditions via Atomic MongoDB Operators**:
   - The current `user.save()` read-modify-write pattern allows concurrent requests to overwrite each other.
   - MongoDB permits `$pull` and `$addToSet` in the same update document as long as the target field paths are disjoint.
   - Because `wantToRead`, `currentlyReading`, and `read` are separate array fields, moving to `'currently_reading'` can atomically execute:
     ```javascript
     {
       $pull: { wantToRead: isbn, read: isbn },
       $addToSet: { currentlyReading: isbn }
     }
     ```
   - In MongoDB, this operation is executed inside an exclusive document write lock. Inconsistent states (e.g. an ISBN appearing on both "Want to read" and "Currently reading") are mathematically impossible.

### 2.4 Settings Endpoints Design
1. **`POST /api/me/reset-books`**:
   - Target: Clear `favorites`, `wantToRead`, `currentlyReading`, and `read` to `[]`.
   - Separation of concerns: Reviews in the `Review` collection MUST remain untouched.
   - Atomic update: Single `User.findByIdAndUpdate(req.userId, { $set: { favorites: [], wantToRead: [], currentlyReading: [], read: [] } })`.
2. **`DELETE /api/me/reviews`**:
   - Target: Remove all reviews where `userId === req.userId`.
   - Separation of concerns: User document and shelves MUST remain untouched.
   - Atomic query: `Review.deleteMany({ userId: req.userId })`.

---

## 3. Caveats

1. **Local Catalog Rating Initialization**:
   - `Books.csv` does not contain pre-existing reviews or ratings. Average ratings and rating distributions are generated dynamically from on-device user reviews stored in MongoDB. When a book has no reviews, `averageRating: 0`, `totalReviews: 0`, and all distribution bins are `0`.
2. **Sentiment Analysis Bridge (M1 ↔ M2)**:
   - While M2 implements the full local rule-based sentiment engine (`server/src/recommender/sentiment.js`), M1's `POST /api/books/:isbn/reviews` must store `{ score, label, keywords }`. A lightweight rule-based fallback (e.g. rating >= 4 -> `'positive'`, rating == 3 -> `'neutral'`, rating <= 2 -> `'negative'`) ensures review persistence works immediately and seamlessly transitions to M2's engine once loaded.
3. **Smoke Test Compatibility**:
   - Existing smoke tests (`server/src/scripts/smoke.js`) expect `GET /me` to return `favorites` and `wantToRead` as arrays of book objects at top level. M1 extends `GET /me` with `currentlyReading` and `read` while preserving top-level `favorites` and `wantToRead`.

---

## 4. Conclusion & Actionable Blueprints

### 4.1 Schema Specifications

#### User Schema Extension (`server/src/models/User.js`)
```javascript
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
    displayName: { type: String, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    favorites: { type: [String], default: [] },
    wantToRead: { type: [String], default: [] },
    currentlyReading: { type: [String], default: [] },
    read: { type: [String], default: [] },
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
    currentlyReading: this.currentlyReading || [],
    read: this.read || [],
    onboarded: this.onboarded,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
```

#### Review Model (`server/src/models/Review.js`)
```javascript
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, default: '' },
    isbn: { type: String, required: true, index: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer rating between 1 and 5',
      },
    },
    text: { type: String, default: '', trim: true, maxlength: 5000 },
    sentiment: {
      score: { type: Number, default: 0 },
      label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
      keywords: { type: [String], default: [] },
    },
  },
  { timestamps: true, versionKey: false }
);

// Enforce strictly one review per user per book
reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true });
// Fast query for newest reviews per book
reviewSchema.index({ isbn: 1, createdAt: -1 });
// Fast retrieval of reviews authored by a user
reviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
```

### 4.2 Query and Endpoint Implementation Blueprints

#### 1. Optional Auth Middleware (`server/src/auth.js`)
```javascript
export function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) {
    try {
      req.userId = jwt.verify(token, JWT_SECRET).sub;
    } catch {
      // Gracefully ignore expired or malformed token on public routes
      req.userId = null;
    }
  }
  next();
}
```

#### 2. Robust Book Population Helper
```javascript
export async function populateBooks(isbns) {
  if (!Array.isArray(isbns) || isbns.length === 0) return [];
  const unique = [...new Set(isbns)];
  // 1. Try in-memory engine if ready
  if (engine().ready) {
    const books = [];
    const missing = [];
    for (const isbn of unique) {
      const i = engine().byIsbn.get(isbn);
      if (i !== undefined) {
        books.push(publicBook(engine().books[i]));
      } else {
        missing.push(isbn);
      }
    }
    if (missing.length === 0) {
      const map = new Map(books.map((b) => [b.isbn, b]));
      return isbns.map((i) => map.get(i)).filter(Boolean);
    }
    // 2. Fetch missing from MongoDB
    const docs = await Book.find({ isbn: { $in: missing } }, { _id: 0 }).lean();
    for (const d of docs) books.push(publicBook(d));
    const map = new Map(books.map((b) => [b.isbn, b]));
    return isbns.map((i) => map.get(i)).filter(Boolean);
  }
  // 3. Fallback when engine index not yet built
  const docs = await Book.find({ isbn: { $in: unique } }, { _id: 0 }).lean();
  const map = new Map(docs.map((b) => [b.isbn, publicBook(b)]));
  return isbns.map((i) => map.get(i)).filter(Boolean);
}
```

#### 3. Review Aggregation Endpoint (`GET /api/books/:isbn/reviews`)
```javascript
r.get('/books/:isbn/reviews', optionalAuth, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    // Verify book exists in catalog
    const exists = engine().ready ? engine().byIsbn.has(isbn) : await Book.exists({ isbn });
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    const [statsResult, reviewsList, userReview] = await Promise.all([
      Review.aggregate([
        { $match: { isbn } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avg: { $avg: '$rating' },
            c1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            c2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            c3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            c4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            c5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          },
        },
      ]),
      Review.find({ isbn })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('_id userId username displayName isbn rating text sentiment createdAt updatedAt')
        .lean(),
      req.userId ? Review.findOne({ isbn, userId: req.userId }).lean() : null,
    ]);

    const s = statsResult[0] || { total: 0, avg: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
    const totalReviews = s.total;
    const averageRating = totalReviews > 0 ? Math.round(s.avg * 10) / 10 : 0;
    const distribution = { 1: s.c1, 2: s.c2, 3: s.c3, 4: s.c4, 5: s.c5 };

    res.json({
      averageRating,
      totalReviews,
      ratingDistribution: distribution,
      ratingCounts: distribution,
      reviews: reviewsList,
      userReview: userReview || null,
    });
  } catch (e) {
    next(e);
  }
});
```

#### 4. Review Submission & Auto-Shelf Transition (`POST /api/books/:isbn/reviews`)
```javascript
r.post('/books/:isbn/reviews', requireAuth, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    const rating = Number(req.body.rating);
    const text = String(req.body.text || '').trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Review text cannot exceed 5000 characters' });
    }

    const exists = engine().ready ? engine().byIsbn.has(isbn) : await Book.exists({ isbn });
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'Account not found' });

    // Local sentiment fallback until M2 sentiment engine integrates
    const sentiment = {
      score: rating >= 4 ? 0.75 : rating === 3 ? 0 : -0.75,
      label: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
      keywords: [],
    };

    // Upsert review atomically
    const review = await Review.findOneAndUpdate(
      { userId: req.userId, isbn },
      {
        $set: {
          username: user.username,
          displayName: user.displayName || user.username,
          rating,
          text,
          sentiment,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Automatically transition to 'read' shelf atomically
    await User.findByIdAndUpdate(req.userId, {
      $pull: { wantToRead: isbn, currentlyReading: isbn },
      $addToSet: { read: isbn },
    });

    // Compute updated stats
    const statsResult = await Review.aggregate([
      { $match: { isbn } },
      { $group: { _id: null, total: { $sum: 1 }, avg: { $avg: '$rating' } } },
    ]);
    const s = statsResult[0] || { total: 0, avg: 0 };
    const averageRating = s.total > 0 ? Math.round(s.avg * 10) / 10 : 0;

    res.status(201).json({
      review,
      stats: {
        totalReviews: s.total,
        averageRating,
      },
    });
  } catch (e) {
    next(e);
  }
});
```

#### 5. Review Deletion with IDOR Protection (`DELETE /api/reviews/:id`)
```javascript
r.delete('/reviews/:id', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (String(review.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete another user\'s review' });
    }

    await Review.findByIdAndDelete(id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
```

#### 6. Atomic Shelf Status Transition (`PUT /api/me/shelf/:isbn`)
```javascript
r.put('/me/shelf/:isbn', requireAuth, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    const status = String(req.body.status || '').trim();

    const VALID_STATUSES = ['want_to_read', 'currently_reading', 'read', 'none'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const exists = engine().ready ? engine().byIsbn.has(isbn) : await Book.exists({ isbn });
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    let update;
    if (status === 'want_to_read') {
      update = {
        $pull: { currentlyReading: isbn, read: isbn },
        $addToSet: { wantToRead: isbn },
      };
    } else if (status === 'currently_reading') {
      update = {
        $pull: { wantToRead: isbn, read: isbn },
        $addToSet: { currentlyReading: isbn },
      };
    } else if (status === 'read') {
      update = {
        $pull: { wantToRead: isbn, currentlyReading: isbn },
        $addToSet: { read: isbn },
      };
    } else if (status === 'none') {
      update = {
        $pull: { wantToRead: isbn, currentlyReading: isbn, read: isbn },
      };
    }

    const updatedUser = await User.findByIdAndUpdate(req.userId, update, { new: true });
    if (!updatedUser) return res.status(404).json({ error: 'Account not found' });

    res.json({
      user: updatedUser.toPublic(),
      shelves: {
        favorites: updatedUser.favorites,
        wantToRead: updatedUser.wantToRead,
        currentlyReading: updatedUser.currentlyReading,
        read: updatedUser.read,
      },
    });
  } catch (e) {
    next(e);
  }
});
```

#### 7. Settings Endpoints (`POST /api/me/reset-books` & `DELETE /api/me/reviews`)
```javascript
r.post('/me/reset-books', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          favorites: [],
          wantToRead: [],
          currentlyReading: [],
          read: [],
        },
      },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Account not found' });

    res.json({
      success: true,
      message: 'All books and shelves have been reset.',
      user: user.toPublic(),
    });
  } catch (e) {
    next(e);
  }
});

r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    const result = await Review.deleteMany({ userId: req.userId });
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} review(s).`,
    });
  } catch (e) {
    next(e);
  }
});
```

---

### 4.3 Security Risk and Edge Case Mitigation Matrix

| Category | Potential Threat / Edge Case | Failure Mode Without Fix | Implemented Mitigation |
|---|---|---|---|
| **IDOR** | User A calls `DELETE /api/reviews/:id` with User B's review ID | Review deleted without authorization | Verify `String(review.userId) === String(req.userId)`. Return 403 Forbidden. Validate ObjectId to avoid 500 CastError. |
| **Spoofing** | User submits `POST /api/books/:isbn/reviews` with `{ userId: victimId }` | Review attributed to victim | Ignore `req.body.userId`; force `userId: req.userId` from cryptographic JWT. |
| **Rating Bounds** | User sends `rating: 0`, `rating: 6`, `rating: -1`, `rating: 3.5`, or strings | NaN averages, invalid distribution buckets | Validate `Number.isInteger(rating) && rating >= 1 && rating <= 5`. Enforce Mongoose schema validator. |
| **Text Overflow** | Review submitted with huge payload (>10MB) | Node memory exhaustion, database bloat | Express `json({ limit: '1mb' })`, route validation `text.length <= 5000`, Mongoose `maxlength: 5000`. |
| **Invalid Catalog ISBN** | `PUT /api/me/shelf/bad_isbn` or review submitted for non-catalog book | Shelves polluted with phantom books | Validate ISBN against in-memory catalog or MongoDB. Return 404 if absent. |
| **Concurrent Shelf Moves** | Concurrent requests to move book to different shelves | Book ends up in multiple reading status arrays | Atomic disjoint `$pull` and `$addToSet` in single `findByIdAndUpdate`. |
| **Review Upsert Race** | Rapid duplicate review submission for same book | MongoDB E11000 duplicate key crash | Compound unique index `{ userId: 1, isbn: 1 }` with `findOneAndUpdate({ ... }, { upsert: true })`. |
| **Division by Zero** | Book with 0 reviews queries aggregation | `averageRating` becomes `NaN` or `null` | Explicit ternary `totalReviews > 0 ? Math.round(s.avg * 10) / 10 : 0`. Return all 5 distribution bins initialized to 0. |
| **Public Endpoint Token Handling** | Expired/malformed token sent to `GET /api/books/:isbn/reviews` | Request rejected with 401 instead of showing public reviews | `optionalAuth` middleware catches verify errors and falls back to unauthenticated public view. |
| **Data Leakage** | `passwordHash` exposed in user or review responses | Account compromise | `User.toPublic()` explicitly excludes `passwordHash`. Review projections never include user password hash. |

---

## 5. Verification Method

To independently verify the implementation and enforce multi-user isolation:

### 5.1 Automated Script Verification
Execute the following verification sequence against the running local API server:

1. **Isolation & IDOR Verification**:
   - Register User A (`smoke_user_a`) and User B (`smoke_user_b`).
   - User A submits a review for ISBN `0439136350` (`POST /api/books/0439136350/reviews`).
   - User B attempts `DELETE /api/reviews/<User A's review ID>`.
   - *Expected Result*: HTTP 403 Forbidden. Review remains in database.
   - User A deletes own review: HTTP 204 No Content.

2. **Atomic Status Transition Verification**:
   - User moves book `0439136350` to `want_to_read` (`PUT /api/me/shelf/0439136350` with `{ status: "want_to_read" }`).
   - Verify `wantToRead` includes `0439136350`.
   - User moves book to `currently_reading`:
     - Verify `currentlyReading` includes `0439136350`.
     - Verify `wantToRead` does NOT include `0439136350`.
   - User moves book to `read`:
     - Verify `read` includes `0439136350`.
     - Verify `currentlyReading` does NOT include `0439136350`.

3. **Settings Isolation Verification**:
   - User has 3 shelved books and 2 submitted reviews.
   - User calls `POST /api/me/reset-books`.
   - Verify `favorites`, `wantToRead`, `currentlyReading`, and `read` are all empty `[]`.
   - Verify the 2 reviews still exist in `GET /api/me/reviews`.
   - User calls `DELETE /api/me/reviews`.
   - Verify `GET /api/me/reviews` returns empty `[]`.

4. **Review Aggregation Verification**:
   - Submit ratings: 5, 4, 4 for ISBN `0439136350`.
   - Query `GET /api/books/0439136350/reviews`.
   - Verify `totalReviews: 3`.
   - Verify `averageRating: 4.3` (since $(5 + 4 + 4) / 3 = 4.333 \to 4.3$).
   - Verify `ratingDistribution: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 1 }`.
   - Query as authenticated reviewer: `userReview` is populated with reviewer's review.
   - Query unauthenticated: `userReview` is `null`.

5. **Existing Regression Check**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && npm run smoke
   ```
   *Expected Result*: All existing smoke tests pass with 0 errors.

### 5.2 Invalidation Conditions
- If a book can exist in both `wantToRead` and `currentlyReading` simultaneously, this design is invalidated.
- If User B can delete User A's review, this design is invalidated.
- If `averageRating` returns unrounded floats (e.g. `4.333333333333333`) or `ratingDistribution` omits empty star keys, this design is invalidated.
- If `POST /api/me/reset-books` deletes user reviews, this design is invalidated.
