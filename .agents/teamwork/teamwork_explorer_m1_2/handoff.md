# Milestone 1 Code Deep-Dive & Architecture Integration Report
**Explorer**: Explorer 2 (`teamwork_explorer_m1_2`)  
**Target**: Milestone 1 (Backend Data Models, Auth, Shelves & Settings)  
**Date**: 2026-11-14T00:22:00Z  

---

## 1. Observation

A direct code-level investigation of the Bookable server codebase at `/Users/admin/Documents/Bookable/server` revealed the following exact observations across models, authentication, routes, startup scripts, and test harnesses.

### 1.1 Existing Models (`User.js` and `Book.js`)

#### `server/src/models/User.js` (lines 1–30)
```javascript
import mongoose from 'mongoose';

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

export default mongoose.model('User', userSchema);
```
**Observations**:
- The schema currently defines only two shelf arrays: `favorites` and `wantToRead`.
- `currentlyReading` and `read` are completely absent.
- The `onboarded` virtual evaluates `this.favorites.length >= 3`.
- `toPublic()` exposes `id`, `username`, `displayName`, `favorites`, `wantToRead`, `onboarded`, and `createdAt`. Any extensions to user shelves (`currentlyReading`, `read`) must be added to `toPublic()` so that clients receive consistent profile data.

#### `server/src/models/Book.js` (lines 1–20)
```javascript
import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    isbn: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    year: { type: Number, default: null },
    publisher: { type: String, default: '' },
    imageS: String,
    imageM: String,
    imageL: String,
  },
  { versionKey: false }
);

bookSchema.index({ title: 'text', author: 'text' });
bookSchema.index({ author: 1 });

export default mongoose.model('Book', bookSchema);
```
**Observations**:
- Books are uniquely identified by `isbn: String` with a unique index.
- There are no rating fields, review counters, or genre tags in the `Book` document itself.
- All 271,359 books in MongoDB are indexed by ISBN. In all existing routes (`users.js`, `api.js`), ISBN strings are used as the foreign reference across collections rather than MongoDB `ObjectId`s.

---

### 1.2 Authentication (`server/src/auth.js`, lines 1–21)
```javascript
import jwt from 'jsonwebtoken';
import 'dotenv/config';

// In production set JWT_SECRET in server/.env. The fallback is for local development only.
export const JWT_SECRET = process.env.JWT_SECRET || 'bookable-dev-secret-change-me';
const EXPIRES = '7d';

export const signToken = (user) => jwt.sign({ sub: String(user._id), u: user.username }, JWT_SECRET, { expiresIn: EXPIRES });

// Requires "Authorization: Bearer <token>"; sets req.userId.
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
**Observations**:
- `signToken`: Encodes `{ sub: String(user._id), u: user.username }` with a 7-day expiration.
- `requireAuth`: Parses `Authorization: Bearer <token>`, verifies the signature, and sets `req.userId` as a **`string`** (not a `mongoose.Types.ObjectId`).
- If token is missing, returns HTTP `401` with `{ error: 'Not logged in' }`.
- If token is expired or invalid, returns HTTP `401` with `{ error: 'Session expired, please log in again' }`.
- **Gap**: There is currently NO `optionalAuth` middleware. `GET /api/books/:isbn/reviews` requires optional authentication: public visitors should see reviews, but authenticated users must also receive their own review in `userReview`.

---

### 1.3 Existing User Routes & Book Population (`server/src/routes/users.js`, lines 19–95)
```javascript
const bookByIsbn = (isbn) => {
  const i = engine().byIsbn.get(isbn);
  return i === undefined ? null : publicBook(engine().books[i]);
};

