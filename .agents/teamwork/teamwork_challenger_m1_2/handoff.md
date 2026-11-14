# Milestone 1 Challenger 2 Empirical Handoff Report: Multi-User Isolation, IDOR & Settings Independence

## 1. Observation

### 1.1 Codebase Inspection
Direct inspection of the implementation files at `/Users/admin/Documents/Bookable` revealed the following exact mechanics:

- **`server/src/routes/reviews.js:151–166` (IDOR Ownership Enforcement & Validation)**:
  ```javascript
  151: if (!mongoose.Types.ObjectId.isValid(id)) {
  152:   return res.status(400).json({ error: 'Invalid review ID' });
  153: }
  154: 
  155: const review = await Review.findById(id);
  156: if (!review) {
  157:   return res.status(404).json({ error: 'Review not found' });
  158: }
  159: 
  160: if (String(review.userId) !== String(req.userId)) {
  161:   return res.status(403).json({ error: 'You do not have permission to delete this review' });
  162: }
  163: 
  164: await Review.findByIdAndDelete(id);
  165: res.status(204).end();
  ```
- **`server/src/routes/reviews.js:33–54` (Public Optional Auth Handling)**:
  ```javascript
  33: r.get('/books/:isbn/reviews', optionalAuth, async (req, res, next) => {
  ...
  51:   const userReview = req.userId
  52:     ? reviews.find((rev) => String(rev.userId) === String(req.userId)) || null
  53:     : null;
  ```
- **`server/src/auth.js:24–34` (Graceful Optional Auth)**:
  ```javascript
  24: export function optionalAuth(req, res, next) {
  25:   const h = req.headers.authorization || '';
  26:   const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  27:   if (!token) return next();
  28:   try {
  29:     req.userId = jwt.verify(token, JWT_SECRET).sub;
  30:   } catch {
  31:     req.userId = null;
  32:   }
  33:   next();
  34: }
  ```
- **`server/src/routes/users.js:221–241` (Settings Reset Isolation)**:
  ```javascript
  222: r.post('/me/reset-books', requireAuth, loadUser, async (req, res, next) => {
  223:   try {
  224:     req.user.wantToRead = [];
  225:     req.user.currentlyReading = [];
  226:     req.user.read = [];
  227:     req.user.favorites = [];
  228:     await req.user.save();
  229:     res.json({
  230:       success: true,
  ...
  ```
- **`server/src/routes/reviews.js:187–196` (Settings Delete Reviews Isolation)**:
  ```javascript
  187: r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  188:   try {
  189:     const result = await Review.deleteMany({ userId: req.userId });
  190:     res.json({
  191:       success: true,
  192:       deletedCount: result.deletedCount,
  193:       message: `Successfully deleted ${result.deletedCount} review(s)`,
  194:     });
  195:   } catch (e) { next(e); }
  196: });
  ```

### 1.2 Empirical Stress Test Execution
An independent stress test harness was authored at `/Users/admin/Documents/Bookable/tests/stress-m1-isolation.js` and executed against the live API server running at `http://127.0.0.1:5050/api`.

**Command**:
```bash
node tests/stress-m1-isolation.js
```

