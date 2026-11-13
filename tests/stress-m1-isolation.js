/**
 * Challenger 2 Adversarial Stress Test Suite:
 * Multi-User Isolation, IDOR Protection, Settings Independence & Auth Boundaries
 * 
 * Target: http://127.0.0.1:5050/api
 */

import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5050/api';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    testsFailed++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function req(method, path, body = null, token = null) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let reqBody = null;
  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    reqBody = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path.startsWith('/') ? path : '/' + path}`, {
    method,
    headers,
    body: reqBody,
    signal: AbortSignal.timeout(10000),
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (res.status !== 204) {
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  }
  return { status: res.status, ok: res.ok, body: data, headers: res.headers };
}

function randId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function registerUser(prefix) {
  const username = `${prefix}_${randId()}`.slice(0, 30);
  const password = 'Password123!';
  const res = await req('POST', '/auth/signup', {
    username,
    password,
    displayName: `${prefix.toUpperCase()} Display`,
  });
  assert.strictEqual(res.status, 201, `Failed to create user ${username}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.token, 'Signup did not return token');
  return { username, password, token: res.body.token, user: res.body.user };
}

console.log('======================================================================');
console.log('  CHALLENGER 2: EMPIRICAL MULTI-USER ISOLATION & IDOR STRESS SUITE');
console.log(`  Target API: ${BASE}`);
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// SECTION 1: Multi-User Isolation & IDOR Attacks
// ---------------------------------------------------------------------------
console.log('▶ SECTION 1: Multi-User Isolation & IDOR Attacks');

let userA;
let userB;
let userAReview1Id;
let userAReview2Id;
const ISBN_1 = '0439136350'; // Harry Potter and the Prisoner of Azkaban
const ISBN_2 = '0345339681'; // The Hobbit
const ISBN_3 = '0385504209'; // The Da Vinci Code
const ISBN_4 = '0441172660'; // Dune

await test('1.1 Create distinct User A and User B', async () => {
  userA = await registerUser('usra');
  userB = await registerUser('usrb');
  assert.notStrictEqual(userA.username, userB.username);
  assert.notStrictEqual(userA.token, userB.token);
  assert.notStrictEqual(userA.user.id, userB.user.id);
});

await test('1.2 User A shelves books and posts reviews', async () => {
  // Shelf Book 1 to want_to_read
  const s1 = await req('PUT', `/me/shelf/${ISBN_1}`, { status: 'want_to_read' }, userA.token);
  assert.strictEqual(s1.status, 200, `Expected 200 for shelf 1: ${JSON.stringify(s1.body)}`);

  // Shelf Book 2 to currently_reading
  const s2 = await req('PUT', `/me/shelf/${ISBN_2}`, { status: 'currently_reading' }, userA.token);
  assert.strictEqual(s2.status, 200, `Expected 200 for shelf 2: ${JSON.stringify(s2.body)}`);

  // Post Review 1 for Book 3 (rating 5)
  const r1 = await req('POST', `/books/${ISBN_3}/reviews`, { rating: 5, text: 'User A says: A masterpiece!' }, userA.token);
  assert.strictEqual(r1.status, 201, `Expected 201 for review 1: ${JSON.stringify(r1.body)}`);
  assert.ok(r1.body.review?._id, 'Review 1 missing _id');
  userAReview1Id = r1.body.review._id;

  // Post Review 2 for Book 4 (rating 4)
  const r2 = await req('POST', `/books/${ISBN_4}/reviews`, { rating: 4, text: 'User A says: Great sci-fi!' }, userA.token);
  assert.strictEqual(r2.status, 201, `Expected 201 for review 2: ${JSON.stringify(r2.body)}`);
  assert.ok(r2.body.review?._id, 'Review 2 missing _id');
  userAReview2Id = r2.body.review._id;

  // Verify User A profile reflects shelves
  const meA = await req('GET', '/me', null, userA.token);
  assert.strictEqual(meA.status, 200);
  assert.ok(meA.body.user.wantToRead.includes(ISBN_1));
  assert.ok(meA.body.user.currentlyReading.includes(ISBN_2));
  assert.ok(meA.body.user.read.includes(ISBN_3));
  assert.ok(meA.body.user.read.includes(ISBN_4));
});

await test('1.3 User B attempts IDOR delete on User A review via DELETE /api/reviews/:id -> Expect 403 Forbidden', async () => {
  const attackRes = await req('DELETE', `/reviews/${userAReview1Id}`, null, userB.token);
  assert.strictEqual(attackRes.status, 403, `Expected 403 Forbidden on IDOR review delete, got ${attackRes.status}: ${JSON.stringify(attackRes.body)}`);
});

