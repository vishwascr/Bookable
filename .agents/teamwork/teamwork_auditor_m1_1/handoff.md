# Forensic Audit Report: Milestone 1 Implementation

**Work Product**: Milestone 1 Implementation (Models, Shelves, Reviews, Auth, Settings)  
**Profile**: General Project (Demo Integrity Mode)  
**Verdict**: **CLEAN**

---

## 1. Observation

Direct empirical inspection and verification of the Milestone 1 codebase and runtime behavior yielded the following verbatim observations:

### 1.1 Prohibited Pattern & Source Code Analysis
- **Hardcoded Test Results Check**:
  - Command: `grep -rnE "(63 passed|All checks passed|testreader|settingsuser)" server/src/`
  - Output:
    ```
    server/src/scripts/smoke.js:72:console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
    server/src/scripts/test-m1.js:38:  username: 'testreader',
    server/src/scripts/test-m1.js:250:  username: 'settingsuser',
    ```
  - Observation: Zero production source files (`User.js`, `Review.js`, `reviews.js`, `users.js`, `auth.js`, `index.js`) contain hardcoded test returns or stub values.

- **Pre-populated Artifact Detection**:
  - Command: `find . -name '*.log' -o -name '*result*' -o -name '*output*'`
  - Output: Only node_modules internal files (`mongodb`, `postcss`). Zero fabricated test output artifacts exist in the repository.

- **Dependency & Code Borrowing Audit**:
  - Direct inspection of `server/package.json`:
    - Dependencies: `bcryptjs` (password hashing), `cors` (HTTP CORS), `csv-parse` (CSV ingestion), `dotenv` (env vars), `express` (HTTP routing), `jsonwebtoken` (JWT creation/verification), `mongoose` (MongoDB ODM).
    - No external or third-party libraries implement the target Goodreads parity deliverable, reviews system, or shelf state machines.

### 1.2 Data Model Schema & Index Authenticity
- **`server/src/models/User.js`**:
  - Contains genuine Mongoose schema definitions:
    - `currentlyReading: { type: [String], default: [] }` (lines 10)
    - `read: { type: [String], default: [] }` (line 11)
  - `toPublic()` method (lines 20–32) genuinely maps `currentlyReading` and `read`, preserves `favorites` and `wantToRead`, and omits `passwordHash`:
    ```javascript
    pub keys: [
      'id', 'username', 'displayName', 'favorites',
      'wantToRead', 'currentlyReading', 'read', 'onboarded', 'createdAt'
    ]
    has passwordHash: false undefined
    ```

- **`server/src/models/Review.js`**:
  - Contains genuine Mongoose schema definitions:
    - `userId`: `ObjectId` referencing `User`, `required: true`, `index: true` (lines 5–10)
    - `isbn`: `String`, `required: true`, `index: true` (lines 21–26)
    - `rating`: `Number`, `required: true`, `min: 1`, `max: 5`, with custom validator `Number.isInteger` (lines 27–36)
    - `text`: `String`, `default: ''`, `trim: true`, `maxlength: 5000` (lines 37–42)
    - `sentiment`: subdocument `{ score, label, keywords }` (lines 43–57)
  - Verified Schema Validators:
    ```
    rating instance: Number
    rating required: true
    rating min: 1
    rating max: 5
    validator: min -> test 0: false, test 5: true
    validator: max -> test 6: false, test 5: true
    validator: user defined -> test 4.5: false, test 5: true
    text maxlength: 5000
    ```
  - Verified Schema Indexes:
    ```json
    [
      [{"userId": 1}, {}],
      [{"isbn": 1}, {}],
      [{"userId": 1, "isbn": 1}, {"unique": true}],
      [{"isbn": 1, "createdAt": -1}, {}],
      [{"userId": 1, "createdAt": -1}, {}]
    ]
    ```

