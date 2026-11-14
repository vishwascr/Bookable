# Milestone 1 Iteration 2 Specification Mining Report: Input Type Validation & Boundary Contracts

## 1. Observation

Direct empirical investigation and adversarial code inspection of the Milestone 1 backend implementation (`server/src/routes/reviews.js`, `server/src/routes/users.js`, `server/src/models/Review.js`, and `server/src/scripts/challenger-stress.js`) revealed the following verifiable facts:

### 1.1 Type Coercion Bypass in `POST /api/books/:isbn/reviews`
- **Location**: `server/src/routes/reviews.js:68–74`
  ```javascript
  r.post('/books/:isbn/reviews', requireAuth, loadUser, async (req, res, next) => {
    try {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      }
  ```
- **JavaScript Coercion Semantics**:
  - `Number('5') === 5` (evaluates `Number.isInteger(5) === true`, `5 >= 1 && 5 <= 5`)
  - `Number(true) === 1` (evaluates `Number.isInteger(1) === true`, `1 >= 1 && 1 <= 5`)
  - `Number([3]) === 3` (evaluates `Number.isInteger(3) === true`, `3 >= 1 && 3 <= 5`)
- **Empirical Execution Command**:
  `cd /Users/admin/Documents/Bookable/server && node src/scripts/challenger-stress.js`
- **Result Output**:
  ```
  SUMMARY: 89 checks passed, 3 checks failed.

  FAILURES IDENTIFIED:
    ❌ Boundary [string "5"] rejected with 400 (got status 201 ...)
    ❌ Boundary [boolean true rating] rejected with 400 (got status 201 ...)
    ❌ Boundary [array [3] rating] rejected with 400 (got status 201 ...)
  ```

### 1.2 Unsafe Destructuring on Missing Body in `PUT /api/me/shelf/:isbn`
- **Location**: `server/src/routes/users.js:150–154`
  ```javascript
  r.put('/me/shelf/:isbn', requireAuth, loadUser, async (req, res, next) => {
    try {
      const isbn = String(req.params.isbn || '').trim();
      const { status } = req.body;
  ```
- If a client sends a request with an empty body, missing `Content-Type: application/json` header, or `req.body === undefined`, `const { status } = req.body` throws:
  `TypeError: Cannot destructure property 'status' of 'req.body' as it is undefined.`
- This unhandled exception passes to Express's `next(e)` error handler, producing an unexpected HTTP 500 status rather than HTTP 400.

### 1.3 Review Text Type Handling in `POST /api/books/:isbn/reviews`
- **Location**: `server/src/routes/reviews.js:75–78`
  ```javascript
  const text = String(req.body.text || '').trim();
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Review text cannot exceed 5000 characters' });
  }
  ```
- If `req.body` is missing, `req.body.text` throws `TypeError: Cannot read properties of undefined (reading 'text')`.
- If `req.body.text` is a non-string type (such as an array `['spoiler']`, object `{ text: 'review' }`, number `12345`, or boolean `true`), `String(req.body.text || '')` coerces:
  - `['spoiler']` becomes `'spoiler'`
  - `{ text: 'review' }` becomes `'[object Object]'`
  - `12345` becomes `'12345'`
  - `true` becomes `'true'`
- This coerces non-string payload data directly into database review strings rather than validating input types.

---

## 2. Logic Chain

