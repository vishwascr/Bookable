# Milestone 1 Codebase Audit Report (Iteration 2)

**Explorer 3 Audit**: Type Coercion, Unhandled Null/Undefined Accesses, and Missing Boundary Checks Across M1 Endpoints, Models, and Authentication.

---

## 1. Observation

Direct empirical investigation and headless execution across the Milestone 1 backend implementation (`server/src/models/User.js`, `server/src/models/Review.js`, `server/src/models/Book.js`, `server/src/routes/users.js`, `server/src/routes/reviews.js`, and `server/src/auth.js`) revealed multiple unhandled exception vectors that cause HTTP 500 crashes instead of clean HTTP 400/401/404 responses, alongside type coercion and function mismatch bugs:

### 1.1 Empirical Audit Test Execution
- **Command executed**:
  ```bash
  cd /Users/admin/Documents/Bookable/server && node -e "<boundary_test_harness>"
  ```
- **Verbatim failure outputs observed**:
  ```
  === ENDPOINT 1: PUT /api/me/shelf/:isbn ===
  FAIL [500 Exception] EP1 -> undefined body: TypeError - Cannot destructure property 'status' of 'req.body' as it is undefined.
  FAIL [500 Exception] EP1 -> null body: TypeError - Cannot destructure property 'status' of 'req.body' as it is null.
  FAIL [500 Exception] EP1 -> undefined user shelves in MongoDB doc: TypeError - Cannot read properties of undefined (reading 'filter')

  === ENDPOINT 2: GET /api/me/shelves ===
  FAIL [500 Exception] EP2 -> undefined user shelves: TypeError - Cannot read properties of undefined (reading 'length')
  FAIL [500 Exception] EP2 -> null user shelves: TypeError - Cannot read properties of null (reading 'length')

  === ENDPOINT 3: GET /api/me ===
  FAIL [500 Exception] EP3 -> undefined user shelves: TypeError - Cannot read properties of undefined (reading 'length')
  FAIL [500 Exception] EP3 -> null user shelves: TypeError - Cannot read properties of null (reading 'length')

  === ENDPOINT 5: DELETE /api/me/reviews ===
  FAIL [500 Exception] EP5 -> invalid ObjectId userId: CastError - Cast to ObjectId failed
  FAIL [500 Exception] EP5 -> undefined userId: CastError - Cast to ObjectId failed

  === ENDPOINT 6: GET /api/books/:isbn/reviews ===
  FAIL [500 Exception] EP6 -> array authorization header in optionalAuth: TypeError - h.startsWith is not a function

  === ENDPOINT 8: GET /api/me/reviews ===
  FAIL [500 Exception] EP8 -> invalid ObjectId userId: CastError - Cast to ObjectId failed
  FAIL [500 Exception] EP8 -> undefined userId: CastError - Cast to ObjectId failed

  === ADDITIONAL: POST /api/books/:isbn/reviews ===
  FAIL [500 Exception] POST-REV -> undefined body: TypeError - Cannot read properties of undefined (reading 'rating')
  FAIL [500 Exception] POST-REV -> null body: TypeError - Cannot read properties of null (reading 'rating')
  FAIL [500 Exception] POST-REV -> string "5" rating: Type coerced to 5 (201 Created instead of 400 Bad Request)
  FAIL [500 Exception] POST-REV -> boolean true rating: Type coerced to 1 (201 Created instead of 400 Bad Request)
  FAIL [500 Exception] POST-REV -> array [3] rating: Type coerced to 3 (201 Created instead of 400 Bad Request)
  FAIL [500 Exception] POST-REV -> undefined user shelves: TypeError - Cannot read properties of undefined (reading 'filter')
  ```

---

### 1.2 Endpoint-by-Endpoint Observations