await test('1.4 Verify User A review 1 still exists after User B attack', async () => {
  const pubRes = await req('GET', `/books/${ISBN_3}/reviews`);
  assert.strictEqual(pubRes.status, 200);
  const found = pubRes.body.reviews.some((r) => String(r._id) === String(userAReview1Id));
  assert.ok(found, `User A review ${userAReview1Id} was deleted or missing after IDOR attack`);

  const meReviewsA = await req('GET', '/me/reviews', null, userA.token);
  assert.strictEqual(meReviewsA.status, 200);
  const foundInMe = meReviewsA.body.reviews.some((r) => String(r._id) === String(userAReview1Id));
  assert.ok(foundInMe, 'Review not found in User A /me/reviews');
});

await test('1.5 User B attempts to access/mutate User A shelves using User B token -> User A shelves completely unaffected', async () => {
  // Check User B initial shelves are empty
  const meBBefore = await req('GET', '/me', null, userB.token);
  assert.strictEqual(meBBefore.status, 200);
  assert.strictEqual(meBBefore.body.user.wantToRead.length, 0);
  assert.strictEqual(meBBefore.body.user.currentlyReading.length, 0);
  assert.strictEqual(meBBefore.body.user.read.length, 0);

  // User B sets ISBN_1 to 'read' on User B's account
  const bShelfRes = await req('PUT', `/me/shelf/${ISBN_1}`, { status: 'read' }, userB.token);
  assert.strictEqual(bShelfRes.status, 200);
  assert.ok(bShelfRes.body.shelves.read.includes(ISBN_1));

  // Verify User A shelves are 100% UNTOUCHED
  const meAAfter = await req('GET', '/me', null, userA.token);
  assert.strictEqual(meAAfter.status, 200);
  // ISBN_1 must STILL be in User A's wantToRead, NOT read
  assert.ok(meAAfter.body.user.wantToRead.includes(ISBN_1), 'User A wantToRead was mutated by User B!');
  assert.ok(!meAAfter.body.user.read.includes(ISBN_1), 'User A read was contaminated by User B!');
  assert.ok(meAAfter.body.user.currentlyReading.includes(ISBN_2), 'User A currentlyReading was affected!');
});

await test('1.6 Test invalid ObjectId on DELETE /api/reviews/:id (e.g. not-an-id) -> Expect 400 or 404, NEVER 500', async () => {
  const invalidIds = [
    'not-an-id',
    '123',
    'null',
    'undefined',
    'undefined-id-value',
    '507f1f77bcf86cd79943901z', // 24 chars but invalid hex 'z'
    '; drop table reviews;--',
    '<script>alert(1)</script>',
  ];

  for (const inv of invalidIds) {
    const res = await req('DELETE', `/reviews/${encodeURIComponent(inv)}`, null, userA.token);
    assert.ok(
      [400, 404].includes(res.status),
      `DELETE /reviews/${inv} returned HTTP ${res.status} (expected 400 or 404, never 500): ${JSON.stringify(res.body)}`
    );
    assert.notStrictEqual(res.status, 500, `Server crashed with 500 on invalid ObjectId '${inv}'`);
  }
});

await test('1.7 Test non-existent valid ObjectId on DELETE /api/reviews/:id -> Expect 404', async () => {
  const nonExistentValidObjectId = '507f1f77bcf86cd799439011';
  const res = await req('DELETE', `/reviews/${nonExistentValidObjectId}`, null, userA.token);
  assert.strictEqual(res.status, 404, `Expected 404 for non-existent review ID, got ${res.status}: ${JSON.stringify(res.body)}`);
});

// ---------------------------------------------------------------------------
// SECTION 2: Settings Independence Stress Test
// ---------------------------------------------------------------------------
console.log('\n▶ SECTION 2: Settings Independence Stress Test');

let userC;
const C_BOOK_1 = '059035342X'; // Harry Potter and the Sorcerer's Stone
const C_BOOK_2 = '0446310786'; // To Kill a Mockingbird
const C_BOOK_3 = '0451524934'; // 1984

