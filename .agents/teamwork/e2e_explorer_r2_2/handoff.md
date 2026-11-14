# Handoff Report: Investigation of Assertion Strictness in Tier 3 & Tier 4 E2E Tests

**Agent**: `e2e_explorer_r2_2`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_explorer_r2_2`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**Original Parent**: `10a6c306-1c88-446c-b310-382d63518784`  
**Date**: 2026-11-13T20:03:00Z  
**Scope**: Analysis of permissive assertions (`[200, 404]`, `[403, 404]`) in `tests/e2e-scenarios.test.js` (`T3-CMB-07`, `T3-CMB-08`, `T4-SCN-01`, `T4-SCN-05`, `T4-SCN-06`) and server route implementations (`server/src/routes/{users.js,reviews.js,api.js}`) under `PROJECT.md § Interface Contracts`.

---

## 1. Observation

### 1.1 Flagged Test Locations in `tests/e2e-scenarios.test.js`

From direct inspection of `tests/e2e-scenarios.test.js`:

1. **`T3-CMB-07: Reset Books preserves User Reviews intact`** (lines 537–546):
   ```javascript
   it('T3-CMB-07: Reset Books preserves User Reviews intact', async () => {
     const user = await createTestUser('t3_reset_pres');
     assert.ok(user.token);

     await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'Keep me.' }, user.token);
     await request('POST', '/me/reset-books', {}, user.token);

     const revs = await request('GET', '/me/reviews', null, user.token);
     assert.ok([200, 404].includes(revs.status));
   });
   ```
   *Flaw*: Accepts `404` for `/me/reviews`. Never verifies whether the created review survived the book reset.

2. **`T3-CMB-08: Delete Reviews preserves User Shelves intact`** (lines 548–557):
   ```javascript
   it('T3-CMB-08: Delete Reviews preserves User Shelves intact', async () => {
     const user = await createTestUser('t3_del_pres');
     assert.ok(user.token);

     await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, user.token);
     await request('DELETE', '/me/reviews', null, user.token);

     const shf = await request('GET', '/me/shelves', null, user.token);
     assert.ok([200, 404].includes(shf.status));
   });
   ```
   *Flaw*: Accepts `404` for `/me/shelves`. Never verifies whether the shelved book `KNOWN_SEEDS.HOBBIT` remains in `wantToRead`.

3. **`T4-SCN-01: The Complete Reader Journey — From Discovery to Finished Book`** (lines 600–627):
   ```javascript
   // line 606-607:
   const searchRes = await request('GET', '/books/search?q=tolkien&limit=5');
   assert.ok([200, 404].includes(searchRes.status));
   ...
   // line 625-626:
   const shelves = await request('GET', '/me/shelves', null, alice.token);
   assert.ok([200, 404].includes(shelves.status));
   ```
   *Flaw*: Accepts `404` on catalog search and on the terminal shelf verification of a full user journey.

4. **`T4-SCN-05: Strict Multi-User Privacy & Security Wall`** (lines 693–709):
   ```javascript
   it('T4-SCN-05: Strict Multi-User Privacy & Security Wall', async () => {
     const userA = await createTestUser('priv_a');
     const userB = await createTestUser('priv_b');

     // User A shelves & reviews
     await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'currently_reading' }, userA.token);
     const revA = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'User A private review' }, userA.token);

     // User B attempts to delete User A's review if review ID is available
     if (revA.status === 200 || revA.status === 201) {
       const reviewId = revA.body?.review?._id || revA.body?._id;
       if (reviewId) {
         const intruderDel = await request('DELETE', `/reviews/${reviewId}`, null, userB.token);
         assert.ok([403, 404].includes(intruderDel.status));
       }
     }
   });
   ```
   *Flaw*: The entire security assertion is wrapped in conditional `if` statements. If `revA` fails or returns unexpected status, 0 assertions run. If `intruderDel` returns `404` (missing route or unlocated entity), the test passes without verifying the `403 Forbidden` IDOR guard.

5. **`T4-SCN-06: Library Clean Slate & GDPR-Style Data Deletion`** (lines 711–726):
   ```javascript
   it('T4-SCN-06: Library Clean Slate & GDPR-Style Data Deletion', async () => {
     const emma = await createTestUser('emma');
     assert.ok(emma.token);

     // 1. Shelve & review
     await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'read' }, emma.token);
     await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 5, text: 'Emma read' }, emma.token);

     // 2. Reset books
     const resetRes = await request('POST', '/me/reset-books', {}, emma.token);
     assert.ok([200, 404].includes(resetRes.status));

     // 3. Delete reviews
     const delRes = await request('DELETE', '/me/reviews', null, emma.token);
     assert.ok([200, 404].includes(delRes.status));
   });
   ```
   *Flaw*: Both settings operations accept `404`, meaning broken routes pass cleanly while leaving user data un-reset and un-deleted.

---

### 1.2 Server Route Mounting and Implementations

From inspection of `server/src/index.js` (lines 13–15):
```javascript
app.use('/api', users);
app.use('/api', reviews);
app.use('/api', api);
```
All routes are mounted under the `/api` prefix, matching `tests/helpers.js` `API_BASE = 'http://127.0.0.1:5050/api'`.

From inspection of the route files and `PROJECT.md § Interface Contracts`:

| Endpoint | Handler Location | Method | Auth Required | Contract Specification in `PROJECT.md` | Actual Server Behavior & Status Code |
|---|---|---|---|---|---|
| `/api/books/:isbn/reviews` | `server/src/routes/reviews.js:68–145` | `POST` | Yes (`requireAuth`) | Accepts `{ rating: 1-5, text }`. Returns created review with sentiment data. | `res.status(201).json({ review, stats, shelves })` -> **HTTP 201** |
| `/api/books/:isbn/reviews` | `server/src/routes/reviews.js:33–65` | `GET` | No (`optionalAuth`) | Returns `{ averageRating, totalReviews, ratingCounts, reviews }`. | `res.json({ isbn, averageRating, totalReviews, ... })` -> **HTTP 200** |
| `/api/me/reset-books` | `server/src/routes/users.js:222–241` | `POST` | Yes (`requireAuth`) | Clears `wantToRead`, `currentlyReading`, `read`, `favorites`. Reviews remain intact. | `res.json({ success: true, message, user, shelves })` -> **HTTP 200** |
| `/api/me/reviews` | `server/src/routes/reviews.js:170–184` | `GET` | Yes (`requireAuth`) | Returns all reviews written by requesting user. | `res.json({ total, reviews })` -> **HTTP 200** |
| `/api/me/reviews` | `server/src/routes/reviews.js:187–196` | `DELETE` | Yes (`requireAuth`) | Deletes all reviews written by `req.userId`. Shelves remain intact. | `res.json({ success: true, deletedCount, message })` -> **HTTP 200** |
| `/api/me/shelf/:isbn` | `server/src/routes/users.js:150–193` | `PUT` | Yes (`requireAuth`) | Mutually exclusive status transition (`want_to_read`, `currently_reading`, `read`, `none`). | `res.json({ status, isbn, user, shelves })` -> **HTTP 200** |
| `/api/me/shelves` | `server/src/routes/users.js:112–134` | `GET` | Yes (`requireAuth`) | Returns populated books grouped by shelf (`wantToRead`, `currentlyReading`, `read`, `favorites`). | `res.json({ wantToRead, currentlyReading, read, favorites, stats })` -> **HTTP 200** |
| `/api/reviews/:id` | `server/src/routes/reviews.js:148–167` | `DELETE` | Yes (`requireAuth`) | Verifies `review.userId.equals(req.userId)`. Returns 204. Rejects non-owner with 403. | Non-owner: `res.status(403).json({ error: 'You do not have permission to delete this review' })` -> **HTTP 403**.<br>Owner: `res.status(204).end()` -> **HTTP 204**. |
| `/api/books/search` | `server/src/routes/api.js:199–240` | `GET` | No | Catalog search with `$text` search and pagination. | `res.json(books)` or `res.json({ books, total, ... })` -> **HTTP 200** |

---

## 2. Logic Chain

1. **Root Cause Analysis (Why 404s Were Allowed)**:
   - When the test author constructed the initial 120-test suite in Iteration 1 (`e2e_test_writer_r1`), the backend was undergoing parallel development across multiple milestones (M1: auth/shelves/settings, M2: algorithms/sentiment, M3: Goodreads UI/gap analysis).
   - To make the test files syntactically complete and prevent unhandled rejections or early test aborts before backend routes were wired up, the author introduced defensive fallback patterns:
     - `assert.ok([200, 404].includes(res.status))`
     - `assert.ok([403, 404].includes(intruderDel.status))`
     - Conditional execution guards: `if (res.status === 200 || res.status === 201) { ... }`
   - These patterns acted as permissive facades: if an endpoint was 404 (non-existent route), the test passed without error.

2. **Backend Reality**:
   - As observed in `server/src/routes/users.js`, `server/src/routes/reviews.js`, and `server/src/routes/api.js`, **all required endpoints are fully implemented and functional**.
   - None of these endpoints legitimately return 404 under valid user operations against valid catalog seed ISBNs:
     - `/api/me/reset-books`: Implemented at `users.js:222` -> returns `200`.
     - `/api/me/shelves`: Implemented at `users.js:112` -> returns `200`.
     - `/api/me/reviews` (GET): Implemented at `reviews.js:170` -> returns `200`.
     - `/api/me/reviews` (DELETE): Implemented at `reviews.js:187` -> returns `200`.
     - `/api/reviews/:id` (DELETE non-owner): Implemented at `reviews.js:148`, checks `review.userId !== req.userId` -> returns `403`.
     - `/api/books/:isbn/reviews` (POST): Implemented at `reviews.js:68` -> returns `201`.
     - `/api/books/search`: Implemented at `api.js:199` -> returns `200`.

3. **Risk of Permissive Assertions**:
   - Accepting `404` masks catastrophic functional regressions:
     - If `/api/me/reset-books` fails or is misrouted, `T3-CMB-07` and `T4-SCN-06` pass without resetting books.
     - If `/api/me/reviews` (DELETE) fails or is misrouted, `T3-CMB-08` and `T4-SCN-06` pass without deleting user reviews.
     - If `/api/reviews/:id` IDOR authorization check fails because the route does not match, `T4-SCN-05` passes because 404 was permitted.
     - If `GET /api/me/shelves` fails, `T4-SCN-01` passes despite the user journey ending in failure.

4. **Resolution Strategy**:
   - Eliminate all `[200, 404]` and `[403, 404]` status arrays in `T3-CMB-07`, `T3-CMB-08`, `T4-SCN-01`, `T4-SCN-05`, `T4-SCN-06`.
   - Assert exact HTTP status codes:
     - `assert.strictEqual(res.status, 200)`
     - `assert.strictEqual(res.status, 201)`
     - `assert.strictEqual(res.status, 204)`
     - `assert.strictEqual(res.status, 403)`
   - Strengthen state assertions so tests verify semantic invariants (e.g. data is actually present, deleted, or isolated).

---

## 3. Caveats

1. **Catalog Book Existence**:
   - Endpoints like `PUT /api/me/shelf/:isbn` and `POST /api/books/:isbn/reviews` validate that the ISBN exists in the catalog (`(engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }))`). Using non-existent or invalid ISBNs will produce a 404. All hardened tests must use known seeds (`KNOWN_SEEDS.DUNE`, `KNOWN_SEEDS.HOBBIT`, `KNOWN_SEEDS.HP_AZKABAN`) which are guaranteed to exist.
2. **Review Auto-Transition Side Effect**:
   - Calling `POST /api/books/:isbn/reviews` has a documented Goodreads-parity side effect on the backend (`server/src/routes/reviews.js:110–114`): it automatically adds the reviewed book to the user's `read` shelf and pulls it from `wantToRead` and `currentlyReading`. State assertions on shelves after posting a review must account for this behavior.
3. **Other Test Files**:
   - Permissive `[200, 404]` assertions also exist in `tests/auth-isolation.test.js` (lines 173, 192, 350) and earlier Tier 1/2 tests in `tests/e2e-scenarios.test.js` (e.g. lines 53, 70, 88, 275, 341, 427, 435, 458, 472). While this investigation specifically targets Tier 3 & Tier 4 per the dispatch prompt, those should also be hardened for holistic test suite excellence.

---

## 4. Conclusion & Hardening Recommendations

### 4.1 Summary of Exact Endpoint Status Codes

| Test | Request Description | Target Endpoint | Exact Expected Status Code | Semantic Invariant to Assert |
|---|---|---|---|---|
| **`T3-CMB-07`** | Post review | `POST /api/books/:isbn/reviews` | **201** | `res.body.review.isbn === KNOWN_SEEDS.DUNE` |
| | Reset books | `POST /api/me/reset-books` | **200** | `res.body.success === true` |
| | Fetch reviews | `GET /api/me/reviews` | **200** | `res.body.total >= 1` and contains the review |
| **`T3-CMB-08`** | Shelve book | `PUT /api/me/shelf/:isbn` | **200** | `res.body.status === 'want_to_read'` |
| | Delete reviews | `DELETE /api/me/reviews` | **200** | `res.body.success === true` |
| | Fetch shelves | `GET /api/me/shelves` | **200** | `wantToRead` contains `KNOWN_SEEDS.HOBBIT` |
| **`T4-SCN-01`** | Search catalog | `GET /api/books/search?q=tolkien&limit=5` | **200** | Array length > 0 |
| | Shelve want_to_read | `PUT /api/me/shelf/:isbn` | **200** | `res.body.status === 'want_to_read'` |
| | Shelve currently_reading | `PUT /api/me/shelf/:isbn` | **200** | `res.body.status === 'currently_reading'` |
| | Shelve read | `PUT /api/me/shelf/:isbn` | **200** | `res.body.status === 'read'` |
| | Post review | `POST /api/books/:isbn/reviews` | **201** | `res.body.review._id` exists |
| | Fetch shelves | `GET /api/me/shelves` | **200** | `read` shelf contains `KNOWN_SEEDS.HOBBIT` |
| **`T4-SCN-05`** | User A shelve | `PUT /api/me/shelf/:isbn` | **200** | `status === 'currently_reading'` |
| | User A review | `POST /api/books/:isbn/reviews` | **201** | `reviewId` is valid ObjectId |
| | User B delete | `DELETE /api/reviews/:id` | **403** | `res.body.error === 'You do not have permission to delete this review'` |
| | Verify intact | `GET /api/me/reviews` (User A) | **200** | User A's review still exists |
| **`T4-SCN-06`** | User shelve | `PUT /api/me/shelf/:isbn` | **200** | `status === 'read'` |
| | User review | `POST /api/books/:isbn/reviews` | **201** | review created |
| | Reset books | `POST /api/me/reset-books` | **200** | `res.body.success === true` |
| | Delete reviews | `DELETE /api/me/reviews` | **200** | `res.body.success === true`, `deletedCount === 1` |
| | Verify clean slate | `GET /api/me/shelves` & `GET /api/me/reviews` | **200 & 200** | `stats.totalShelved === 0` & `total === 0` |

---

### 4.2 Proposed Code Replacements for `tests/e2e-scenarios.test.js`

#### 1. Hardened `T3-CMB-07`:
```javascript
  it('T3-CMB-07: Reset Books preserves User Reviews intact', async () => {
    const user = await createTestUser('t3_reset_pres');
    assert.ok(user.token);

    // 1. Post review
    const postRes = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'Keep me.' }, user.token);
    assert.strictEqual(postRes.status, 201, `Expected 201 Created on review submission, got ${postRes.status}`);

    // 2. Reset user's books & shelves
    const resetRes = await request('POST', '/me/reset-books', {}, user.token);
    assert.strictEqual(resetRes.status, 200, `Expected 200 OK on reset-books, got ${resetRes.status}`);
    assert.strictEqual(resetRes.body.success, true);

    // 3. Verify user review survived intact
    const revs = await request('GET', '/me/reviews', null, user.token);
    assert.strictEqual(revs.status, 200, `Expected 200 OK on get me/reviews, got ${revs.status}`);
    assert.strictEqual(revs.body.total, 1, 'Expected exactly 1 review preserved');
    assert.ok(Array.isArray(revs.body.reviews));
    assert.strictEqual(revs.body.reviews[0].isbn, KNOWN_SEEDS.DUNE);
    assert.strictEqual(revs.body.reviews[0].text, 'Keep me.');
  });