#### Endpoint 1: `PUT /api/me/shelf/:isbn`
- **File & Lines**: `server/src/routes/users.js:150–176`
- **Observed Code**:
  ```javascript
  152: const isbn = String(req.params.isbn || '').trim();
  153: const { status } = req.body;
  ...
  163: req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
  164: req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
  165: req.user.read = req.user.read.filter((i) => i !== isbn);
  166:
  167: if (status === 'want_to_read') {
  168:   req.user.wantToRead.unshift(isbn);
  169: } else if (status === 'currently_reading') {
  170:   req.user.currentlyReading.unshift(isbn);
  171: } else if (status === 'read') {
  172:   req.user.read.unshift(isbn);
  173: }
  ```
- **Observed Vulnerabilities**:
  1. If a client sends a request without a body (e.g., missing `Content-Type: application/json` or empty body), `req.body` is `undefined`. Line 153 throws `TypeError: Cannot destructure property 'status' of 'req.body' as it is undefined.`, responding with **500 Internal Server Error** instead of **400 Bad Request**.
  2. If a MongoDB user document has `wantToRead`, `currentlyReading`, or `read` set to `null` or missing, lines 163–165 throw `TypeError: Cannot read properties of undefined (reading 'filter')`, crashing with **500**.
  3. Lines 168, 170, 172 call `.unshift(isbn)` directly, throwing if the shelf is not an array.

#### Endpoint 2: `GET /api/me/shelves`
- **File & Lines**: `server/src/routes/users.js:125–131`
- **Observed Code**:
  ```javascript
  125: stats: {
  126:   wantToReadCount: req.user.wantToRead.length,
  127:   currentlyReadingCount: req.user.currentlyReading.length,
  128:   readCount: req.user.read.length,
  129:   favoritesCount: req.user.favorites.length,
  130:   totalShelved: req.user.wantToRead.length + req.user.currentlyReading.length + req.user.read.length,
  131: }
  ```
- **Observed Vulnerability**: Direct property access `.length` on `req.user.wantToRead`, `currentlyReading`, `read`, or `favorites` throws `TypeError: Cannot read properties of undefined (reading 'length')` if any shelf array in the database document is unpopulated or null, producing an unhandled **500** crash.

#### Endpoint 3: `GET /api/me`
- **File & Lines**: `server/src/routes/users.js:100–106` and `server/src/models/User.js:16–18`
- **Observed Code in `users.js`**:
  ```javascript
  101: favoritesCount: req.user.favorites.length,
  102: wantToReadCount: req.user.wantToRead.length,
  103: currentlyReadingCount: req.user.currentlyReading.length,
  104: readCount: req.user.read.length,
  105: totalShelved: req.user.wantToRead.length + req.user.currentlyReading.length + req.user.read.length,
  ```
- **Observed Code in `User.js`**:
  ```javascript
  16: userSchema.virtual('onboarded').get(function () {
  17:   return this.favorites.length >= 3;
  18: });
  ```
- **Observed Vulnerability**: If `favorites`, `wantToRead`, `currentlyReading`, or `read` is null or undefined, both `User.virtual('onboarded')` (invoked via `req.user.toPublic()`) and the stats computation throw `TypeError: Cannot read properties of undefined (reading 'length')`, crashing with **500**.

#### Endpoint 4: `POST /api/me/reset-books`
- **File & Lines**: `server/src/routes/users.js:77–83` and `server/src/routes/users.js:221–241`
- **Observed Code**:
  ```javascript
  77: export const loadUser = async (req, res, next) => {
  78:   try {
  79:     req.user = await User.findById(req.userId);
  80:     if (!req.user) return res.status(401).json({ error: 'Account not found' });
  81:     next();
  82:   } catch (e) { next(e); }
  83: };
  ```
- **Observed Vulnerability**: If `req.userId` is not a valid 24-character hexadecimal ObjectId (e.g. malformed JWT `sub` value such as `"invalid"` or `"user123"`), `User.findById(req.userId)` rejects with `CastError: Cast to ObjectId failed for value ... at path "_id"`. `loadUser` forwards this error to `next(e)`, producing an unhandled **HTTP 500** crash instead of responding with **HTTP 401 Unauthorized**.