1. **Root Cause Analysis of Rating Validation**:
   - `Number(value)` attempts explicit type coercion before validation.
   - For strings representing integers (`'5'`, `'1'`), booleans (`true` -> 1), and arrays with a single numeric value (`[3]` -> 3), `Number()` converts them to valid JavaScript numbers.
   - `Number.isInteger(5)` subsequently returns `true`, and bounds checking `5 >= 1 && 5 <= 5` evaluates to `true`.
   - The contract requirement `"Ratings: test boundaries (0, 6, -1, 3.5 float, '5' string, null) -> expect 400"` requires strict type checking before any numeric operation.
   - Using `typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5` strictly enforces that only numeric primitives pass, rejecting strings (`typeof '5' === 'string'`), booleans (`typeof true === 'boolean'`), arrays (`typeof [3] === 'object'`), objects (`typeof {} === 'object'`), null (`typeof null === 'object'`), and undefined. Non-integer numbers (`3.5`, `NaN`, `Infinity`) fail `Number.isInteger(rating)`, and out-of-range integers (`0`, `6`, `-1`) fail bounds checks.

2. **Root Cause Analysis of Shelf Body Destructuring**:
   - Destructuring `{ status }` from `req.body` assumes `req.body` is an object.
   - If `req.body` is `undefined` (common when `Content-Type` is omitted or client sends empty body), runtime TypeError occurs.
   - Using safe fallback destructuring `const { status } = req.body || {}` ensures `status` evaluates safely to `undefined`.
   - Subsequent enum validation `['want_to_read', 'currently_reading', 'read', 'none'].includes(status)` evaluates to `false` and cleanly returns HTTP 400 Bad Request with `{ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' }`.

3. **Specification Synthesis for Review Text**:
   - Review text is an optional field. Tests like `T2-REV-03: Allow review with rating only and empty text` submit `{ rating: 4, text: '' }` or `{ rating: 4 }` (omitting `text`).
   - If `text` is absent (`undefined`), it defaults to an empty string `''`.
   - If `text` is supplied but is not a string (`text !== undefined && typeof text !== 'string'`), it represents an invalid schema payload (e.g. array, object, number, boolean, or null) and must be rejected with HTTP 400 `{ error: 'Review text must be a string' }`.
   - Once confirmed to be a string (or defaulted to `''`), `text.trim().length > 5000` must return HTTP 400 `{ error: 'Review text cannot exceed 5000 characters' }`.

---

## 3. Caveats

1. **Client Sending `text: null`**:
   - In JSON APIs, clients occasionally send `{ rating: 5, text: null }` instead of omitting `text` or sending `""`.
   - In strict type validation, `typeof null === 'object'`, which triggers the rejection `Review text must be a string`. This is completely consistent with `rating: null` and `status: null` both being rejected with HTTP 400.
   - If permissive null handling is desired, `text !== undefined && text !== null && typeof text !== 'string'` would allow `null` to coerce to `''`. However, strict rejection of non-string types is the standard REST specification recommendation.
2. **Read-Only Explorer Discipline**:
   - As a Specification Miner, no implementation files (`reviews.js`, `users.js`) have been modified by this role. Implementation is assigned to the Worker role.

---

## 4. Conclusion

The specification requirements for input type validation across all review and shelf routes are defined as follows:

### 4.1 Specification Contract: `POST /api/books/:isbn/reviews`
1. **Request Body Destructuring**:
   - Safe destructuring: `const { rating, text: rawText } = req.body || {};`
2. **Rating Type & Value Validation**:
   - Condition: `typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5`
   - Rejection Status: HTTP 400 Bad Request
   - Error Body: `{ "error": "Rating must be an integer between 1 and 5" }`
   - Rejects: strings (`'5'`, `'0'`, `'6'`, `'five'`), booleans (`true`, `false`), arrays (`[3]`, `[]`), objects (`{}`, `{ rating: 5 }`), null, undefined, NaN, Infinity, floats (`3.5`), out-of-range integers (`0`, `-1`, `6`, `100`).
   - Accepts: strictly integer numbers `1`, `2`, `3`, `4`, `5`.
3. **Review Text Type & Length Validation**:
   - Type Condition: `if (rawText !== undefined && typeof rawText !== 'string')`
   - Rejection Status: HTTP 400 Bad Request
   - Error Body: `{ "error": "Review text must be a string" }`
   - Normalization: `const text = (rawText || '').trim();`
   - Length Condition: `if (text.length > 5000)`
   - Rejection Status: HTTP 400 Bad Request
   - Error Body: `{ "error": "Review text cannot exceed 5000 characters" }`