```

#### 2. Hardened `T3-CMB-08`:
```javascript
  it('T3-CMB-08: Delete Reviews preserves User Shelves intact', async () => {
    const user = await createTestUser('t3_del_pres');
    assert.ok(user.token);

    // 1. Put book on Want to Read shelf
    const shelfRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, user.token);
    assert.strictEqual(shelfRes.status, 200, `Expected 200 OK on shelving, got ${shelfRes.status}`);

    // 2. Add review then delete all reviews
    await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 4, text: 'Temporary review' }, user.token);
    const delRes = await request('DELETE', '/me/reviews', null, user.token);
    assert.strictEqual(delRes.status, 200, `Expected 200 OK on delete me/reviews, got ${delRes.status}`);
    assert.strictEqual(delRes.body.success, true);

    // 3. Verify shelves remain intact
    const shf = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(shf.status, 200, `Expected 200 OK on get me/shelves, got ${shf.status}`);
    assert.ok(shf.body.stats.totalShelved >= 1, 'Expected user shelves to remain populated');
    const allShelvedIsbns = [
      ...(shf.body.wantToRead || []).map((b) => b.isbn),
      ...(shf.body.read || []).map((b) => b.isbn),
    ];
    assert.ok(allShelvedIsbns.includes(KNOWN_SEEDS.HOBBIT), 'Hobbit must remain on user shelves');
  });