**Verbatim Output**:
```
======================================================================
  CHALLENGER 2: EMPIRICAL MULTI-USER ISOLATION & IDOR STRESS SUITE
  Target API: http://127.0.0.1:5050/api
======================================================================

▶ SECTION 1: Multi-User Isolation & IDOR Attacks
  ✔ [PASS] 1.1 Create distinct User A and User B
  ✔ [PASS] 1.2 User A shelves books and posts reviews
  ✔ [PASS] 1.3 User B attempts IDOR delete on User A review via DELETE /api/reviews/:id -> Expect 403 Forbidden
  ✔ [PASS] 1.4 Verify User A review 1 still exists after User B attack
  ✔ [PASS] 1.5 User B attempts to access/mutate User A shelves using User B token -> User A shelves completely unaffected
  ✔ [PASS] 1.6 Test invalid ObjectId on DELETE /api/reviews/:id (e.g. not-an-id) -> Expect 400 or 404, NEVER 500
  ✔ [PASS] 1.7 Test non-existent valid ObjectId on DELETE /api/reviews/:id -> Expect 404

▶ SECTION 2: Settings Independence Stress Test
  ✔ [PASS] 2.1 Setup User C with 3 books shelved and 3 reviews posted
  ✔ [PASS] 2.2 User C calls POST /api/me/reset-books -> Shelves empty, all 3 reviews remain intact
  ✔ [PASS] 2.3 User C shelves new books, then calls DELETE /api/me/reviews -> Reviews deleted, shelves intact
  ✔ [PASS] 2.4 Cross-user settings independence: User C operations do not touch User A data

▶ SECTION 3: Unauthenticated & Malformed Token Access Checks
  ✔ [PASS] 3.1 Accessing /api/me without token -> Expect 401
  ✔ [PASS] 3.2 Accessing /api/me/shelves without token -> Expect 401
  ✔ [PASS] 3.3 Accessing PUT /api/me/shelf/:isbn without token -> Expect 401
  ✔ [PASS] 3.4 Accessing POST /api/me/reset-books without token -> Expect 401
  ✔ [PASS] 3.5 Accessing DELETE /api/me/reviews without token -> Expect 401
  ✔ [PASS] 3.6 Accessing DELETE /api/reviews/:id without token -> Expect 401
  ✔ [PASS] 3.7 Accessing GET /api/books/:isbn/reviews with expired or malformed token -> Expect 200, public reviews shown, userReview: null
  ✔ [PASS] 3.8 Accessing protected /api/me with malformed or tampered token -> Expect 401

▶ SECTION 4: Input Validation & Boundary Stress
  ✔ [PASS] 4.1 PUT /api/me/shelf/:isbn with invalid status values -> Expect 400 Bad Request
  ✔ [PASS] 4.2 POST /api/books/:isbn/reviews with invalid ratings -> Expect 400 Bad Request
  ✔ [PASS] 4.3 POST /api/books/:isbn/reviews with text > 5000 characters -> Expect 400 Bad Request
  ✔ [PASS] 4.4 Review upsert idempotency: Submitting review again for same ISBN updates rather than duplicating
  ✔ [PASS] 4.5 Type Coercion Edge Cases: Test boolean true/false in rating

======================================================================
  EXECUTION SUMMARY: 24 PASSED, 0 FAILED (Total: 24)
======================================================================

All empirical challenger stress tests PASSED successfully.
```

### 1.3 In-Process Unit & Route Test Suite
**Command**:
```bash
npm --prefix server test
```
**Result**:
`Milestone 1 Test Results: 63 passed, 0 failed` (Exit code 0).

---

## 2. Logic Chain