4. **Catalog ISBN Validation**:
   - If ISBN is not present in catalog/memory engine: HTTP 404 `{ "error": "Book not found" }`
5. **Success Behavior**:
   - Upserts Review document for authenticated user and ISBN (`findOneAndUpdate` with `upsert: true`).
   - Automatically transitions book to `read` shelf (removes from `wantToRead` and `currentlyReading`, prepends to `read` if not present).
   - Recalculates book statistics (`averageRating`, `totalReviews`, `ratingCounts`, `ratingDistribution`).
   - Returns HTTP 201 Created with `{ review, stats, shelves }`.

### 4.2 Specification Contract: `PUT /api/me/shelf/:isbn`
1. **Request Body Destructuring**:
   - Safe destructuring: `const { status } = req.body || {};`
2. **Status Enum Validation**:
   - Allowed enum set: `const validStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];`
   - Condition: `if (!validStatuses.includes(status))`
   - Rejection Status: HTTP 400 Bad Request
   - Error Body: `{ "error": "Invalid status. Allowed values: want_to_read, currently_reading, read, none" }`
   - Rejects: `undefined` (missing body), `null`, non-strings, unrecognized strings (`'reading'`, `'finished'`, `'WANT_TO_READ'`), strings with whitespace (`'read '`, `' reading'`).
3. **Catalog ISBN Validation**:
   - If ISBN is not present in catalog/memory engine: HTTP 404 `{ "error": "Book not found" }`
4. **State Transition**:
   - Removes ISBN from `wantToRead`, `currentlyReading`, `read`.
   - Prepends ISBN to target status shelf (unless status is `'none'`).
   - `favorites` array remains 100% untouched.
   - Returns HTTP 200 OK with `{ status, isbn, user, shelves, favorites, wantToRead, currentlyReading, read }`.

---

## 5. Verification Method

To independently verify the specification constraints and identify test pass/fail conditions:

1. **Run Challenger Stress Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable/server && node src/scripts/challenger-stress.js
   ```
   - Current output: 89 passed, 3 failed (`string "5"`, `boolean true rating`, `array [3] rating`).
   - Invalidation condition: When strict `typeof rating === 'number'` is implemented, all 92 checks must pass with exit code 0.

2. **Run Full Test Suite**:
   ```bash
   cd /Users/admin/Documents/Bookable && npm test
   ```
   - Must pass all existing tests in `tests/auth-isolation.test.js`, `tests/e2e-scenarios.test.js`, and `tests/sentiment-analysis.test.js`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Reviews | Strict Rating Type Validation | Validates rating is strictly a numeric integer between 1 and 5 without JavaScript type coercion | `POST /api/books/:isbn/reviews` with body `{ rating, text? }` | `201 Created` with created review, stats, shelves | Rejects strings, booleans, arrays, objects, null, undefined, NaN, floats with `400 Bad Request` `{ "error": "Rating must be an integer between 1 and 5" }` | `challenger-stress.js`, `ORIGINAL_REQUEST.md`, `SCOPE.md` |
| 2 | Reviews | Review Text Type & Length Validation | Accepts optional text; validates string type if present and max length of 5000 characters | Body `{ text: string }` | Stored trimmed string in review document | If non-string: `400 Bad Request` `{ "error": "Review text must be a string" }`. If length > 5000: `400 Bad Request` `{ "error": "Review text cannot exceed 5000 characters" }` | `reviews.js`, `Review.js`, `e2e-scenarios.test.js` |
| 3 | Reviews | Empty & Absent Review Text Support | Permitted to submit a rating with absent text or empty string text | Body `{ rating: 4 }` or `{ rating: 4, text: "" }` | `201 Created` with `text: ""` and rating-based sentiment inference | N/A | `tests/e2e-scenarios.test.js` (T2-REV-03), `sentiment-analysis.test.js` (T2-ADP-01) |
| 4 | Shelves | Safe Body Destructuring on Shelf Route | Handles missing or malformed request bodies without crashing Express runtime | `PUT /api/me/shelf/:isbn` with missing or empty body | N/A | Returns `400 Bad Request` `{ "error": "Invalid status. Allowed values: want_to_read, currently_reading, read, none" }` instead of HTTP 500 | `users.js:153`, `challenger-stress.js:130` |
| 5 | Shelves | Reading Status Enum Validation | Validates shelf status against strict 4-state enum | `body: { status }` where status in `['want_to_read', 'currently_reading', 'read', 'none']` | `200 OK` with updated shelf partitions | If invalid status: `400 Bad Request` `{ "error": "Invalid status. Allowed values: want_to_read, currently_reading, read, none" }` | `users.js:154`, `SCOPE.md:18` |
| 6 | Shelves | Mutually Exclusive Shelf Transitions | Moving a book to one reading shelf atomically pulls it from all other reading shelves | Valid status transition on known ISBN | `200 OK` with updated shelves object | Non-existent ISBN returns `404 Not Found` `{ "error": "Book not found" }` | `users.js:163`, `PROJECT.md:79` |
| 7 | Shelves | Favorites Shelf Preservation | Shelf state transitions strictly mutate reading shelves and never clear or alter favorites | Any status transition on `/api/me/shelf/:isbn` | `favorites` array remains unchanged | N/A | `challenger-stress.js:217`, `PROJECT.md:80` |
| 8 | Reviews | Upsert Review Semantics | Submitting a review for an already reviewed ISBN by the same user updates the review and preserves `totalReviews` | `POST /api/books/:isbn/reviews` by existing reviewer | `201 Created` with updated review and accurate aggregate counts | N/A | `Review.js:63` (`{ userId: 1, isbn: 1 }`), `challenger-stress.js:380` |
| 9 | Reviews | Automatic Shelving to 'Read' | Submitting a review automatically removes the book from `wantToRead` and `currentlyReading` and adds to `read` | `POST /api/books/:isbn/reviews` | `201 Created` with updated user shelves | N/A | `reviews.js:110–115`, `SCOPE.md:24` |
| 10 | Reviews | Review Aggregation Mathematics | Computes `averageRating` rounded to 1 decimal place, `totalReviews`, and all keys 1..5 in `ratingDistribution` | `GET /api/books/:isbn/reviews` | `200 OK` with distribution map and average | Non-existent ISBN returns `404 Not Found` `{ "error": "Book not found" }` | `reviews.js:42–50`, `challenger-stress.js:433` |
| 11 | Reviews | Single Review Deletion IDOR Protection | Deleting a review by ID requires authenticated user to match `review.userId` | `DELETE /api/reviews/:id` with bearer token | `204 No Content` | Invalid ID: `400 Bad Request`. Not found: `404 Not Found`. Not owner: `403 Forbidden` | `reviews.js:148–166`, `PROJECT.md:87` |
| 12 | Settings | Reset Books Endpoint | Clears user's `wantToRead`, `currentlyReading`, `read`, and `favorites` without touching reviews | `POST /api/me/reset-books` (authenticated) | `200 OK` with empty shelf arrays | Unauthenticated: `401 Unauthorized` | `users.js:221–241`, `PROJECT.md:91` |
| 13 | Settings | Mass Delete User Reviews Endpoint | Deletes all reviews written by authenticated user without resetting shelves | `DELETE /api/me/reviews` (authenticated) | `200 OK` with `{ success: true, deletedCount }` | Unauthenticated: `401 Unauthorized` | `reviews.js:187–196`, `PROJECT.md:92` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `POST /api/books/:isbn/reviews` | `{ rating: '5' }` (string) | In Iteration 1: Coerces to number 5 and returns 201 Created. In Iteration 2 Spec: Must reject with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 2 | `POST /api/books/:isbn/reviews` | `{ rating: true }` (boolean) | In Iteration 1: Coerces to number 1 and returns 201 Created. In Iteration 2 Spec: Must reject with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 3 | `POST /api/books/:isbn/reviews` | `{ rating: [3] }` (array) | In Iteration 1: Coerces to number 3 and returns 201 Created. In Iteration 2 Spec: Must reject with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 4 | `POST /api/books/:isbn/reviews` | `{ rating: 3.5 }` (float) | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 5 | `POST /api/books/:isbn/reviews` | `{ rating: 0 }` (boundary < 1) | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 6 | `POST /api/books/:isbn/reviews` | `{ rating: 6 }` (boundary > 5) | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 7 | `POST /api/books/:isbn/reviews` | `{ rating: null }` | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 8 | `POST /api/books/:isbn/reviews` | `{ rating: undefined }` (missing rating) | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 9 | `POST /api/books/:isbn/reviews` | `{ rating: NaN }` | Rejected with HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 10 | `POST /api/books/:isbn/reviews` | `{ rating: 5, text: 12345 }` (number text) | Coerces to string `'12345'`. Spec requires rejection with HTTP 400 `{ error: 'Review text must be a string' }`. |
| 11 | `POST /api/books/:isbn/reviews` | `{ rating: 5, text: ['bad'] }` (array text) | Coerces to string `'bad'`. Spec requires rejection with HTTP 400 `{ error: 'Review text must be a string' }`. |
| 12 | `POST /api/books/:isbn/reviews` | `{ rating: 5, text: { body: 'text' } }` (object text) | Coerces to string `'[object Object]'`. Spec requires rejection with HTTP 400 `{ error: 'Review text must be a string' }`. |
| 13 | `POST /api/books/:isbn/reviews` | `{ rating: 5, text: 'a'.repeat(5000) }` | Accepted with HTTP 201 Created (exactly at 5000 character boundary). |
| 14 | `POST /api/books/:isbn/reviews` | `{ rating: 5, text: 'a'.repeat(5001) }` | Rejected with HTTP 400 `{ error: 'Review text cannot exceed 5000 characters' }`. |
| 15 | `POST /api/books/:isbn/reviews` | `req.body === undefined` (no body / bad Content-Type) | Throws TypeError in Iteration 1. Spec requires safe fallback `req.body || {}` returning HTTP 400 `{ error: 'Rating must be an integer between 1 and 5' }`. |
| 16 | `PUT /api/me/shelf/:isbn` | `req.body === undefined` (no body / bad Content-Type) | Throws TypeError in Iteration 1 leading to HTTP 500. Spec requires safe fallback `const { status } = req.body || {}` returning HTTP 400. |
| 17 | `PUT /api/me/shelf/:isbn` | `{ status: 'WANT_TO_READ' }` (uppercase enum) | Rejected with HTTP 400 `{ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' }`. |
| 18 | `PUT /api/me/shelf/:isbn` | `{ status: 'read ' }` (trailing space) | Rejected with HTTP 400 `{ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' }`. |
| 19 | `PUT /api/me/shelf/:isbn` | `{ status: null }` | Rejected with HTTP 400 `{ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' }`. |
| 20 | `PUT /api/me/shelf/:isbn` | Unknown ISBN `9999999999999` | Rejected with HTTP 404 `{ error: 'Book not found' }`. |
| 21 | `DELETE /api/reviews/:id` | Invalid ObjectId string `'not-a-mongo-id'` | Rejected with HTTP 400 `{ error: 'Invalid review ID' }`. |
| 22 | `DELETE /api/reviews/:id` | Valid ObjectId belonging to another user | Rejected with HTTP 403 `{ error: 'You do not have permission to delete this review' }`. |