```

#### 3. Hardened `T4-SCN-01`:
```javascript
  it('T4-SCN-01: The Complete Reader Journey — From Discovery to Finished Book', async () => {
    // 1. Alice registers
    const alice = await createTestUser('alice');
    assert.ok(alice.token);

    // 2. Search catalog
    const searchRes = await request('GET', '/books/search?q=tolkien&limit=5');
    assert.strictEqual(searchRes.status, 200, `Expected 200 OK on catalog search, got ${searchRes.status}`);
    assert.ok(Array.isArray(searchRes.body) && searchRes.body.length > 0, 'Search must return results array');

    // 3. Shelves The Hobbit to Want to Read
    const wantRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, alice.token);
    assert.strictEqual(wantRes.status, 200);

    // 4. Transitions to Currently Reading
    const currRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'currently_reading' }, alice.token);
    assert.strictEqual(currRes.status, 200);

    // 5. Transitions to Read
    const readRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'read' }, alice.token);
    assert.strictEqual(readRes.status, 200);

    // 6. Submits 5-star review
    const revRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: "Magnificent adventure, loved Bilbo's journey!"
    }, alice.token);
    assert.strictEqual(revRes.status, 201, `Expected 201 Created on review submission, got ${revRes.status}`);

    // 7. Verifies shelves & reviews
    const shelves = await request('GET', '/me/shelves', null, alice.token);
    assert.strictEqual(shelves.status, 200, `Expected 200 OK on get me/shelves, got ${shelves.status}`);
    assert.ok(Array.isArray(shelves.body.read));
    assert.ok(shelves.body.read.some((b) => b.isbn === KNOWN_SEEDS.HOBBIT), 'Hobbit must be present in read shelf');
    assert.strictEqual(shelves.body.stats.readCount, 1);
  });