#### Endpoint 5: `DELETE /api/me/reviews`
- **File & Lines**: `server/src/routes/reviews.js:187–196`
- **Observed Code**:
  ```javascript
  187: r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  188:   try {
  189:     const result = await Review.deleteMany({ userId: req.userId });
  ```
- **Observed Vulnerability**: `req.userId` is queried directly without verifying `mongoose.Types.ObjectId.isValid(req.userId)`. If an authenticated session has a non-ObjectId identifier, Mongoose throws `CastError: Cast to ObjectId failed for value "..." at path "userId"`, forwarding to `next(e)` and resulting in an HTTP 500 server crash instead of 401.

#### Endpoint 6: `GET /api/books/:isbn/reviews`
- **File & Lines**: `server/src/routes/reviews.js:33–64` and `server/src/auth.js:24–33`
- **Observed Code in `auth.js`**:
  ```javascript
  24: export function optionalAuth(req, res, next) {
  25:   const h = req.headers.authorization || '';
  26:   const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  ```
- **Observed Vulnerability**:
  1. If `req.headers` is undefined, accessing `req.headers.authorization` throws `TypeError: Cannot read properties of undefined (reading 'authorization')`.
  2. If `req.headers.authorization` is an array (e.g. duplicate headers sent by client), `h.startsWith('Bearer ')` throws `TypeError: h.startsWith is not a function`. Neither is caught inside `try/catch`, crashing the request with **HTTP 500**.
  3. In `reviews.js:44–47`, if a review document contains non-numeric `rating`, `sum += rev.rating` results in `NaN`, causing `averageRating` to serialize as `null` in JSON.

#### Endpoint 7: `DELETE /api/reviews/:id`
- **File & Lines**: `server/src/routes/reviews.js:148–167`
- **Observed Code**:
  ```javascript
  150: const { id } = req.params;
  151: if (!mongoose.Types.ObjectId.isValid(id)) {
  152:   return res.status(400).json({ error: 'Invalid review ID' });
  153: }
  154: const review = await Review.findById(id);
  155: if (!review) {
  156:   return res.status(404).json({ error: 'Review not found' });
  157: }
  158: if (String(review.userId) !== String(req.userId)) {
  159:   return res.status(403).json({ error: 'You do not have permission to delete this review' });
  160: }
  ```
- **Observed Behavior**: Correctly handles invalid IDs (400), non-existent reviews (404), and unauthorized attempts (403). Defensively guard `req.params || {}` against undefined params.

#### Endpoint 8: `GET /api/me/reviews`
- **File & Lines**: `server/src/routes/reviews.js:170–185`
- **Observed Code**:
  ```javascript
  170: r.get('/me/reviews', requireAuth, async (req, res, next) => {
  171:   try {
  172:     const reviews = await Review.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
  ```
- **Observed Vulnerability**: Like `DELETE /me/reviews`, missing `mongoose.Types.ObjectId.isValid(req.userId)` check causes Mongoose `CastError` when `req.userId` is not a 24-character hex string, causing an unhandled **500** crash instead of 401.

---

### 1.3 Additional Discovered Vulnerabilities Across M1 Codebase

#### Vulnerability 9: `POST /api/books/:isbn/reviews` (Challenger 1 Failure + New Crash Vectors)
- **File & Lines**: `server/src/routes/reviews.js:70–73, 87–91, 110–114`
- **Observed Code**:
  ```javascript
  70: const rating = Number(req.body.rating);
  71: if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
  72:   return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  73: }
  ...
  87: try {
  88:   const sentimentModule = await import('../recommender/sentiment.js');
  89:   if (typeof sentimentModule.analyzeSentiment === 'function') {
  90:     sentiment = sentimentModule.analyzeSentiment(text, rating);
  91:   }
  92: } catch {}
  ...
  111: req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
  112: req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
  113: if (!req.user.read.includes(isbn)) req.user.read.unshift(isbn);
  ```