await test('2.1 Setup User C with 3 books shelved and 3 reviews posted', async () => {
  userC = await registerUser('usrc');

  // Add 3 books to shelves
  await req('PUT', `/me/shelf/${C_BOOK_1}`, { status: 'want_to_read' }, userC.token);
  await req('PUT', `/me/shelf/${C_BOOK_2}`, { status: 'currently_reading' }, userC.token);
  await req('PUT', `/me/shelf/${C_BOOK_3}`, { status: 'read' }, userC.token);

  // Submit 3 reviews
  const r1 = await req('POST', `/books/${C_BOOK_1}/reviews`, { rating: 5, text: 'Loved book 1!' }, userC.token);
  const r2 = await req('POST', `/books/${C_BOOK_2}/reviews`, { rating: 4, text: 'Great classic book 2!' }, userC.token);
  const r3 = await req('POST', `/books/${C_BOOK_3}/reviews`, { rating: 5, text: 'Essential reading book 3!' }, userC.token);

  assert.strictEqual(r1.status, 201);
  assert.strictEqual(r2.status, 201);
  assert.strictEqual(r3.status, 201);

  // Verify User C has reviews
  const revsBefore = await req('GET', '/me/reviews', null, userC.token);
  assert.strictEqual(revsBefore.status, 200);
  assert.strictEqual(revsBefore.body.reviews.length, 3, 'User C should have exactly 3 reviews');

  // Verify User C has books on shelves
  const meBefore = await req('GET', '/me', null, userC.token);
  assert.strictEqual(meBefore.status, 200);
  const totalShelved = meBefore.body.user.wantToRead.length +
                       meBefore.body.user.currentlyReading.length +
                       meBefore.body.user.read.length;
  assert.ok(totalShelved >= 3, `Expected at least 3 shelved books, found ${totalShelved}`);
});

await test('2.2 User C calls POST /api/me/reset-books -> Shelves empty, all 3 reviews remain intact', async () => {
  const resetRes = await req('POST', '/me/reset-books', {}, userC.token);
  assert.strictEqual(resetRes.status, 200, `POST /me/reset-books failed: ${JSON.stringify(resetRes.body)}`);
  assert.strictEqual(resetRes.body.success, true);
  assert.deepStrictEqual(resetRes.body.shelves.wantToRead, []);
  assert.deepStrictEqual(resetRes.body.shelves.currentlyReading, []);
  assert.deepStrictEqual(resetRes.body.shelves.read, []);
  assert.deepStrictEqual(resetRes.body.shelves.favorites, []);

  // Verify GET /me returns completely empty shelves
  const meAfterReset = await req('GET', '/me', null, userC.token);
  assert.strictEqual(meAfterReset.status, 200);
  assert.deepStrictEqual(meAfterReset.body.user.wantToRead, []);
  assert.deepStrictEqual(meAfterReset.body.user.currentlyReading, []);
  assert.deepStrictEqual(meAfterReset.body.user.read, []);
  assert.deepStrictEqual(meAfterReset.body.user.favorites, []);

  // Verify GET /me/shelves returns empty populated lists
  const shelvesAfterReset = await req('GET', '/me/shelves', null, userC.token);
  assert.strictEqual(shelvesAfterReset.status, 200);
  assert.deepStrictEqual(shelvesAfterReset.body.wantToRead, []);
  assert.deepStrictEqual(shelvesAfterReset.body.currentlyReading, []);
  assert.deepStrictEqual(shelvesAfterReset.body.read, []);
  assert.deepStrictEqual(shelvesAfterReset.body.favorites, []);

  // CRITICAL CHECK: All 3 reviews remain intact in database!
  const revsAfterReset = await req('GET', '/me/reviews', null, userC.token);
  assert.strictEqual(revsAfterReset.status, 200);
  assert.strictEqual(revsAfterReset.body.reviews.length, 3, 'Reviews were lost when reset-books was called!');
  const reviewIsbns = revsAfterReset.body.reviews.map((r) => r.isbn);
  assert.ok(reviewIsbns.includes(C_BOOK_1), `Review for ${C_BOOK_1} missing`);
  assert.ok(reviewIsbns.includes(C_BOOK_2), `Review for ${C_BOOK_2} missing`);
  assert.ok(reviewIsbns.includes(C_BOOK_3), `Review for ${C_BOOK_3} missing`);
});