```

#### 4. Hardened `T4-SCN-05`:
```javascript
  it('T4-SCN-05: Strict Multi-User Privacy & Security Wall', async () => {
    const userA = await createTestUser('priv_a');
    const userB = await createTestUser('priv_b');

    // User A shelves & reviews
    const shelfA = await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'currently_reading' }, userA.token);
    assert.strictEqual(shelfA.status, 200);

    const revA = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'User A private review' }, userA.token);
    assert.strictEqual(revA.status, 201, `Expected 201 Created on User A review, got ${revA.status}`);

    const reviewId = revA.body?.review?._id || revA.body?._id;
    assert.ok(reviewId, 'Review ID must be present in response');

    // User B attempts IDOR deletion of User A's review — MUST return 403 Forbidden
    const intruderDel = await request('DELETE', `/reviews/${reviewId}`, null, userB.token);
    assert.strictEqual(intruderDel.status, 403, `Expected 403 Forbidden for unauthorized review deletion, got ${intruderDel.status}`);
    assert.strictEqual(intruderDel.body.error, 'You do not have permission to delete this review');

    // Verify User A's review remains intact
    const userARevs = await request('GET', '/me/reviews', null, userA.token);
    assert.strictEqual(userARevs.status, 200);
    assert.ok(userARevs.body.reviews.some((r) => String(r._id) === String(reviewId)), 'User A review must survive IDOR attack');

    // Verify shelf isolation: User B shelves must be empty
    const shelvesB = await request('GET', '/me/shelves', null, userB.token);
    assert.strictEqual(shelvesB.status, 200);
    assert.strictEqual(shelvesB.body.stats.totalShelved, 0, 'User B must not inherit User A shelves');
  });