### 1.3 Route Logic & IDOR Protection Verification
- **`DELETE /api/reviews/:id` (IDOR Enforcement)**:
  - Source lines 150–165 in `server/src/routes/reviews.js`:
    ```javascript
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid review ID' });
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (String(review.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'You do not have permission to delete this review' });
    }
    await Review.findByIdAndDelete(id);
    res.status(204).end();
    ```
  - Empirical probe results:
    - User B attempting to delete User A's review: `HTTP 403 { error: 'You do not have permission to delete this review' }`.
    - User A deleting own review: `HTTP 204 No Content`, `Review.findByIdAndDelete` invoked with matching id.
    - Non-existent review: `HTTP 404 Not Found`.
    - Malformed ObjectId: `HTTP 400 Bad Request`.

- **`PUT /api/me/shelf/:isbn` (Mutual Exclusivity Enforcement)**:
  - Source lines 163–176 in `server/src/routes/users.js`:
    ```javascript
    req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
    req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
    req.user.read = req.user.read.filter((i) => i !== isbn);
    if (status === 'want_to_read') req.user.wantToRead.unshift(isbn);
    else if (status === 'currently_reading') req.user.currentlyReading.unshift(isbn);
    else if (status === 'read') req.user.read.unshift(isbn);
    await req.user.save();
    ```
  - Empirical probe results:
    - Moving book to `currently_reading`: `wantToRead: []`, `currentlyReading: ['0441172660']`, `read: []`, `favorites: ['0345339681']`.
    - Moving book to `read`: `wantToRead: []`, `currentlyReading: []`, `read: ['0441172660']`.
    - Moving book to `none`: `wantToRead: []`, `currentlyReading: []`, `read: []`, `favorites: ['0345339681']`.

- **`POST /api/books/:isbn/reviews` (Validation & Auto-Shelving)**:
  - Source lines 70–78, 107–114 in `server/src/routes/reviews.js`:
    - Validates `Number.isInteger(rating) && rating >= 1 && rating <= 5`.
    - Validates `text.length <= 5000`.
    - Calls `Review.findOneAndUpdate({ userId: req.user._id, isbn }, { $set: ... }, { new: true, upsert: true })`.
    - Transitions user shelf to `read` (removes from `wantToRead` and `currentlyReading`).
  - Empirical probe results:
    - Rating 3.5: HTTP 400.
    - Rating 6: HTTP 400.
    - Rating 0: HTTP 400.
    - Text > 5000 chars: HTTP 400.
    - Valid review: HTTP 201 Created, `user.wantToRead` removed, `user.read` contains ISBN, `user.save()` called.

- **`POST /api/me/reset-books` & `DELETE /api/me/reviews` (Settings Isolation)**:
  - `POST /api/me/reset-books`: resets `wantToRead = []`, `currentlyReading = []`, `read = []`, `favorites = []`, calls `user.save()`, leaves `Review` collection completely untouched.
  - `DELETE /api/me/reviews`: executes `Review.deleteMany({ userId: req.userId })`, leaves user reading shelves completely untouched.

### 1.4 Test Suite Execution
- Command: `cd /Users/admin/Documents/Bookable/server && npm test`
- Verbatim result:
  ```
  === Milestone 1: Automated Verification Test ===
  ...
  =============================================
  Milestone 1 Test Results: 63 passed, 0 failed
  =============================================
  ```

---

## 2. Logic Chain

1. **Cheating / Facade Analysis**:
   - *Observation*: Inspected all code changes in `server/src/models/`, `server/src/routes/`, `server/src/auth.js`, and `server/src/index.js`.
   - *Logic*: Genuine Mongoose methods (`find`, `findOne`, `findById`, `findOneAndUpdate`, `findByIdAndDelete`, `deleteMany`, `save`) and real conditional statements are present and wired. No dummy stub returns or hardcoded PASS strings exist.
   - *Conclusion*: Zero facade implementations.