1. **Multi-User Isolation & IDOR Protection**:
   - *Observation*: In test 1.3, User B (`usrb_...`) with Bearer token `B` invoked `DELETE /api/reviews/:id` for review `6af761e738f1091f29a57194` authored by User A (`usra_...`).
   - *Deduction*: The endpoint returned HTTP 403 Forbidden with `{ error: 'You do not have permission to delete this review' }`. Subsequent queries to `GET /api/books/0385504209/reviews` and `GET /api/me/reviews` (using User A's token) confirmed the review was not deleted.
   - *Observation*: In test 1.5, User B mutated shelf status for ISBN `0439136350` to `read`.
   - *Deduction*: User A's profile remained completely unchanged (`wantToRead` retained `0439136350`, `currentlyReading` retained `0345339681`). User B's token only affected User B's MongoDB document.
   - *Conclusion*: Strict multi-user isolation is enforced; IDOR attacks are completely blocked.

2. **Malformed & Non-Existent ObjectId Handling**:
   - *Observation*: In test 1.6, values `'not-an-id'`, `'123'`, `'null'`, `'undefined'`, `'507f1f77bcf86cd79943901z'`, `'; drop table reviews;--'`, and `'<script>alert(1)</script>'` were submitted to `DELETE /api/reviews/:id`.
   - *Deduction*: `mongoose.Types.ObjectId.isValid(id)` intercepted all invalid formats and returned HTTP 400 Bad Request with `{ error: 'Invalid review ID' }`. Zero 500 internal server error crashes occurred.
   - *Observation*: In test 1.7, non-existent valid ObjectId `'507f1f77bcf86cd799439011'` returned HTTP 404 Not Found with `{ error: 'Review not found' }`.
   - *Conclusion*: The route handles all boundary inputs without throwing unhandled exceptions.

3. **Settings Independence (Reset Books vs Delete Reviews)**:
   - *Observation*: In test 2.2, User C with 3 shelved books and 3 reviews invoked `POST /api/me/reset-books`.
   - *Deduction*: User C's shelves were emptied to `[]` (`wantToRead`, `currentlyReading`, `read`, `favorites`), but all 3 reviews remained intact in the `Review` collection and visible on `GET /api/me/reviews`.
   - *Observation*: In test 2.3, User C re-shelved books and called `DELETE /api/me/reviews`.
   - *Deduction*: All 3 reviews were permanently deleted (`deletedCount: 3`), but User C's user account and shelves remained completely populated.
   - *Observation*: In test 2.4, User C's actions did not alter User A's shelves or reviews.
   - *Conclusion*: Settings operations are fully independent and isolated.

4. **Unauthenticated & Resilient Token Access**:
   - *Observation*: In tests 3.1–3.6, unauthenticated requests to `/api/me`, `/api/me/shelves`, `/api/me/shelf/:isbn`, `/api/me/reset-books`, `/api/me/reviews`, and `DELETE /api/reviews/:id` all returned HTTP 401.
   - *Observation*: In test 3.7, requests to `GET /api/books/:isbn/reviews` with expired JWTs, malformed strings, or no Authorization header returned HTTP 200 with community reviews and `userReview: null`.
   - *Conclusion*: Public endpoints degrade gracefully for guest/expired sessions, while private endpoints strictly require valid authentication.

---

## 3. Caveats

- **Note on `tests/auth-isolation.test.js:46` (`T1-AUTH-02`)**:
  In the pre-existing test suite, test `T1-AUTH-02` failed with `AssertionError: Expected 200 OK, got undefined`. Investigation revealed this was an assertion mismatch in the test runner (`assert.strictEqual(res.status, 200)` where `loginUser` helper returns `{ token, user, res }`, so `res.status` was undefined instead of `res.res.status`). The actual `/api/auth/login` endpoint returns HTTP 200 correctly (as proven in `T1-AUTH-04` and throughout our stress suite).
- No implementation code was modified by Challenger 2, adhering strictly to review-only constraints.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 1 backend implementation satisfies all empirical challenger requirements:
- Multi-User Isolation & IDOR attacks are 100% mitigated (HTTP 403, 0 data leakage).
- Settings operations (`reset-books` and `delete-reviews`) operate with complete independence.
- Invalid ObjectIds return HTTP 400 (never 500); non-existent ObjectIds return HTTP 404.
- Unauthenticated access returns HTTP 401 on private routes, and HTTP 200 with `userReview: null` on public book review routes.

---

## 5. Verification Method

To independently reproduce the empirical challenge results:

1. **Run the Challenger 2 Stress Test Suite**:
   ```bash
   node tests/stress-m1-isolation.js
   ```
   *Expected output*: `24 PASSED, 0 FAILED (Total: 24)`.

2. **Run Server Verification Suite**:
   ```bash
   npm --prefix server test
   ```
   *Expected output*: `Milestone 1 Test Results: 63 passed, 0 failed`.

3. **Inspect Implementation & Test Files**:
   - `server/src/routes/reviews.js`
   - `server/src/routes/users.js`
   - `server/src/auth.js`
   - `tests/stress-m1-isolation.js`

4. **Invalidation Conditions**:
   - If User B can delete User A's review (HTTP 204 or review deleted), this verification is invalidated.
   - If `DELETE /api/reviews/not-an-id` returns HTTP 500, this verification is invalidated.
   - If calling `POST /api/me/reset-books` deletes any user review, this verification is invalidated.
   - If calling `DELETE /api/me/reviews` clears user shelves, this verification is invalidated.
   - If `GET /api/books/:isbn/reviews` returns 401 or 500 for expired tokens, this verification is invalidated.