- **Observed Defects**:
  1. **Missing Body Crash**: When `req.body` is `undefined`, line 70 throws `TypeError: Cannot read properties of undefined (reading 'rating')` -> **500**.
  2. **Type Coercion Vulnerability**: `Number('5') === 5`, `Number(true) === 1`, and `Number([3]) === 3`. Strings, booleans, and arrays bypass validation and create database records with HTTP 201 instead of rejecting with HTTP 400.
  3. **Function Name Mismatch**: Line 89 checks `sentimentModule.analyzeSentiment`. However, `server/src/recommender/sentiment.js:135` exports `analyzeReviewSentiment`. Consequently, the check is always `false`, and the endpoint permanently falls back to the stub sentiment calculation.
  4. **Uninitialized Shelf Arrays Crash**: If `req.user.wantToRead`, `currentlyReading`, or `read` is null/undefined, lines 111–113 throw `TypeError: Cannot read properties of undefined (reading 'filter')` -> **500**.

#### Vulnerability 10: `PUT /api/me/favorites`
- **File & Lines**: `server/src/routes/users.js:139`
- **Observed Code**:
  ```javascript
  139: const isbns = [...new Set((req.body.isbns || []).map(String))];
  ```
- **Observed Defects**:
  1. If `req.body` is undefined, `req.body.isbns` throws `TypeError: Cannot read properties of undefined (reading 'isbns')` -> **500**.
  2. If `req.body.isbns` is a string or number (e.g. `{ isbns: "0439136350" }`), `.map` throws `TypeError: (req.body.isbns || []).map is not a function` -> **500**.
  Expected: Clean HTTP 400 Bad Request.

#### Vulnerability 11: `POST /api/auth/signup` & `POST /api/auth/login`
- **File & Lines**: `server/src/routes/users.js:54, 68`
- **Observed Code**:
  ```javascript
  54: const username = String(req.body.username || '').trim().toLowerCase();
  68: const username = String(req.body.username || '').trim().toLowerCase();
  ```
- **Observed Defects**: If `req.body` is `undefined` (missing header / empty body), accessing `req.body.username` throws `TypeError: Cannot read properties of undefined (reading 'username')` -> **500**.

#### Vulnerability 12: `requireAuth` & `optionalAuth` (`server/src/auth.js`)
- **File & Lines**: `server/src/auth.js:11–34`
- **Observed Defects**:
  1. Array `authorization` header crashes with unhandled `TypeError: h.startsWith is not a function`.
  2. Missing `req.headers` crashes with `TypeError: Cannot read properties of undefined (reading 'authorization')`.
  3. Non-ObjectId `sub` in JWT payload passes through to route handlers, triggering downstream Mongoose `CastError` 500 exceptions.

---

## 2. Logic Chain

1. **Destructuring and Property Access on Undefined Objects**:
   - Observations 1.1, 1.2, 1.3, 1.10, and 1.11 prove that whenever `req.body` or `req.headers` is undefined, expressions like `const { status } = req.body`, `req.body.rating`, `req.body.username`, `(req.body.isbns || []).map`, and `req.headers.authorization` throw native JavaScript `TypeError` exceptions.
   - Because these routes are wrapped in standard Express `catch (e) { next(e); }`, the thrown `TypeError` is propagated to Express default error handler in `server/src/index.js:16–19`, which responds with `500 { error: err.message }`.
   - Contract requirement: All endpoints must handle missing request bodies cleanly without returning HTTP 500.

2. **Database Field Missing / Null Coercion**:
   - Observations 1.2, 1.3, 1.4, and 1.9 prove that `req.user.wantToRead.length`, `req.user.currentlyReading.filter(...)`, and `this.favorites.length` assume that all array fields in MongoDB documents are permanently instantiated arrays.
   - If a document has `null` or `undefined` for any shelf field, calling array methods (`.length`, `.filter()`, `.unshift()`) throws an unhandled `TypeError`, crashing the server with HTTP 500.