await test('2.3 User C shelves new books, then calls DELETE /api/me/reviews -> Reviews deleted, shelves intact', async () => {
  // Add a book to shelf
  await req('PUT', `/me/shelf/${C_BOOK_1}`, { status: 'want_to_read' }, userC.token);
  await req('PUT', `/me/shelf/${C_BOOK_2}`, { status: 'currently_reading' }, userC.token);

  // Verify shelves populated before review delete
  const meBeforeDel = await req('GET', '/me', null, userC.token);
  assert.ok(meBeforeDel.body.user.wantToRead.includes(C_BOOK_1));
  assert.ok(meBeforeDel.body.user.currentlyReading.includes(C_BOOK_2));

  // Call DELETE /api/me/reviews
  const delRevsRes = await req('DELETE', '/me/reviews', null, userC.token);
  assert.strictEqual(delRevsRes.status, 200, `DELETE /me/reviews failed: ${JSON.stringify(delRevsRes.body)}`);
  assert.strictEqual(delRevsRes.body.success, true);
  assert.strictEqual(delRevsRes.body.deletedCount, 3, `Expected deletedCount to be 3, got ${delRevsRes.body.deletedCount}`);

  // Verify reviews are now deleted
  const revsAfterDel = await req('GET', '/me/reviews', null, userC.token);
  assert.strictEqual(revsAfterDel.status, 200);
  assert.strictEqual(revsAfterDel.body.reviews.length, 0, 'Reviews list not empty after DELETE /me/reviews');

  // Verify user account and shelf state remain completely intact!
  const meAfterDel = await req('GET', '/me', null, userC.token);
  assert.strictEqual(meAfterDel.status, 200);
  assert.strictEqual(meAfterDel.body.user.username, userC.username);
  assert.ok(meAfterDel.body.user.wantToRead.includes(C_BOOK_1), 'WantToRead shelf was wiped by DELETE /me/reviews!');
  assert.ok(meAfterDel.body.user.currentlyReading.includes(C_BOOK_2), 'CurrentlyReading shelf was wiped by DELETE /me/reviews!');
});

await test('2.4 Cross-user settings independence: User C operations do not touch User A data', async () => {
  const meA = await req('GET', '/me', null, userA.token);
  assert.strictEqual(meA.status, 200);
  assert.ok(meA.body.user.wantToRead.includes(ISBN_1));
  assert.ok(meA.body.user.read.includes(ISBN_3));

  const meARevs = await req('GET', '/me/reviews', null, userA.token);
  assert.strictEqual(meARevs.status, 200);
  assert.ok(meARevs.body.reviews.length >= 2, 'User A reviews were affected by User C settings actions!');
});

// ---------------------------------------------------------------------------
// SECTION 3: Unauthenticated & Malformed Token Access Checks
// ---------------------------------------------------------------------------
console.log('\n▶ SECTION 3: Unauthenticated & Malformed Token Access Checks');