2. **Database Integrity & Schema Validation**:
   - *Observation*: Direct inspection of Mongoose schema types, paths, validators, and compound indexes on `Review` and `User`.
   - *Logic*: Mongoose enforces schema validation both programmatically via schema validators and through query construction. The unique compound index `{ userId: 1, isbn: 1 }` prevents duplicate reviews per user per book.
   - *Conclusion*: Models and schemas are genuine and enforce data integrity.

3. **Security & Data Isolation**:
   - *Observation*: Tested IDOR vulnerability vector with mismatched user IDs against `DELETE /api/reviews/:id`. Tested `DELETE /api/me/reviews` with isolated user IDs.
   - *Logic*: `DELETE /api/reviews/:id` strictly checks `String(review.userId) !== String(req.userId)` and halts with HTTP 403 Forbidden. `DELETE /api/me/reviews` restricts deletion scope to `{ userId: req.userId }`.
   - *Conclusion*: Data isolation and IDOR protection are genuinely enforced in code.

4. **Input Validation Rigor**:
   - *Observation*: Tested boundary values for ratings (0, 3.5, 5, 6) and review text (0, 5000, 5001 chars).
   - *Logic*: Both route handler pre-validation and Mongoose schema post-validation reject non-integer ratings, ratings out of [1, 5], and strings exceeding 5000 characters.
   - *Conclusion*: Rating and length validations are authentic and dual-layered.

5. **Mutual Exclusivity State Transitions**:
   - *Observation*: Traced ISBN state through sequential transitions in `PUT /api/me/shelf/:isbn` and `POST /api/books/:isbn/reviews`.
   - *Logic*: Every status change filters the ISBN from all reading status arrays before appending to the destination array. Favorites is never cleared during reading status updates.
   - *Conclusion*: Reading shelf mutual exclusivity is strictly maintained.

---

## 3. Caveats

- In the current macOS sandbox environment, cross-process TCP socket connections to loopback ports (`127.0.0.1:5050` and `127.0.0.1:27017`) return `EPERM`. Consequently, automated verification in `server/src/scripts/test-m1.js` was executed in-process against Mongoose schemas, router middlewares, and validation handlers. To ensure thoroughness, the forensic auditor performed independent empirical probes on the actual route handlers using mock model hooks. All probes confirmed 100% genuine handler execution.

---

## 4. Conclusion

**Verdict: CLEAN.**  
Milestone 1 satisfies all integrity criteria:
- No hardcoded test passes or fabricated outputs.
- No facade or dummy implementations.
- Authentic Mongoose schemas with genuine validators and unique compound indexes.
- Authentic database queries (`findOneAndUpdate`, `findByIdAndDelete`, `deleteMany`, `find`).
- Strict IDOR protection and multi-user data isolation.
- Rigorous mutual exclusivity across reading shelves.
- Strict rating (integer 1–5) and review text (<= 5000 chars) validation.

The work product is approved without integrity violations.

---

## 5. Verification Method

To independently verify this audit:

1. **Verify Source Code Cleanliness**:
   ```bash
   grep -rnE "(63 passed|All checks passed)" server/src/models/ server/src/routes/ server/src/auth.js
   ```
   *Expected: Zero matches.*

2. **Verify Schema Validators and Indexes**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node -e '
   import Review from "./src/models/Review.js";
   console.log(Review.schema.indexes());
   '
   ```
   *Expected: Compound index `[{"userId":1,"isbn":1},{"unique":true}]` appears in output.*

3. **Run Automated Test Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && npm test
   ```
   *Expected: `Milestone 1 Test Results: 63 passed, 0 failed`.*

4. **Invalidation Conditions**:
   - If `DELETE /api/reviews/:id` permits User B to delete User A's review, verdict is invalidated.
   - If `PUT /api/me/shelf/:isbn` permits a book to be simultaneously in `wantToRead` and `currentlyReading`, verdict is invalidated.
   - If `Review.schema` accepts float ratings (e.g., 3.5), verdict is invalidated.
   - If `Review.schema` permits text exceeding 5000 characters, verdict is invalidated.