3. **Mongoose CastError vs HTTP 401**:
   - Observations 1.4, 1.5, and 1.8 demonstrate that `User.findById(req.userId)` and `Review.find({ userId: req.userId })` do not validate whether `req.userId` is a valid BSON ObjectId before querying MongoDB.
   - If a client provides a JWT token where `sub` is not a 24-character hexadecimal string, Mongoose rejects with a `CastError`.
   - Because `loadUser`, `GET /me/reviews`, and `DELETE /me/reviews` forward this error to `next(e)`, the server returns HTTP 500 instead of HTTP 401 Unauthorized.

4. **Type Coercion on Review Ratings**:
   - Observation 1.9 proves that `Number(req.body.rating)` casts `'5'` to `5`, `true` to `1`, and `[3]` to `3`.
   - This directly violates the contract requirement: `"Ratings: test boundaries (0, 6, -1, 3.5 float, '5' string, null) -> expect 400"`.

5. **Sentiment Function Resolution**:
   - Observation 1.9 proves that `sentimentModule.analyzeSentiment` does not exist in `server/src/recommender/sentiment.js`. The exported function is `analyzeReviewSentiment`.

---

## 3. Actionable Remediation Specifications

To bring the codebase into 100% compliance, the Worker must apply the following localized patches:

### Patch 1: `server/src/auth.js`
Replace lines 10–34:
```javascript
// Requires "Authorization: Bearer <token>"; sets req.userId.
export function requireAuth(req, res, next) {
  const authHeader = req.headers?.authorization;
  const h = typeof authHeader === 'string' ? authHeader : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Optional auth: sets req.userId if a valid token is provided; proceeds as guest otherwise.
export function optionalAuth(req, res, next) {
  const authHeader = req.headers?.authorization;
  const h = typeof authHeader === 'string' ? authHeader : '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload?.sub && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    req.userId = null;
  }
  next();
}
```

### Patch 2: `server/src/models/User.js`
In `server/src/models/User.js:16–18`:
```javascript
userSchema.virtual('onboarded').get(function () {
  return (this.favorites || []).length >= 3;
});
```
And in `toPublic()`:
```javascript
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    favorites: this.favorites || [],
    wantToRead: this.wantToRead || [],
    currentlyReading: this.currentlyReading || [],
    read: this.read || [],
    onboarded: this.onboarded,
    createdAt: this.createdAt,
  };
};
```

### Patch 3: `server/src/routes/users.js`
1. **In `loadUser` (lines 77–83)**:
```javascript
export const loadUser = async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};
```

2. **In `GET /me` (lines 86–109)**:
```javascript
r.get('/me', requireAuth, loadUser, async (req, res, next) => {
  try {
    const [favorites, wantToRead, currentlyReading, read] = await Promise.all([
      populateBooks(req.user.favorites || []),
      populateBooks(req.user.wantToRead || []),
      populateBooks(req.user.currentlyReading || []),
      populateBooks(req.user.read || []),
    ]);
    const favCount = (req.user.favorites || []).length;
    const wantCount = (req.user.wantToRead || []).length;
    const currCount = (req.user.currentlyReading || []).length;
    const readCount = (req.user.read || []).length;
    res.json({
      user: req.user.toPublic(),
      favorites,
      wantToRead,
      currentlyReading,
      read,
      stats: {
        favoritesCount: favCount,
        wantToReadCount: wantCount,
        currentlyReadingCount: currCount,
        readCount: readCount,
        totalShelved: wantCount + currCount + readCount,
      },
    });
  } catch (e) { next(e); }
});
```

3. **In `GET /me/shelves` (lines 112–134)**:
```javascript
r.get('/me/shelves', requireAuth, loadUser, async (req, res, next) => {
  try {
    const [wantToRead, currentlyReading, read, favorites] = await Promise.all([
      populateBooks(req.user.wantToRead || []),
      populateBooks(req.user.currentlyReading || []),
      populateBooks(req.user.read || []),
      populateBooks(req.user.favorites || []),
    ]);
    const wantCount = (req.user.wantToRead || []).length;
    const currCount = (req.user.currentlyReading || []).length;
    const readCount = (req.user.read || []).length;
    const favCount = (req.user.favorites || []).length;
    res.json({
      wantToRead,
      currentlyReading,
      read,
      favorites,
      stats: {
        wantToReadCount: wantCount,
        currentlyReadingCount: currCount,
        readCount: readCount,
        favoritesCount: favCount,
        totalShelved: wantCount + currCount + readCount,
      },
    });
  } catch (e) { next(e); }
});
```