```

#### 5. Hardened `T4-SCN-06`:
```javascript
  it('T4-SCN-06: Library Clean Slate & GDPR-Style Data Deletion', async () => {
    const emma = await createTestUser('emma');
    assert.ok(emma.token);

    // 1. Shelve & review
    const shelfRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'read' }, emma.token);
    assert.strictEqual(shelfRes.status, 200);

    const revRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 5, text: 'Emma read' }, emma.token);
    assert.strictEqual(revRes.status, 201);

    // 2. Reset books (clears shelves and favorites, keeps reviews)
    const resetRes = await request('POST', '/me/reset-books', {}, emma.token);
    assert.strictEqual(resetRes.status, 200, `Expected 200 OK on reset-books, got ${resetRes.status}`);
    assert.strictEqual(resetRes.body.success, true);

    // Verify shelves cleared
    const checkShelves = await request('GET', '/me/shelves', null, emma.token);
    assert.strictEqual(checkShelves.status, 200);
    assert.strictEqual(checkShelves.body.stats.totalShelved, 0, 'All shelves must be cleared after reset-books');

    // 3. Delete reviews (deletes all reviews written by user)
    const delRes = await request('DELETE', '/me/reviews', null, emma.token);
    assert.strictEqual(delRes.status, 200, `Expected 200 OK on delete reviews, got ${delRes.status}`);
    assert.strictEqual(delRes.body.success, true);
    assert.strictEqual(delRes.body.deletedCount, 1, 'Expected exactly 1 review deleted');

    // Verify clean slate: 0 reviews
    const checkRevs = await request('GET', '/me/reviews', null, emma.token);
    assert.strictEqual(checkRevs.status, 200);
    assert.strictEqual(checkRevs.body.total, 0, 'User must have 0 reviews after clean slate deletion');
  });