// ---------- current user ----------
const loadUser = async (req, res, next) => {
  try {
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};

r.get('/me', requireAuth, loadUser, (req, res) => {
  res.json({
    user: req.user.toPublic(),
    favorites: req.user.favorites.map(bookByIsbn).filter(Boolean),
    wantToRead: req.user.wantToRead.map(bookByIsbn).filter(Boolean),
  });
});

r.post('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    if (!engine().byIsbn.has(req.params.isbn)) return res.status(404).json({ error: 'Book not found' });
    if (!req.user.wantToRead.includes(req.params.isbn)) req.user.wantToRead.unshift(req.params.isbn);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

r.delete('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    req.user.wantToRead = req.user.wantToRead.filter((i) => i !== req.params.isbn);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});
```
**Observations**:
- `bookByIsbn(isbn)` currently resolves books entirely from the in-memory recommender cache: `engine().byIsbn.get(isbn)`.
- If the recommender index is still building (`!engine().ready`), or if a book is not in the in-memory cache, `bookByIsbn` returns `null`.
- `GET /api/me` returns:
  `{ user: req.user.toPublic(), favorites: [...populated], wantToRead: [...populated] }`.
- `POST /api/me/want/:isbn` adds to `wantToRead` without checking or removing from other shelves.
- `DELETE /api/me/want/:isbn` removes from `wantToRead`.

---

### 1.4 Application Entrypoint & Middleware Mounting (`server/src/index.js`, lines 1–21)
```javascript
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import api from './routes/api.js';
import users from './routes/users.js';
import { buildIndex } from './recommender/engine.js';

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
**Observations**:
- Routers are mounted under `/api`: `users` at `/api`, `api` at `/api`.
- Notice that in `server/src/routes/api.js:65`:
  `r.get('/books/:isbn', ready, ...)`
  If the new reviews router has `GET /api/books/:isbn/reviews`, Express routing correctly resolves it because `/books/:isbn/reviews` has two path segments after `/books` while `/books/:isbn` has only one.
  However, mounting `reviews` BEFORE `api` (`app.use('/api', users); app.use('/api', reviews); app.use('/api', api);`) is the cleanest architecture.
- `buildIndex()` is called asynchronously on line 21 *without* `await`. The server starts listening immediately. Indexing 271k books takes ~3-5 seconds. During those first seconds, any request that relies *only* on `engine().byIsbn` will fail if there is no fallback to MongoDB `Book.findOne({ isbn })`.

---

### 1.5 Smoke Test Verification Analysis (`server/src/scripts/smoke.js`, lines 39–71)
```javascript
// ---- accounts & personalised recommendations ----
const send = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const uname = `smoke_${Date.now()}`;
const su = await send('POST', '/auth/signup', { username: uname, password: 'secret123' });
check('signup → 201 + token', su.status === 201 && !!su.body.token && su.body.user.onboarded === false);
check('duplicate signup → 409', (await send('POST', '/auth/signup', { username: uname, password: 'secret123' })).status === 409);
check('bad password login → 401', (await send('POST', '/auth/login', { username: uname, password: 'nope' })).status === 401);
const li = await send('POST', '/auth/login', { username: uname, password: 'secret123' });
const T = li.body.token;
check('login → token', li.status === 200 && !!T);
check('/me without token → 401', (await get('/me')).status === 401);
check('popular books for onboarding', (await get('/books/popular')).body.length >= 20);
check('favorites < 3 → 400', (await send('PUT', '/me/favorites', { isbns: ['0345339681'] }, T)).status === 400);
const favs = ['0345339681', '0441172660', '0671461494'];
const fv = await send('PUT', '/me/favorites', { isbns: favs }, T);
check('set 3 favorites → onboarded', fv.status === 200 && fv.body.user.onboarded === true);
const fy = await send('GET', '/me/recommend?algo=all&limit=10', null, T);
check('for-you runs all 5 algorithms', fy.status === 200 && fy.body.runs.length === 5);
...
const target = fy.body.runs[0].results[0].book.isbn;
await send('POST', `/me/want/${target}`, null, T);
const fy2 = await send('GET', '/me/recommend?algo=tfidf&limit=10', null, T);
check('want-to-read book excluded from For You', fy2.body.runs[0].results.every((x) => x.book.isbn !== target));
const me = await send('GET', '/me', null, T);
check('/me returns shelves', me.body.favorites.length === 3 && me.body.wantToRead.length === 1);
```
**Exact Smoke Test Assertions & Compatibility Requirements**:
1. `POST /auth/signup` must return HTTP `201` with `token` and `user` where `user.onboarded === false`.
2. Duplicate signup must return HTTP `409`.
3. Bad password login must return HTTP `401`.
4. Successful login must return HTTP `200` with `token` and `user`.
5. `GET /me` without token must return HTTP `401`.
6. `PUT /me/favorites` with < 3 books must return HTTP `400`.
7. `PUT /me/favorites` with 3 books must return HTTP `200` with `user.onboarded === true`.
8. `POST /me/want/:isbn` MUST exist and return HTTP `200`.
9. `GET /me` MUST return `{ favorites: Array(3), wantToRead: Array(1) }` where both arrays contain populated book objects! If `favorites` or `wantToRead` are renamed or converted to arrays of strings, line 70 (`me.body.favorites.length === 3 && me.body.wantToRead.length === 1`) will fail.

---

## 2. Logic Chain

The reasoning connecting observations to our implementation recommendations proceeds through 8 sequential steps:

1. **User Schema Evolution**:
   - *From Observation 1.1*: `User` schema stores `favorites: [String]` and `wantToRead: [String]`.
   - *Requirement (SCOPE.md)*: We must support full 3-status Goodreads reading statuses (`wantToRead`, `currentlyReading`, `read`) while keeping `favorites`.
   - *Inference*: Add `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }`.
   - *Contract constraint*: `userSchema.methods.toPublic()` must serialize these new arrays: `currentlyReading: this.currentlyReading || []`, `read: this.read || []`.

2. **Dual-Layer Book Population Strategy**:
   - *From Observation 1.3 & 1.4*: `bookByIsbn` relies on `engine().byIsbn`. However, `buildIndex()` is asynchronous and takes several seconds. Furthermore, test runners (e.g., unit/integration tests) may test API endpoints without running `buildIndex()`.
   - *Inference*: If `bookByIsbn` returns `null` because `engine().ready` is false or the ISBN is not in the in-memory cache, it must fall back to `Book.findOne({ isbn }).lean()`.
   - *Impact*: Provides instant O(1) in-memory resolution in normal operation, while guaranteeing 100% data availability even during engine startup or test execution.

3. **Authentication & Optional Authentication**:
   - *From Observation 1.2*: `requireAuth` extracts `req.userId` as a string (`jwt.verify(token, JWT_SECRET).sub`).
   - *Requirement (SCOPE.md)*: `GET /api/books/:isbn/reviews` is public but must include `userReview` if the requester is logged in.
   - *Inference*: Introduce `optionalAuth` in `server/src/auth.js`. If `Authorization: Bearer <token>` is present and valid, populate `req.userId`. If absent or invalid, proceed without setting `req.userId` without rejecting with 401.
   - *Type Safety Note*: Because `req.userId` is a string, all Mongoose queries like `Review.find({ userId: req.userId })` work seamlessly (Mongoose automatically casts strings to ObjectIds for `ref: 'User'`), but in JS equality checks, use `review.userId.equals(req.userId)` or `String(review.userId) === String(req.userId)`.

4. **Reading Status State Machine (`PUT /api/me/shelf/:isbn`)**:
   - *From Observation 1.3 & 1.5*: `wantToRead`, `currentlyReading`, and `read` represent mutually exclusive reading states for a given book. `favorites` is an independent curated list (picked during onboarding or profile editing).
   - *Inference*:
     - When setting status `'want_to_read'`: push to `wantToRead`, pull from `currentlyReading` and `read`.
     - When setting status `'currently_reading'`: push to `currentlyReading`, pull from `wantToRead` and `read`.
     - When setting status `'read'`: push to `read`, pull from `wantToRead` and `currentlyReading`.
     - When setting status `'none'`: pull from all three reading shelves (`wantToRead`, `currentlyReading`, `read`).
     - In all cases, `favorites` is unaffected.
   - *Backward compatibility*: `POST /api/me/want/:isbn` should invoke the `'want_to_read'` logic (pulling from `currentlyReading` and `read`), and `DELETE /api/me/want/:isbn` should pull from `wantToRead`.

5. **Response Format for `/api/me` and `/api/me/shelves`**:
   - *From Observation 1.3 & 1.5*: `smoke.js` line 70 directly checks `me.body.favorites.length === 3 && me.body.wantToRead.length === 1`.
   - *Requirement (SCOPE.md)*: Return `currentlyReading` and `read` books populated, along with shelf statistics.
   - *Inference*: In `GET /api/me`, return:
     ```json
     {
       "user": req.user.toPublic(),
       "favorites": [...populatedBooks],
       "wantToRead": [...populatedBooks],
       "currentlyReading": [...populatedBooks],
       "read": [...populatedBooks],
       "stats": {
         "favoritesCount": req.user.favorites.length,
         "wantToReadCount": req.user.wantToRead.length,
         "currentlyReadingCount": req.user.currentlyReading.length,
         "readCount": req.user.read.length
       }
     }
     ```
   - For `GET /api/me/shelves`, return `{ wantToRead: [...], currentlyReading: [...], read: [...], favorites: [...] }`.

6. **Review Schema Architecture & Query Design**:
   - *From Observation 1.1 & 1.2*: Need a dedicated collection `reviews` with:
     - `userId`: `ObjectId` referencing `User` (indexed)
     - `username`: `String` (from user document)
     - `displayName`: `String` (from user document or username)
     - `isbn`: `String` (indexed)
     - `rating`: `Number` (1 to 5)
     - `text`: `String` (trim, max 5000)
     - `sentiment`: `{ score: Number, label: String, keywords: [String] }`
   - *Indexes required*:
     - Compound unique index: `{ userId: 1, isbn: 1 }` (guarantees strictly one review per user per book).
     - Compound sorting index: `{ isbn: 1, createdAt: -1 }` (optimizes `GET /api/books/:isbn/reviews`).
     - Compound user index: `{ userId: 1, createdAt: -1 }` (optimizes `GET /api/me/reviews`).

7. **Review Side-Effects & Sentiment Fallback**:
   - *Requirement (SCOPE.md)*: `POST /api/books/:isbn/reviews` must:
     - Upsert user's review for `(userId, isbn)`.
     - Automatically add the book to the `read` shelf (and remove from `wantToRead` and `currentlyReading`).
     - Calculate sentiment. In Milestone 1, since Milestone 2 builds the advanced lexicon analyzer, M1 must provide a self-contained fallback sentiment heuristic based on rating (`rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral'`) and attempt dynamic import of M2's `sentiment.js` if present.

8. **Settings Endpoints & Isolation**:
   - `POST /api/me/reset-books`: Must atomically empty `wantToRead`, `currentlyReading`, `read`, and `favorites` on `req.user`. It must NOT touch `Review` collection.
   - `DELETE /api/me/reviews`: Must delete all documents from `Review` where `userId === req.userId`. It must NOT touch `User` shelves.
   - `DELETE /api/reviews/:id`: Must check that `review.userId.equals(req.userId)`; if not, return HTTP `403`. If not found, return HTTP `404`. If matched, delete and return HTTP `204`.

---

## 3. Caveats

1. **Recommender Engine Startup Latency**:
   `buildIndex()` in `server/src/recommender/engine.js` loads 271,000 books into memory at boot and takes ~3 to 5 seconds. If integration tests send requests immediately upon process startup, relying solely on `engine().byIsbn` could return `null`. The implementation MUST include a fallback to `Book.findOne({ isbn }).lean()`.
2. **Sentiment Analysis Separation (M1 vs M2)**:
   The sophisticated rule-based sentiment engine belongs to Milestone 2 (`server/src/recommender/sentiment.js`). In Milestone 1, the review endpoint must not throw if `sentiment.js` does not exist yet. The Worker should implement a clean rating-based sentiment baseline that effortlessly adopts `sentiment.js` once M2 lands.
3. **ISBN Case and Cleaning**:
   Some ISBNs end with `'X'` (e.g. `'059035342X'`). ISBN lookups should preserve uppercase `'X'` and trim whitespace (`String(isbn).trim().toUpperCase()`) to avoid mismatch between params and database entries.
4. **No Custom Shelves in Scope**:
   Milestone 1 only encompasses the four core shelves: `favorites`, `wantToRead`, `currentlyReading`, and `read`. Arbitrary user-defined shelf names are not part of Milestone 1.

---

## 4. Conclusion & Concrete Worker Recommendations

To integrate the new models, authentication helpers, and routes cleanly without breaking existing flows, the Worker should apply the following precise implementations.

### 4.1 Update `server/src/models/User.js`

Add `currentlyReading` and `read` to schema, and update `toPublic()`:

```javascript
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
    displayName: { type: String, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    favorites: { type: [String], default: [] }, // ISBNs picked at onboarding (3–5)
    wantToRead: { type: [String], default: [] }, // ISBNs saved from recommendations
    currentlyReading: { type: [String], default: [] }, // ISBNs currently being read
    read: { type: [String], default: [] }, // ISBNs finished reading
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
    currentlyReading: this.currentlyReading,
    read: this.read,
    onboarded: this.onboarded,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
```

---

### 4.2 Create `server/src/models/Review.js`

```javascript
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, default: '' },
    isbn: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '', trim: true, maxlength: 5000 },
    sentiment: {
      score: { type: Number, default: 0 },
      label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
      keywords: { type: [String], default: [] },
    },
  },
  { timestamps: true, versionKey: false }
);

// One review per user per book
reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true });
// Fast query for book reviews sorted newest first
reviewSchema.index({ isbn: 1, createdAt: -1 });
// Fast query for user reviews sorted newest first
reviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
```

---

### 4.3 Update `server/src/auth.js` (Add `optionalAuth`)

Append `optionalAuth` to `server/src/auth.js`:

```javascript
// Optional auth: sets req.userId if token is provided and valid, otherwise proceeds as guest.
export function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
  } catch {
    // Expired or invalid token in optional auth is ignored
  }
  next();
}
```

---

### 4.4 Update `server/src/routes/users.js`

1. **Robust Book Population Helper with MongoDB Fallback**:
   ```javascript
   import Book from '../models/Book.js';
   import { decode } from '../recommender/text.js';

   export const getBookByIsbn = async (isbn) => {
     if (!isbn) return null;
     if (engine().ready && engine().byIsbn.has(isbn)) {
       const i = engine().byIsbn.get(isbn);
       return publicBook(engine().books[i]);
     }
     const doc = await Book.findOne({ isbn }).lean();
     if (!doc) return null;
     const { _id, ...rest } = doc;
     return {
       ...rest,
       title: decode(doc.title),
       author: decode(doc.author),
       publisher: decode(doc.publisher),
     };
   };

   export const populateBooks = async (isbns) => {
     if (!isbns || !isbns.length) return [];
     const list = await Promise.all(isbns.map(getBookByIsbn));
     return list.filter(Boolean);
   };
   ```

2. **Extend `GET /me` (100% Backward Compatible)**:
   ```javascript
   r.get('/me', requireAuth, loadUser, async (req, res, next) => {
     try {
       const [favorites, wantToRead, currentlyReading, read] = await Promise.all([
         populateBooks(req.user.favorites),
         populateBooks(req.user.wantToRead),
         populateBooks(req.user.currentlyReading),
         populateBooks(req.user.read),
       ]);
       res.json({
         user: req.user.toPublic(),
         favorites,
         wantToRead,
         currentlyReading,
         read,
         stats: {
           favoritesCount: req.user.favorites.length,
           wantToReadCount: req.user.wantToRead.length,
           currentlyReadingCount: req.user.currentlyReading.length,
           readCount: req.user.read.length,
         },
       });
     } catch (e) { next(e); }
   });
   ```

3. **Status Transition Route (`PUT /api/me/shelf/:isbn`)**:
   ```javascript
   r.put('/me/shelf/:isbn', requireAuth, loadUser, async (req, res, next) => {
     try {
       const isbn = String(req.params.isbn || '').trim().toUpperCase();
       const { status } = req.body;
       const validStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];
       if (!validStatuses.includes(status)) {
         return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
       }

       // Check book exists in engine or DB
       const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
       if (!exists) return res.status(404).json({ error: 'Book not found' });

       // Mutually exclusive status transition
       req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
       req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
       req.user.read = req.user.read.filter((i) => i !== isbn);

       if (status === 'want_to_read') {
         req.user.wantToRead.unshift(isbn);
       } else if (status === 'currently_reading') {
         req.user.currentlyReading.unshift(isbn);
       } else if (status === 'read') {
         req.user.read.unshift(isbn);
       }

       await req.user.save();

       const shelves = {
         favorites: req.user.favorites,
         wantToRead: req.user.wantToRead,
         currentlyReading: req.user.currentlyReading,
         read: req.user.read,
       };

       res.json({
         user: req.user.toPublic(),
         shelves,
         ...shelves,
       });
     } catch (e) { next(e); }
   });
   ```

4. **Grouped Shelves Route (`GET /api/me/shelves`)**:
   ```javascript
   r.get('/me/shelves', requireAuth, loadUser, async (req, res, next) => {
     try {
       const [wantToRead, currentlyReading, read, favorites] = await Promise.all([
         populateBooks(req.user.wantToRead),
         populateBooks(req.user.currentlyReading),
         populateBooks(req.user.read),
         populateBooks(req.user.favorites),
       ]);
       res.json({
         wantToRead,
         currentlyReading,
         read,
         favorites,
       });
     } catch (e) { next(e); }
   });
   ```

5. **Preserved Want Routes for Backward Compatibility**:
   ```javascript
   r.post('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
     try {
       const isbn = String(req.params.isbn || '').trim().toUpperCase();
       const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
       if (!exists) return res.status(404).json({ error: 'Book not found' });

       req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
       req.user.read = req.user.read.filter((i) => i !== isbn);
       if (!req.user.wantToRead.includes(isbn)) req.user.wantToRead.unshift(isbn);

       await req.user.save();
       res.json({ user: req.user.toPublic() });
     } catch (e) { next(e); }
   });

   r.delete('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
     try {
       const isbn = String(req.params.isbn || '').trim().toUpperCase();
       req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
       await req.user.save();
       res.json({ user: req.user.toPublic() });
     } catch (e) { next(e); }
   });
   ```

6. **Settings Endpoints**:
   ```javascript
   // POST /api/me/reset-books: resets shelves and favorites, keeps reviews
   r.post('/me/reset-books', requireAuth, loadUser, async (req, res, next) => {
     try {
       req.user.wantToRead = [];
       req.user.currentlyReading = [];
       req.user.read = [];
       req.user.favorites = [];
       await req.user.save();
       res.json({ message: 'Books reset successfully', user: req.user.toPublic() });
     } catch (e) { next(e); }
   });
   ```

---

### 4.5 Create `server/src/routes/reviews.js`

Create `server/src/routes/reviews.js` implementing all review operations:

```javascript
import { Router } from 'express';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Book from '../models/Book.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { engine } from '../recommender/engine.js';
import { getBookByIsbn } from './users.js';

const r = Router();

const loadUser = async (req, res, next) => {
  try {
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};

// Fallback sentiment calculator until M2 engine is available
function computeSentiment(rating, text = '') {
  const score = +((rating - 3) / 2).toFixed(2); // 1 -> -1.0, 5 -> 1.0
  const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  return { score, label, keywords: [] };
}

// GET /api/books/:isbn/reviews: Public with optional auth
r.get('/books/:isbn/reviews', optionalAuth, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim().toUpperCase();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    const reviews = await Review.find({ isbn }).sort({ createdAt: -1 }).lean();
    const totalReviews = reviews.length;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const rev of reviews) {
      const star = Math.round(rev.rating);
      if (ratingDistribution[star] !== undefined) ratingDistribution[star]++;
      sum += rev.rating;
    }

    const averageRating = totalReviews > 0 ? +(sum / totalReviews).toFixed(1) : 0;
    const userReview = req.userId ? reviews.find((rev) => String(rev.userId) === String(req.userId)) || null : null;

    res.json({
      averageRating,
      totalReviews,
      ratingDistribution,
      reviews,
      userReview,
    });
  } catch (e) { next(e); }
});

// POST /api/books/:isbn/reviews: Authenticated review submission / upsert
r.post('/books/:isbn/reviews', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim().toUpperCase();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const text = String(req.body.text || '').trim();
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Review text cannot exceed 5000 characters' });
    }

    // Try using M2 sentiment engine if available, otherwise computeSentiment
    let sentiment = computeSentiment(rating, text);
    try {
      const sentimentModule = await import('../recommender/sentiment.js');
      if (typeof sentimentModule.analyzeSentiment === 'function') {
        sentiment = sentimentModule.analyzeSentiment(text, rating);
      }
    } catch {}

    // Upsert user review
    const review = await Review.findOneAndUpdate(
      { userId: req.user._id, isbn },
      {
        userId: req.user._id,
        username: req.user.username,
        displayName: req.user.displayName || req.user.username,
        isbn,
        rating,
        text,
        sentiment,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Side-effect: Add to read shelf, remove from wantToRead and currentlyReading
    req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
    req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
    if (!req.user.read.includes(isbn)) req.user.read.unshift(isbn);
    await req.user.save();

    res.status(201).json({ review });
  } catch (e) { next(e); }
});

// DELETE /api/reviews/:id: Authenticated review deletion
r.delete('/reviews/:id', requireAuth, async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (!review.userId.equals(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }
    await review.deleteOne();
    res.status(204).end();
  } catch (e) { next(e); }
});

// GET /api/me/reviews: Authenticated list of user reviews populated with book details
r.get('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    const populated = await Promise.all(
      reviews.map(async (rev) => ({
        ...rev,
        book: await getBookByIsbn(rev.isbn),
      }))
    );
    res.json(populated);
  } catch (e) { next(e); }
});

// DELETE /api/me/reviews: Settings endpoint - deletes all user reviews
r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    const result = await Review.deleteMany({ userId: req.userId });
    res.json({ message: 'Reviews deleted successfully', deletedCount: result.deletedCount });
  } catch (e) { next(e); }
});

export default r;
```

---

### 4.6 Update `server/src/index.js`

Mount `reviews` router between `users` and `api`:

```javascript
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import api from './routes/api.js';
import users from './routes/users.js';
import reviews from './routes/reviews.js';
import { buildIndex } from './recommender/engine.js';

const PORT = process.env.PORT || 5050;
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', users);
app.use('/api', reviews);
app.use('/api', api);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

await connect();
app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
buildIndex().catch((e) => console.error('[engine] failed', e));
```

---

## 5. Verification Method

To independently verify all changes, run the following commands and check the outputs:

### 5.1 Run Existing Smoke Test
```bash
cd /Users/admin/Documents/Bookable/server && npm run smoke
```
**Expected Output**:
```
✅ health ready ...
✅ all books indexed
✅ 5 algorithms listed
✅ search returns results array
✅ search returns paginated metadata
✅ recommend all for 0439136350
...
✅ signup → 201 + token
✅ duplicate signup → 409
✅ bad password login → 401
✅ login → token
✅ /me without token → 401
✅ popular books for onboarding
✅ favorites < 3 → 400
✅ set 3 favorites → onboarded
✅ for-you runs all 5 algorithms
✅ want-to-read book excluded from For You
✅ /me returns shelves
All checks passed
```

### 5.2 Verification Script for M1 Endpoints
Create and execute a standalone Node.js test script targeting the newly created endpoints:
```bash
node -e "
import { connect } from './server/src/db.js';
// verify DB connection and models compile cleanly
await connect();
console.log('MongoDB connected successfully');
process.exit(0);
"
```

### 5.3 Invalidation Conditions
The implementation is INVALID if:
- `npm run smoke` exits with a non-zero code or fails on line 70 (`me.body.favorites.length === 3 && me.body.wantToRead.length === 1`).
- Setting a shelf to `'currently_reading'` via `PUT /api/me/shelf/:isbn` leaves the book in `wantToRead` or `read`.
- Submitting a review with rating 6 does not return HTTP 400.
- User A can delete User B's review via `DELETE /api/reviews/:id`.
- `POST /api/me/reset-books` deletes any documents from `Review`.
- `DELETE /api/me/reviews` modifies any array in `User`.