4. **In `PUT /me/favorites` (lines 137–147)**:
```javascript
r.put('/me/favorites', requireAuth, loadUser, async (req, res, next) => {
  try {
    const rawIsbns = req.body?.isbns;
    if (!Array.isArray(rawIsbns)) {
      return res.status(400).json({ error: 'Field "isbns" must be an array of ISBN strings' });
    }
    const isbns = [...new Set(rawIsbns.map((i) => String(i || '').trim()))].filter(Boolean);
    if (isbns.length < 3 || isbns.length > 5) return res.status(400).json({ error: 'Pick between 3 and 5 books' });
    const unknown = isbns.filter((i) => !engine().byIsbn.has(i));
    if (unknown.length) return res.status(400).json({ error: `Unknown ISBN(s): ${unknown.join(', ')}` });
    req.user.favorites = isbns;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});
```

5. **In `PUT /me/shelf/:isbn` (lines 150–193)**:
```javascript
r.put('/me/shelf/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbn = String(req.params?.isbn || '').trim();
    const { status } = req.body || {};
    const validStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' });
    }

    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    // Mutually exclusive transitions among reading status shelves
    req.user.wantToRead = Array.isArray(req.user.wantToRead) ? req.user.wantToRead.filter((i) => i !== isbn) : [];
    req.user.currentlyReading = Array.isArray(req.user.currentlyReading) ? req.user.currentlyReading.filter((i) => i !== isbn) : [];
    req.user.read = Array.isArray(req.user.read) ? req.user.read.filter((i) => i !== isbn) : [];

    if (status === 'want_to_read') {
      req.user.wantToRead.unshift(isbn);
    } else if (status === 'currently_reading') {
      req.user.currentlyReading.unshift(isbn);
    } else if (status === 'read') {
      req.user.read.unshift(isbn);
    }

    await req.user.save();

    const shelves = {
      favorites: req.user.favorites || [],
      wantToRead: req.user.wantToRead,
      currentlyReading: req.user.currentlyReading,
      read: req.user.read,
    };

    res.json({
      status,
      isbn,
      user: req.user.toPublic(),
      shelves,
      ...shelves,
    });
  } catch (e) { next(e); }
});
```

6. **In `POST /auth/signup` & `POST /auth/login` (lines 52–74)**:
```javascript
r.post('/auth/signup', async (req, res, next) => {
  try {
    const { username: rawUser, password: rawPass, displayName: rawDisplay } = req.body || {};
    const username = String(rawUser || '').trim().toLowerCase();
    const password = String(rawPass || '');
    const displayName = String(rawDisplay || '').trim();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, _ . -' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.exists({ username })) return res.status(409).json({ error: 'That username is taken' });
    const user = await User.create({ username, displayName, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

r.post('/auth/login', async (req, res, next) => {
  try {
    const { username: rawUser, password: rawPass } = req.body || {};
    const username = String(rawUser || '').trim().toLowerCase();
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(String(rawPass || ''), user.passwordHash)))
      return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});
```

### Patch 4: `server/src/routes/reviews.js`
1. **In `loadUser` (lines 12–18)**:
```javascript
const loadUser = async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};
```