```

---

## 5. Verification Method

To independently verify these conclusions:

1. **Verify Route Implementations in Codebase**:
   - Inspect `server/src/routes/users.js` at line 112 (`/me/shelves`), line 150 (`/me/shelf/:isbn`), line 222 (`/me/reset-books`).
   - Inspect `server/src/routes/reviews.js` at line 68 (`/books/:isbn/reviews`), line 148 (`/reviews/:id`), line 170 (`/me/reviews` GET), line 187 (`/me/reviews` DELETE).
   - Inspect `server/src/routes/api.js` at line 199 (`/books/search`).

2. **Verify Interface Contracts**:
   - Inspect `.agents/teamwork/orchestrator/PROJECT.md` under `## Interface Contracts` (lines 53–94).

3. **Verify Execution Against Running Express Server**:
   ```bash
   node --test tests/e2e-scenarios.test.js
   ```
   All hardened assertions evaluate strictly against the live API, asserting status codes 200, 201, 204, and 403 with 0 occurrences of `[200, 404]` or `[403, 404]`.

4. **Invalidation Condition**:
   - If any of the above endpoints are found to return 404 during normal authenticated execution with valid seed ISBNs, or if the IDOR check in `DELETE /api/reviews/:id` returns an HTTP code other than 403 when executed by a non-owner, this analysis is invalidated.
