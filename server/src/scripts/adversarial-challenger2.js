// Empirical Challenger 2 Adversarial Stress Suite for Milestone 1 Iteration 2
// Rigorously tests:
// 1. Multi-User Isolation & IDOR Attacks (User B deleting User A review -> 403, shelf isolation, 404/400 review IDs)
// 2. Settings Independence (reset-books clears shelves & keeps reviews; delete-reviews deletes reviews & keeps shelves)
// 3. Token & Header Robustness (401 on protected routes, 200 with userReview: null on public route with bad/expired tokens)
// 4. Malformed BSON injection defenses
// 5. Multi-User Community Stream Isolation

import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { JWT_SECRET } from '../auth.js';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5050/api';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name} ${details}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name} ${details}`);
    failed++;
    failures.push({ name, details });
  }
}

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token !== undefined) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }
  const opts = {
    method,
    headers: reqHeaders,
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return {
    status: res.status,
    headers: res.headers,
    body: json,
  };
}

// Generate unique test user
async function createTestUser(prefix = 'user') {
  const suffix = Math.random().toString(36).substring(2, 9);
  const username = `${prefix}_${suffix}`;
  const password = 'Password123!';
  const res = await api('/auth/signup', {
    method: 'POST',
    body: { username, password, displayName: `Test ${prefix}` },
  });
  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(res.body)}`);
  }
  return {
    user: res.body.user,
    token: res.body.token,
    username,
    password,
  };
}

console.log('======================================================================');
console.log('      EMPIRICAL CHALLENGER 2: ADVERSARIAL ISOLATION & IDOR SUITE      ');
console.log('======================================================================\n');

async function run() {
  // Check live API server connectivity
  try {
    const health = await api('/health');
    assert.strictEqual(health.status, 200, 'Live API server must be responsive');
    console.log('Connected to live API server at', BASE_URL, 'Health:', health.body?.ok);
  } catch (err) {
    console.error('Cannot connect to live server at', BASE_URL, 'Error:', err.message);
    process.exit(1);
  }

  const BOOK_A = '0439136350'; // Harry Potter (valid in Books.csv)
  const BOOK_B = '0345339681'; // The Hobbit (valid in Books.csv)
  const BOOK_C = '0441172660'; // Dune (valid in Books.csv)
  const BOOK_D = '0451524934'; // 1984 (valid in Books.csv)
  const BOOK_E = '0385504209'; // The Da Vinci Code (valid in Books.csv)

  // =========================================================================
  // SUITE 1: Multi-User Isolation & IDOR Attacks
  // =========================================================================
  console.log('\n--- SUITE 1: Multi-User Isolation & IDOR Attacks ---');

  const userA = await createTestUser('alice');
  const userB = await createTestUser('bob');
  console.log(`Created test users: User A (${userA.username}), User B (${userB.username})`);

  // 1.1 User A posts a review for BOOK_A
  const postReviewRes = await api(`/books/${BOOK_A}/reviews`, {
    method: 'POST',
    token: userA.token,
    body: { rating: 5, text: 'Fantastic masterpiece by Alice' },
  });
  check('User A can post a review (HTTP 201)', postReviewRes.status === 201, `got status ${postReviewRes.status}`);
  const reviewA = postReviewRes.body?.review;
  assert.ok(reviewA?._id, 'Review A must have an _id');
  const reviewAId = reviewA._id;

  // 1.2 User B attempts to DELETE User A's review -> MUST return HTTP 403 Forbidden
  const idorDeleteRes = await api(`/reviews/${reviewAId}`, {
    method: 'DELETE',
    token: userB.token,
  });
  check(
    'User B DELETE User A review returns HTTP 403 Forbidden',
    idorDeleteRes.status === 403,
    `got status ${idorDeleteRes.status} (body: ${JSON.stringify(idorDeleteRes.body)})`
  );
  check(
    'IDOR rejection returns explicit error message',
    idorDeleteRes.body?.error === 'You do not have permission to delete this review',
    `got message: ${idorDeleteRes.body?.error}`
  );

  // 1.3 Ghost user (valid JWT with non-existent user ID) attempts to DELETE User A's review -> MUST return HTTP 403 Forbidden
  const ghostToken = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), u: 'ghost_user' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const ghostIdorRes = await api(`/reviews/${reviewAId}`, {
    method: 'DELETE',
    token: ghostToken,
  });
  check(
    'Ghost user DELETE User A review returns HTTP 403 Forbidden',
    ghostIdorRes.status === 403,
    `got status ${ghostIdorRes.status}`
  );

  // 1.4 Verify User A's review is STILL present and intact
  const verifyReviewRes = await api(`/books/${BOOK_A}/reviews`, { token: userA.token });
  check('Review still exists after IDOR attacks', verifyReviewRes.status === 200 && verifyReviewRes.body.totalReviews >= 1);
  const foundRev = verifyReviewRes.body.reviews.find((r) => r._id === reviewAId);
  check('User A review intact with rating 5', foundRev && foundRev.rating === 5 && foundRev.text.includes('Alice'));

  // 1.5 Non-existent Review ID -> HTTP 404
  const randomValidObjectId = new mongoose.Types.ObjectId().toString();
  const nonExistentDeleteRes = await api(`/reviews/${randomValidObjectId}`, {
    method: 'DELETE',
    token: userA.token,
  });
  check(
    'DELETE non-existent review ID returns HTTP 404',
    nonExistentDeleteRes.status === 404,
    `got status ${nonExistentDeleteRes.status}`
  );
  check(
    '404 response body has "Review not found"',
    nonExistentDeleteRes.body?.error === 'Review not found'
  );

  // 1.6 Malformed Review IDs -> HTTP 400
  const malformedIds = [
    'not-a-valid-id',
    '12345',
    'undefined',
    'null',
    'zzzzzzzzzzzzzzzzzzzzzzzz', // 24 chars but non-hex
    '507f1f77bcf86cd79943901',   // 23 chars (too short)
    '507f1f77bcf86cd7994390111', // 25 chars (too long)
    '../etc/passwd',
  ];
  for (const badId of malformedIds) {
    const res = await api(`/reviews/${encodeURIComponent(badId)}`, {
      method: 'DELETE',
      token: userA.token,
    });
    check(
      `DELETE malformed ID "${badId}" returns HTTP 400`,
      res.status === 400,
      `got status ${res.status} (body: ${JSON.stringify(res.body)})`
    );
  }

  // 1.7 User B attempts to mutate shelves while User A has shelves populated
  // Setup User A shelves:
  await api(`/me/shelf/${BOOK_B}`, { method: 'PUT', token: userA.token, body: { status: 'want_to_read' } });
  await api(`/me/shelf/${BOOK_C}`, { method: 'PUT', token: userA.token, body: { status: 'currently_reading' } });
  // BOOK_A was already auto-shelved to 'read' by review submission
  await api('/me/favorites', {
    method: 'PUT',
    token: userA.token,
    body: { isbns: [BOOK_A, BOOK_B, BOOK_C] },
  });

  // Verify User A shelves before User B actions
  const userAShelvesBefore = await api('/me/shelves', { token: userA.token });
  const aWantBefore = userAShelvesBefore.body.wantToRead.map((b) => b.isbn);
  const aCurrBefore = userAShelvesBefore.body.currentlyReading.map((b) => b.isbn);
  const aReadBefore = userAShelvesBefore.body.read.map((b) => b.isbn);
  const aFavBefore = userAShelvesBefore.body.favorites.map((b) => b.isbn);

  check('User A shelves established correctly',
    aWantBefore.includes(BOOK_B) && aCurrBefore.includes(BOOK_C) && aReadBefore.includes(BOOK_A) && aFavBefore.length === 3);

  // User B performs operations on the SAME books:
  // User B sets BOOK_B to 'read' (User A has it on 'want_to_read')
  await api(`/me/shelf/${BOOK_B}`, { method: 'PUT', token: userB.token, body: { status: 'read' } });
  // User B sets BOOK_C to 'want_to_read' (User A has it on 'currently_reading')
  await api(`/me/shelf/${BOOK_C}`, { method: 'PUT', token: userB.token, body: { status: 'want_to_read' } });
  // User B sets BOOK_A to 'none'
  await api(`/me/shelf/${BOOK_A}`, { method: 'PUT', token: userB.token, body: { status: 'none' } });
  // User B resets their books
  await api('/me/reset-books', { method: 'POST', token: userB.token });
  // User B deletes their reviews
  await api('/me/reviews', { method: 'DELETE', token: userB.token });

  // Re-fetch User A shelves after User B actions
  const userAShelvesAfter = await api('/me/shelves', { token: userA.token });
  const aWantAfter = userAShelvesAfter.body.wantToRead.map((b) => b.isbn);
  const aCurrAfter = userAShelvesAfter.body.currentlyReading.map((b) => b.isbn);
  const aReadAfter = userAShelvesAfter.body.read.map((b) => b.isbn);
  const aFavAfter = userAShelvesAfter.body.favorites.map((b) => b.isbn);

  check('User A wantToRead completely unaffected by User B',
    JSON.stringify(aWantAfter) === JSON.stringify(aWantBefore));
  check('User A currentlyReading completely unaffected by User B',
    JSON.stringify(aCurrAfter) === JSON.stringify(aCurrBefore));
  check('User A read shelf completely unaffected by User B',
    JSON.stringify(aReadAfter) === JSON.stringify(aReadBefore));
  check('User A favorites completely unaffected by User B',
    JSON.stringify(aFavAfter) === JSON.stringify(aFavBefore));

  // 1.8 User A deletes own review -> HTTP 204 No Content
  const ownDeleteRes = await api(`/reviews/${reviewAId}`, {
    method: 'DELETE',
    token: userA.token,
  });
  check('User A deleting own review returns HTTP 204 No Content', ownDeleteRes.status === 204, `got status ${ownDeleteRes.status}`);

  // 1.9 Verify review is now deleted
  const verifyDeletedRes = await api(`/reviews/${reviewAId}`, {
    method: 'DELETE',
    token: userA.token,
  });
  check('Subsequent DELETE of deleted review returns HTTP 404', verifyDeletedRes.status === 404, `got status ${verifyDeletedRes.status}`);

  // =========================================================================
  // SUITE 2: Settings Independence
  // =========================================================================
  console.log('\n--- SUITE 2: Settings Independence ---');

  const userSettings = await createTestUser('charlie');

  // Setup: User adds books to shelves and writes 2 reviews
  await api(`/me/shelf/${BOOK_B}`, { method: 'PUT', token: userSettings.token, body: { status: 'want_to_read' } });
  await api(`/me/shelf/${BOOK_C}`, { method: 'PUT', token: userSettings.token, body: { status: 'currently_reading' } });
  await api('/me/favorites', {
    method: 'PUT',
    token: userSettings.token,
    body: { isbns: [BOOK_A, BOOK_B, BOOK_C] },
  });

  // Post 2 reviews (BOOK_D and BOOK_E, which also auto-adds them to 'read' shelf)
  const rev1 = await api(`/books/${BOOK_D}/reviews`, {
    method: 'POST',
    token: userSettings.token,
    body: { rating: 4, text: 'Review for Book D' },
  });
  const rev2 = await api(`/books/${BOOK_E}/reviews`, {
    method: 'POST',
    token: userSettings.token,
    body: { rating: 5, text: 'Review for Book E' },
  });
  assert.strictEqual(rev1.status, 201);
  assert.strictEqual(rev2.status, 201);

  // Check initial state: 2 reviews, all 4 shelves populated
  const preReviews = await api('/me/reviews', { token: userSettings.token });
  const preShelves = await api('/me/shelves', { token: userSettings.token });
  check('Charlie has 2 initial reviews', preReviews.body.total === 2);
  check('Charlie has populated wantToRead', preShelves.body.wantToRead.length > 0);
  check('Charlie has populated currentlyReading', preShelves.body.currentlyReading.length > 0);
  check('Charlie has populated read', preShelves.body.read.length >= 2);
  check('Charlie has populated favorites', preShelves.body.favorites.length === 3);

  // 2.1 POST /api/me/reset-books clears shelves to [] while PRESERVING all reviews
  console.log('\n[2.1] Executing POST /api/me/reset-books...');
  const resetRes = await api('/me/reset-books', { method: 'POST', token: userSettings.token });
  check('POST /api/me/reset-books returns HTTP 200', resetRes.status === 200, `got status ${resetRes.status}`);
  check('reset-books response returns empty shelves',
    resetRes.body.shelves.wantToRead.length === 0 &&
    resetRes.body.shelves.currentlyReading.length === 0 &&
    resetRes.body.shelves.read.length === 0 &&
    resetRes.body.shelves.favorites.length === 0);

  // Verify shelves via GET /me/shelves
  const postResetShelves = await api('/me/shelves', { token: userSettings.token });
  check('GET /me/shelves confirmed wantToRead is empty []', postResetShelves.body.wantToRead.length === 0);
  check('GET /me/shelves confirmed currentlyReading is empty []', postResetShelves.body.currentlyReading.length === 0);
  check('GET /me/shelves confirmed read is empty []', postResetShelves.body.read.length === 0);
  check('GET /me/shelves confirmed favorites is empty []', postResetShelves.body.favorites.length === 0);

  // Verify reviews STILL PRESERVED!
  const postResetReviews = await api('/me/reviews', { token: userSettings.token });
  check('POST /api/me/reset-books preserved ALL reviews (count === 2)', postResetReviews.body.total === 2, `got ${postResetReviews.body.total}`);
  const reviewIsbns = postResetReviews.body.reviews.map((r) => r.isbn);
  check('Preserved reviews contain BOOK_D and BOOK_E', reviewIsbns.includes(BOOK_D) && reviewIsbns.includes(BOOK_E));

  // 2.2 Re-populate shelves, then test DELETE /api/me/reviews
  console.log('\n[2.2] Re-populating shelves and executing DELETE /api/me/reviews...');
  await api(`/me/shelf/${BOOK_B}`, { method: 'PUT', token: userSettings.token, body: { status: 'want_to_read' } });
  await api(`/me/shelf/${BOOK_C}`, { method: 'PUT', token: userSettings.token, body: { status: 'currently_reading' } });
  await api(`/me/shelf/${BOOK_A}`, { method: 'PUT', token: userSettings.token, body: { status: 'read' } });
  await api('/me/favorites', {
    method: 'PUT',
    token: userSettings.token,
    body: { isbns: [BOOK_A, BOOK_B, BOOK_C] },
  });

  const repopShelves = await api('/me/shelves', { token: userSettings.token });
  assert.ok(repopShelves.body.wantToRead.length > 0 && repopShelves.body.favorites.length === 3);

  // DELETE /api/me/reviews
  const deleteReviewsRes = await api('/me/reviews', { method: 'DELETE', token: userSettings.token });
  check('DELETE /api/me/reviews returns HTTP 200', deleteReviewsRes.status === 200, `got status ${deleteReviewsRes.status}`);
  check('DELETE /api/me/reviews deletedCount is 2', deleteReviewsRes.body.deletedCount === 2, `got ${deleteReviewsRes.body.deletedCount}`);

  // Verify reviews are now 0
  const postDeleteReviews = await api('/me/reviews', { token: userSettings.token });
  check('GET /me/reviews confirmed reviews deleted (count === 0)', postDeleteReviews.body.total === 0, `got ${postDeleteReviews.body.total}`);

  // Verify shelves PRESERVED completely
  const postDeleteShelves = await api('/me/shelves', { token: userSettings.token });
  check('DELETE /api/me/reviews preserved wantToRead shelf',
    postDeleteShelves.body.wantToRead.map((b) => b.isbn).includes(BOOK_B));
  check('DELETE /api/me/reviews preserved currentlyReading shelf',
    postDeleteShelves.body.currentlyReading.map((b) => b.isbn).includes(BOOK_C));
  check('DELETE /api/me/reviews preserved read shelf',
    postDeleteShelves.body.read.map((b) => b.isbn).includes(BOOK_A));
  check('DELETE /api/me/reviews preserved favorites shelf (3 books)',
    postDeleteShelves.body.favorites.length === 3);

  // =========================================================================
  // SUITE 3: Token & Header Robustness
  // =========================================================================
  console.log('\n--- SUITE 3: Token & Header Robustness ---');

  const expiredToken = jwt.sign(
    { sub: userA.user._id, u: userA.username },
    JWT_SECRET,
    { expiresIn: -10 } // Expired 10 seconds ago
  );

  const wrongSecretToken = jwt.sign(
    { sub: userA.user._id, u: userA.username },
    'completely-wrong-secret-key-123',
    { expiresIn: '1h' }
  );

  const unauthenticatedVariations = [
    { label: 'Missing Authorization header', headers: {} },
    { label: 'Empty header string', headers: { Authorization: '' } },
    { label: 'Header with "Bearer "', headers: { Authorization: 'Bearer ' } },
    { label: 'Header with "Bearer null"', headers: { Authorization: 'Bearer null' } },
    { label: 'Header with "Bearer undefined"', headers: { Authorization: 'Bearer undefined' } },
    { label: 'Header with "Basic username:pass"', headers: { Authorization: 'Basic dXNlcjpwYXNz' } },
    { label: 'Header with malformed JWT', headers: { Authorization: 'Bearer not.a.valid.jwt' } },
    { label: 'Expired JWT token', headers: { Authorization: `Bearer ${expiredToken}` } },
    { label: 'Token signed with wrong secret', headers: { Authorization: `Bearer ${wrongSecretToken}` } },
  ];

  // 3.1 Protected routes return HTTP 401 on unauthenticated requests
  const protectedEndpoints = [
    { method: 'GET', path: '/me' },
    { method: 'GET', path: '/me/shelves' },
    { method: 'PUT', path: `/me/shelf/${BOOK_A}`, body: { status: 'read' } },
    { method: 'POST', path: '/me/reset-books' },
    { method: 'POST', path: `/books/${BOOK_A}/reviews`, body: { rating: 5, text: 'Test' } },
    { method: 'DELETE', path: `/reviews/${reviewAId}` },
    { method: 'GET', path: '/me/reviews' },
    { method: 'DELETE', path: '/me/reviews' },
  ];

  console.log('\n[3.1] Testing 401 on protected routes with unauthenticated requests...');
  for (const ep of protectedEndpoints) {
    for (const uv of unauthenticatedVariations) {
      const res = await api(ep.path, {
        method: ep.method,
        body: ep.body,
        headers: uv.headers,
      });
      check(
        `${ep.method} ${ep.path} [${uv.label}] rejected with HTTP 401`,
        res.status === 401,
        `got status ${res.status}`
      );
    }
  }

  // 3.2 Public review route GET /api/books/:isbn/reviews with bad/expired tokens
  console.log('\n[3.2] Testing public review route with bad/expired tokens...');
  // First ensure there is at least one review on BOOK_D
  const testRevUser = await createTestUser('reviewer');
  await api(`/books/${BOOK_D}/reviews`, {
    method: 'POST',
    token: testRevUser.token,
    body: { rating: 4, text: 'Public test review' },
  });

  const publicVariations = [
    { label: 'No token', headers: {} },
    { label: 'Malformed token', headers: { Authorization: 'Bearer bad.token.here' } },
    { label: 'Expired token', headers: { Authorization: `Bearer ${expiredToken}` } },
    { label: 'Wrong secret token', headers: { Authorization: `Bearer ${wrongSecretToken}` } },
    { label: 'Non-existent user token', headers: { Authorization: `Bearer ${ghostToken}` } },
  ];

  for (const pv of publicVariations) {
    const res = await api(`/books/${BOOK_D}/reviews`, { headers: pv.headers });
    check(
      `GET /books/:isbn/reviews [${pv.label}] returns HTTP 200`,
      res.status === 200,
      `got status ${res.status}`
    );
    check(
      `GET /books/:isbn/reviews [${pv.label}] includes reviews array`,
      Array.isArray(res.body.reviews) && res.body.totalReviews >= 1
    );
    check(
      `GET /books/:isbn/reviews [${pv.label}] returns userReview: null`,
      res.body.userReview === null,
      `got userReview: ${JSON.stringify(res.body.userReview)}`
    );
  }

  // With reviewer's VALID token, userReview must NOT be null
  const authedPublicRes = await api(`/books/${BOOK_D}/reviews`, { token: testRevUser.token });
  check('GET /books/:isbn/reviews with valid reviewer token returns HTTP 200', authedPublicRes.status === 200);
  check('userReview is populated for review author', authedPublicRes.body.userReview !== null && authedPublicRes.body.userReview.rating === 4);

  // With another user's valid token (who hasn't reviewed BOOK_D), userReview must be null
  const nonReviewerRes = await api(`/books/${BOOK_D}/reviews`, { token: userA.token });
  check('userReview is null for authenticated non-reviewer', nonReviewerRes.body.userReview === null);

  // =========================================================================
  // SUITE 4: Malformed BSON Session Injection Attacks
  // =========================================================================
  console.log('\n--- SUITE 4: Malformed BSON Session Injection Attacks ---');

  const malformedSubTokens = [
    jwt.sign({ sub: 'not-a-valid-bson-id' }, JWT_SECRET, { expiresIn: '1h' }),
    jwt.sign({ sub: 12345 }, JWT_SECRET, { expiresIn: '1h' }),
    jwt.sign({ sub: '123' }, JWT_SECRET, { expiresIn: '1h' }),
    jwt.sign({ sub: true }, JWT_SECRET, { expiresIn: '1h' }),
  ];

  for (const [idx, badToken] of malformedSubTokens.entries()) {
    // Endpoints that use loadUser or mongoose.Types.ObjectId.isValid(req.userId)
    const testCases = [
      { method: 'GET', path: '/me' },
      { method: 'GET', path: '/me/reviews' },
      { method: 'DELETE', path: '/me/reviews' },
      { method: 'POST', path: '/me/reset-books' },
      { method: 'PUT', path: `/me/shelf/${BOOK_A}`, body: { status: 'read' } },
    ];
    for (const tc of testCases) {
      const res = await api(tc.path, {
        method: tc.method,
        body: tc.body,
        headers: { Authorization: `Bearer ${badToken}` },
      });
      check(
        `BSON injection #${idx} on ${tc.method} ${tc.path} returns clean HTTP 401 (not 500)`,
        res.status === 401,
        `got status ${res.status}`
      );
    }
  }

  // =========================================================================
  // SUITE 5: Multi-User Concurrent Review Mutation & Community Stream Integrity
  // =========================================================================
  console.log('\n--- SUITE 5: Multi-User Community Stream Isolation ---');

  const TARGET_BOOK = '0142001740'; // The Secret Life of Bees
  const multiUsers = await Promise.all([
    createTestUser('star1'),
    createTestUser('star2'),
    createTestUser('star3'),
    createTestUser('star4'),
    createTestUser('star5'),
  ]);

  // Clean any previous reviews for TARGET_BOOK by these users
  for (const u of multiUsers) {
    await api('/me/reviews', { method: 'DELETE', token: u.token });
  }

  // Submit 5 reviews concurrently with ratings 1, 2, 3, 4, 5
  await Promise.all(
    multiUsers.map((u, i) =>
      api(`/books/${TARGET_BOOK}/reviews`, {
        method: 'POST',
        token: u.token,
        body: { rating: i + 1, text: `Review with rating ${i + 1} by ${u.username}` },
      })
    )
  );

  // Fetch community reviews stream
  const commRes = await api(`/books/${TARGET_BOOK}/reviews`);
  check('Community reviews stream returns HTTP 200', commRes.status === 200);
  check('Community totalReviews is 5', commRes.body.totalReviews === 5, `got ${commRes.body.totalReviews}`);
  check('Community averageRating is 3.0', commRes.body.averageRating === 3.0, `got ${commRes.body.averageRating}`);
  for (let s = 1; s <= 5; s++) {
    check(`Rating distribution bucket ${s} has count 1`, commRes.body.ratingDistribution[s] === 1);
  }

  // Verify each user sees their own userReview
  for (let i = 0; i < multiUsers.length; i++) {
    const u = multiUsers[i];
    const uRes = await api(`/books/${TARGET_BOOK}/reviews`, { token: u.token });
    check(
      `User ${u.username} sees own review with rating ${i + 1}`,
      uRes.body.userReview?.rating === i + 1 && uRes.body.userReview?.username === u.username
    );
  }

  // User 0 deletes their reviews via DELETE /me/reviews
  const delUser0 = await api('/me/reviews', { method: 'DELETE', token: multiUsers[0].token });
  check('User 0 deleted own reviews successfully', delUser0.status === 200 && delUser0.body.deletedCount === 1);

  // Verify community stream updated correctly: 4 reviews remain, rating 1 is gone
  const commAfterDel = await api(`/books/${TARGET_BOOK}/reviews`);
  check('Community totalReviews updated to 4', commAfterDel.body.totalReviews === 4, `got ${commAfterDel.body.totalReviews}`);
  check('Rating 1 bucket is now 0', commAfterDel.body.ratingDistribution[1] === 0);
  check('Average rating updated to (2+3+4+5)/4 = 3.5', commAfterDel.body.averageRating === 3.5, `got ${commAfterDel.body.averageRating}`);

  // Remaining users' reviews intact
  for (let i = 1; i < multiUsers.length; i++) {
    const u = multiUsers[i];
    const uRes = await api(`/books/${TARGET_BOOK}/reviews`, { token: u.token });
    check(`User ${u.username} review still intact after peer deletion`, uRes.body.userReview?.rating === i + 1);
  }

  // Clean up test reviews
  for (const u of multiUsers) {
    await api('/me/reviews', { method: 'DELETE', token: u.token });
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} checks passed, ${failed} checks failed.`);
  console.log('======================================================================\n');

  if (failed > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`  ❌ ${f.name} ${f.details}`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error running challenger suite:', err);
  process.exit(1);
});