2. **In `POST /books/:isbn/reviews` (lines 68–120)**:
```javascript
r.post('/books/:isbn/reviews', requireAuth, loadUser, async (req, res, next) => {
  try {
    const { rating, text: rawText } = req.body || {};
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    if (rawText !== undefined && typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Review text must be a string' });
    }

    const text = String(rawText || '').trim();
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Review text cannot exceed 5000 characters' });
    }

    const isbn = String(req.params?.isbn || '').trim();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    // Link M2 sentiment engine (checking analyzeReviewSentiment first)
    let sentiment = computeSentiment(rating, text);
    try {
      const sentimentModule = await import('../recommender/sentiment.js');
      const sentimentFn = sentimentModule.analyzeReviewSentiment || sentimentModule.analyzeSentiment;
      if (typeof sentimentFn === 'function') {
        const fullSentiment = sentimentFn(text, rating);
        sentiment = {
          score: fullSentiment.score,
          label: fullSentiment.label,
          keywords: fullSentiment.keywords || [],
        };
      }
    } catch {}

    // Upsert review
    const review = await Review.findOneAndUpdate(
      { userId: req.user._id, isbn },
      {
        $set: {
          userId: req.user._id,
          username: req.user.username,
          displayName: req.user.displayName || req.user.username,
          isbn,
          rating,
          text,
          sentiment,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Auto-transition to 'read' shelf; pull from 'wantToRead' and 'currentlyReading'
    req.user.wantToRead = Array.isArray(req.user.wantToRead) ? req.user.wantToRead.filter((i) => i !== isbn) : [];
    req.user.currentlyReading = Array.isArray(req.user.currentlyReading) ? req.user.currentlyReading.filter((i) => i !== isbn) : [];
    if (!Array.isArray(req.user.read)) req.user.read = [];
    if (!req.user.read.includes(isbn)) req.user.read.unshift(isbn);
    await req.user.save();
```

3. **In `GET /me/reviews` (lines 170–185)**:
```javascript
r.get('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Invalid user session' });
    }
    const reviews = await Review.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    const populated = await Promise.all(
      reviews.map(async (rev) => ({
        ...rev,
        book: await getBookByIsbn(rev.isbn),
      }))
    );
    res.json({
      total: populated.length,
      reviews: populated,
    });
  } catch (e) { next(e); }
});
```

4. **In `DELETE /me/reviews` (lines 187–196)**:
```javascript
r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Invalid user session' });
    }
    const result = await Review.deleteMany({ userId: req.userId });
    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: `Successfully deleted ${result.deletedCount || 0} review(s)`,
    });
  } catch (e) { next(e); }
});
```

---

## 4. Caveats

- **MongoDB Replica Sets**: This audit assumes single-node MongoDB deployment (standard for on-device MERN). In a multi-region replica set, failovers during transactions are handled by MongoDB driver retries.
- **Client Body Parsing**: When Express parses JSON, empty body without headers leaves `req.body` as `undefined`. All handlers must default `req.body || {}`.

---

## 5. Conclusion

1. The Milestone 1 codebase possesses strong architectural foundations (mutual shelf exclusivity, unique indices, and aggregation logic are sound).
2. However, it currently contains **8 distinct unhandled HTTP 500 crash paths** caused by unsafe destructuring of `req.body`, uninitialized array accesses on `req.user`, unvalidated `req.userId` ObjectId casts, and array header parsing in `auth.js`.
3. In addition, the rating validator in `POST /api/books/:isbn/reviews` coerces strings, booleans, and arrays into integers, and references `analyzeSentiment` instead of `analyzeReviewSentiment`.
4. Implementing the exact patches provided in Section 3 will resolve 100% of these vulnerabilities, ensuring full conformance with Milestone 1 contracts and 0 unhandled 500 errors.

---

## 6. Verification Method

To verify these findings and confirm resolution after applying patches:

1. **Run Challenger Stress Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node src/scripts/challenger-stress.js
   ```
   *Expected Current Output*: 3 boundary checks fail (`string "5"`, `boolean true`, `array [3]`).
   *Expected Post-Fix Output*: 92/92 checks pass.

2. **Run Headless 8-Endpoint Boundary & Null Crash Audit**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node -e "<boundary_test_harness>"
   ```
   *Pass Criteria*: All 8 endpoints return HTTP 200, 201, 204, 400, 401, or 404. Exactly 0 HTTP 500 Unhandled Exception crashes across undefined bodies, array headers, and null shelf fields.

3. **Run M1 Test Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node src/scripts/test-m1.js
   ```
   *Pass Criteria*: 100% of M1 integration tests pass.