await test('3.1 Accessing /api/me without token -> Expect 401', async () => {
  const res = await req('GET', '/me');
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.2 Accessing /api/me/shelves without token -> Expect 401', async () => {
  const res = await req('GET', '/me/shelves');
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.3 Accessing PUT /api/me/shelf/:isbn without token -> Expect 401', async () => {
  const res = await req('PUT', `/me/shelf/${ISBN_1}`, { status: 'want_to_read' });
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.4 Accessing POST /api/me/reset-books without token -> Expect 401', async () => {
  const res = await req('POST', '/me/reset-books', {});
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.5 Accessing DELETE /api/me/reviews without token -> Expect 401', async () => {
  const res = await req('DELETE', '/me/reviews');
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.6 Accessing DELETE /api/reviews/:id without token -> Expect 401', async () => {
  const res = await req('DELETE', `/reviews/${userAReview2Id}`);
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('3.7 Accessing GET /api/books/:isbn/reviews with expired or malformed token -> Expect 200, public reviews shown, userReview: null', async () => {
  // 1. Expired token (payload exp in the past)
  // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
  // Payload: {"sub":"507f1f77bcf86cd799439011","exp":1500000000} -> eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJleHAiOjE1MDAwMDAwMDB9
  // Fake signature: 0000000000000000000000000000000000000000000
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJleHAiOjE1MDAwMDAwMDB9.invalid_signature_expired';

  const resExpired = await req('GET', `/books/${ISBN_4}/reviews`, null, expiredToken);
  assert.strictEqual(resExpired.status, 200, `Expected 200 with expired token, got ${resExpired.status}`);
  assert.strictEqual(resExpired.body.userReview, null, 'userReview should be null for expired token');
  assert.ok(Array.isArray(resExpired.body.reviews), 'Expected reviews array');
  assert.ok(resExpired.body.totalReviews >= 1, 'Public reviews should be visible');

  // 2. Malformed token (garbage text)
  const malformedToken = 'this-is-not-a-valid-jwt-token-at-all';
  const resMalformed = await req('GET', `/books/${ISBN_4}/reviews`, null, malformedToken);
  assert.strictEqual(resMalformed.status, 200, `Expected 200 with malformed token, got ${resMalformed.status}`);
  assert.strictEqual(resMalformed.body.userReview, null, 'userReview should be null for malformed token');
  assert.ok(Array.isArray(resMalformed.body.reviews), 'Expected reviews array');

  // 3. Guest unauthenticated request
  const resGuest = await req('GET', `/books/${ISBN_4}/reviews`);
  assert.strictEqual(resGuest.status, 200, `Expected 200 for guest, got ${resGuest.status}`);
  assert.strictEqual(resGuest.body.userReview, null, 'userReview should be null for guest');
  assert.ok(resGuest.body.totalReviews >= 1, 'Public reviews should be visible to guest');
});

await test('3.8 Accessing protected /api/me with malformed or tampered token -> Expect 401', async () => {
  const tamperedToken = userA.token + 'corrupt';
  const res = await req('GET', '/me', null, tamperedToken);
  assert.strictEqual(res.status, 401, `Expected 401 for tampered token, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// SECTION 4: Input Validation & Boundary Stress
// ---------------------------------------------------------------------------
console.log('\n▶ SECTION 4: Input Validation & Boundary Stress');

await test('4.1 PUT /api/me/shelf/:isbn with invalid status values -> Expect 400 Bad Request', async () => {
  const badStatuses = ['reading', 'finished', 'wishlist', '', null, 123, false, 'WANT_TO_READ'];
  for (const status of badStatuses) {
    const res = await req('PUT', `/me/shelf/${ISBN_1}`, { status }, userA.token);
    assert.strictEqual(res.status, 400, `Expected 400 for status '${status}', got ${res.status}`);
  }
});

await test('4.2 POST /api/books/:isbn/reviews with invalid ratings -> Expect 400 Bad Request', async () => {
  const badRatings = [0, 6, -1, -5, 100, 3.5, 4.2, 'not-a-number', NaN, null, undefined];
  for (const rating of badRatings) {
    const res = await req('POST', `/books/${ISBN_1}/reviews`, { rating, text: 'Test' }, userA.token);
    assert.strictEqual(res.status, 400, `Expected 400 for rating '${rating}', got ${res.status}: ${JSON.stringify(res.body)}`);
  }
});

await test('4.3 POST /api/books/:isbn/reviews with text > 5000 characters -> Expect 400 Bad Request', async () => {
  const excessiveText = 'A'.repeat(5001);
  const res = await req('POST', `/books/${ISBN_1}/reviews`, { rating: 5, text: excessiveText }, userA.token);
  assert.strictEqual(res.status, 400, `Expected 400 for text length 5001, got ${res.status}`);
});

await test('4.4 Review upsert idempotency: Submitting review again for same ISBN updates rather than duplicating', async () => {
  // First submission
  const res1 = await req('POST', `/books/${ISBN_1}/reviews`, { rating: 3, text: 'First draft' }, userA.token);
  assert.strictEqual(res1.status, 201);
  const id1 = res1.body.review._id;

  // Second submission for same ISBN
  const res2 = await req('POST', `/books/${ISBN_1}/reviews`, { rating: 5, text: 'Updated draft: changed mind!' }, userA.token);
  assert.strictEqual(res2.status, 201);
  const id2 = res2.body.review._id;

  assert.strictEqual(String(id1), String(id2), 'Upsert should update existing review ID, not create a new duplicate review');

  // Verify in public reviews list that only ONE review exists for userA
  const pubRes = await req('GET', `/books/${ISBN_1}/reviews`);
  assert.strictEqual(pubRes.status, 200);
  const userAReviews = pubRes.body.reviews.filter((r) => String(r.userId) === String(userA.user.id));
  assert.strictEqual(userAReviews.length, 1, `Found ${userAReviews.length} reviews for userA on same book; expected exactly 1`);
  assert.strictEqual(userAReviews[0].rating, 5);
  assert.strictEqual(userAReviews[0].text, 'Updated draft: changed mind!');
});

await test('4.5 Type Coercion Edge Cases: Test boolean true/false in rating', async () => {
  // Number(true) === 1, Number(false) === 0
  const resFalse = await req('POST', `/books/${ISBN_1}/reviews`, { rating: false, text: 'False rating' }, userA.token);
  assert.strictEqual(resFalse.status, 400, 'rating: false should be rejected with 400');
});

console.log('\n======================================================================');
console.log(`  EXECUTION SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED (Total: ${testsRun})`);
console.log('======================================================================');

if (testsFailed > 0) {
  console.error('\nFailures summary:');
  for (const f of failures) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\nAll empirical challenger stress tests PASSED successfully.');
  process.exit(0);
}
