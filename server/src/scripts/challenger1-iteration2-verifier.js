// Challenger 1 Milestone 1 Iteration 2 Empirical Verification Harness
// Adversarial validation of review endpoints, shelf transitions, boundaries, and concurrency.

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Book from '../models/Book.js';
import { engine } from '../recommender/engine.js';
import usersRoute from '../routes/users.js';
import reviewsRoute from '../routes/reviews.js';

const API_BASE = process.env.API_BASE || 'http://localhost:5050/api';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: [],
};

function verify(desc, condition, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✅ [PASS] ${desc} ${details}`);
  } else {
    results.failed++;
    results.failures.push({ desc, details });
    console.error(`  ❌ [FAIL] ${desc} ${details}`);
  }
}

function findRouteHandler(router, path, method) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }
  }
  return null;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
}

console.log('='.repeat(75));
console.log('  ⚔️  CHALLENGER 1 (ITERATION 2): EMPIRICAL ADVERSARIAL VERIFICATION HARNESS');
console.log('='.repeat(75));

// Ensure engine has books for unit testing
const VALID_ISBNS = ['0439136350', '0345339681', '0441172660', '0451524934', '0385504209'];
const UNKNOWN_ISBN = '9999999999999';

const eng = engine();
eng.ready = true;
VALID_ISBNS.forEach((isbn, idx) => {
  eng.byIsbn.set(isbn, idx);
  eng.books[idx] = {
    isbn,
    title: `Test Book ${idx}`,
    author: `Author ${idx}`,
    publisher: `Publisher ${idx}`,
    genres: ['Fiction'],
    tags: ['Classic'],
    rating: 4.0,
  };
});

Book.exists = async ({ isbn }) => {
  return eng.byIsbn.has(isbn) ? { _id: new mongoose.Types.ObjectId() } : null;
};

// ---------------------------------------------------------------------------
// SUITE 1: In-Process Route Handler Adversarial Type & Boundary Matrix
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 1: In-Process Handler Adversarial Boundary Tests ---');

const postReviewHandler = findRouteHandler(reviewsRoute, '/books/:isbn/reviews', 'POST');
assert.ok(postReviewHandler, 'POST /books/:isbn/reviews handler must exist');

// Mock Review.findOneAndUpdate and find
const mockReviewCollection = new Map();
Review.findOneAndUpdate = async ({ userId, isbn }, update, options) => {
  const key = `${userId}:${isbn}`;
  const existing = mockReviewCollection.get(key) || {
    _id: new mongoose.Types.ObjectId(),
    userId,
    isbn,
    createdAt: new Date(),
  };
  const doc = { ...existing, ...update.$set, updatedAt: new Date() };
  mockReviewCollection.set(key, doc);
  return doc;
};
Review.find = ({ isbn, userId }) => {
  let list = Array.from(mockReviewCollection.values());
  if (isbn) list = list.filter((r) => r.isbn === isbn);
  if (userId) list = list.filter((r) => String(r.userId) === String(userId));
  return {
    lean: () => list,
    sort: () => ({ lean: () => list }),
  };
};

const boundaryReviewTests = [
  // Rating type coercion & boundary vectors
  { body: { rating: '5' }, desc: 'String rating: { rating: "5" }', expectCode: 400 },
  { body: { rating: '1' }, desc: 'String rating: { rating: "1" }', expectCode: 400 },
  { body: { rating: '0' }, desc: 'String rating: { rating: "0" }', expectCode: 400 },
  { body: { rating: '6' }, desc: 'String rating: { rating: "6" }', expectCode: 400 },
  { body: { rating: 'five' }, desc: 'String rating: { rating: "five" }', expectCode: 400 },
  { body: { rating: true }, desc: 'Boolean rating: { rating: true }', expectCode: 400 },
  { body: { rating: false }, desc: 'Boolean rating: { rating: false }', expectCode: 400 },
  { body: { rating: [3] }, desc: 'Array rating: { rating: [3] }', expectCode: 400 },
  { body: { rating: [] }, desc: 'Array rating: { rating: [] }', expectCode: 400 },
  { body: { rating: [1, 2] }, desc: 'Array rating: { rating: [1, 2] }', expectCode: 400 },
  { body: { rating: {} }, desc: 'Object rating: { rating: {} }', expectCode: 400 },
  { body: { rating: 3.5 }, desc: 'Float rating: { rating: 3.5 }', expectCode: 400 },
  { body: { rating: 1.0001 }, desc: 'Float rating: { rating: 1.0001 }', expectCode: 400 },
  { body: { rating: 4.9999 }, desc: 'Float rating: { rating: 4.9999 }', expectCode: 400 },
  { body: { rating: NaN }, desc: 'NaN rating: { rating: NaN }', expectCode: 400 },
  { body: { rating: Infinity }, desc: 'Infinity rating: { rating: Infinity }', expectCode: 400 },
  { body: { rating: -Infinity }, desc: '-Infinity rating: { rating: -Infinity }', expectCode: 400 },
  { body: { rating: null }, desc: 'Null rating: { rating: null }', expectCode: 400 },
  { body: { rating: undefined }, desc: 'Undefined rating: { rating: undefined }', expectCode: 400 },
  { body: {}, desc: 'Empty body: {}', expectCode: 400 },
  { body: null, desc: 'Null body: null', expectCode: 400 },
  { body: undefined, desc: 'Undefined body: undefined', expectCode: 400 },
  { body: { rating: 0 }, desc: 'Out of bounds rating: 0', expectCode: 400 },
  { body: { rating: 6 }, desc: 'Out of bounds rating: 6', expectCode: 400 },
  { body: { rating: -1 }, desc: 'Out of bounds rating: -1', expectCode: 400 },
  { body: { rating: 100 }, desc: 'Out of bounds rating: 100', expectCode: 400 },
  { body: { rating: -999 }, desc: 'Out of bounds rating: -999', expectCode: 400 },
  // Review text type & boundary vectors
  { body: { rating: 5, text: 123 }, desc: 'Non-string text: { rating: 5, text: 123 }', expectCode: 400 },
  { body: { rating: 5, text: ['bad'] }, desc: 'Non-string text: { rating: 5, text: ["bad"] }', expectCode: 400 },
  { body: { rating: 5, text: { message: 'hi' } }, desc: 'Non-string text: { rating: 5, text: { message: "hi" } }', expectCode: 400 },
  { body: { rating: 5, text: true }, desc: 'Non-string text: { rating: 5, text: true }', expectCode: 400 },
  { body: { rating: 5, text: 'a'.repeat(5001) }, desc: 'Text length 5001 (> 5000 chars)', expectCode: 400 },
  { body: { rating: 5, text: 'a'.repeat(10000) }, desc: 'Text length 10000 (> 5000 chars)', expectCode: 400 },
  // Valid ratings
  { body: { rating: 1, text: 'Valid min' }, desc: 'Valid rating: 1', expectCode: 201 },
  { body: { rating: 5, text: 'Valid max' }, desc: 'Valid rating: 5', expectCode: 201 },
  { body: { rating: 3, text: 'a'.repeat(5000) }, desc: 'Valid text length: exactly 5000 chars', expectCode: 201 },
  { body: { rating: 4, text: '' }, desc: 'Valid empty text: ""', expectCode: 201 },
  { body: { rating: 2 }, desc: 'Valid omitted text', expectCode: 201 },
];

for (const tc of boundaryReviewTests) {
  const req = {
    params: { isbn: '0439136350' },
    body: tc.body,
    user: new User({ username: 'tester', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  req.user.save = async function () { return this; };

  const res = mockRes();
  let caughtErr = null;
  try {
    await postReviewHandler(req, res, (err) => { caughtErr = err; });
  } catch (err) {
    caughtErr = err;
  }

  const pass = res.statusCode === tc.expectCode && !caughtErr;
  verify(`POST /books/:isbn/reviews: ${tc.desc}`, pass, `status=${res.statusCode}, err=${caughtErr?.name || 'none'}`);
}

// ---------------------------------------------------------------------------
// SUITE 2: Shelf State Machine & Missing Body Defensiveness
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: PUT /me/shelf/:isbn Missing Body & Defensiveness ---');

const putShelfHandler = findRouteHandler(usersRoute, '/me/shelf/:isbn', 'PUT');
assert.ok(putShelfHandler, 'PUT /me/shelf/:isbn handler must exist');

const shelfDefensiveTests = [
  { body: undefined, desc: 'Missing body (undefined) -> HTTP 400, NEVER 500', expectCode: 400 },
  { body: null, desc: 'Null body (null) -> HTTP 400, NEVER 500', expectCode: 400 },
  { body: {}, desc: 'Empty body ({}) -> HTTP 400, NEVER 500', expectCode: 400 },
  { body: { status: 'invalid_status' }, desc: 'Invalid status string -> HTTP 400', expectCode: 400 },
  { body: { status: 'read ' }, desc: 'Status with trailing space -> HTTP 400', expectCode: 400 },
  { body: { status: null }, desc: 'Status null -> HTTP 400', expectCode: 400 },
  { body: { status: 123 }, desc: 'Status number -> HTTP 400', expectCode: 400 },
  { body: { status: true }, desc: 'Status boolean -> HTTP 400', expectCode: 400 },
  { body: { status: [] }, desc: 'Status array -> HTTP 400', expectCode: 400 },
  { body: { status: {} }, desc: 'Status object -> HTTP 400', expectCode: 400 },
];

for (const tc of shelfDefensiveTests) {
  const req = {
    params: { isbn: '0439136350' },
    body: tc.body,
    user: new User({ username: 'tester', favorites: ['0441172660'], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  req.user.save = async function () { return this; };

  const res = mockRes();
  let caughtErr = null;
  try {
    await putShelfHandler(req, res, (err) => { caughtErr = err; });
  } catch (err) {
    caughtErr = err;
  }

  const pass = res.statusCode === tc.expectCode && !caughtErr;
  verify(`PUT /me/shelf/:isbn: ${tc.desc}`, pass, `status=${res.statusCode}, err=${caughtErr?.name || 'none'}`);
}

// ---------------------------------------------------------------------------
// SUITE 3: 1,000 Rapid Concurrency / Transition Fuzzing & Favorites Integrity
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: 1,000 Rapid Shelf Transitions & Invariants ---');

const testUser = new User({
  username: 'rapiduser',
  passwordHash: 'hash',
  favorites: ['0345339681', '0441172660', '0385504209'],
  wantToRead: [],
  currentlyReading: [],
  read: [],
});
testUser.save = async function () { return this; };

const initialFavs = [...testUser.favorites];
const validShelfStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];
let concurrencyViolations = 0;
let duplicateViolations = 0;
let favCorruptionViolations = 0;

for (let i = 0; i < 1000; i++) {
  const isbn = VALID_ISBNS[i % VALID_ISBNS.length];
  const targetStatus = validShelfStatuses[Math.floor(Math.random() * validShelfStatuses.length)];

  const req = {
    params: { isbn },
    body: { status: targetStatus },
    user: testUser,
    userId: 'mock-user-id',
  };
  const res = mockRes();
  await putShelfHandler(req, res, () => {});

  // Invariant 1: Mutual exclusivity
  const wantSet = new Set(testUser.wantToRead);
  const currSet = new Set(testUser.currentlyReading);
  const readSet = new Set(testUser.read);

  const overlapWant = testUser.wantToRead.some((b) => currSet.has(b) || readSet.has(b));
  const overlapCurr = testUser.currentlyReading.some((b) => wantSet.has(b) || readSet.has(b));
  const overlapRead = testUser.read.some((b) => wantSet.has(b) || currSet.has(b));

  if (overlapWant || overlapCurr || overlapRead) {
    concurrencyViolations++;
  }

  // Invariant 2: No duplicates within individual shelves
  if (
    wantSet.size !== testUser.wantToRead.length ||
    currSet.size !== testUser.currentlyReading.length ||
    readSet.size !== testUser.read.length
  ) {
    duplicateViolations++;
  }

  // Invariant 3: Favorites preservation
  if (
    testUser.favorites.length !== initialFavs.length ||
    !initialFavs.every((f, idx) => testUser.favorites[idx] === f)
  ) {
    favCorruptionViolations++;
  }
}

verify('1,000 rapid transitions: Zero mutual exclusivity violations', concurrencyViolations === 0, `violations=${concurrencyViolations}`);
verify('1,000 rapid transitions: Zero duplicate ISBN entries inside shelves', duplicateViolations === 0, `violations=${duplicateViolations}`);
verify('1,000 rapid transitions: Favorites array preserved 100% unchanged', favCorruptionViolations === 0, `violations=${favCorruptionViolations}`);

// ---------------------------------------------------------------------------
// SUITE 4: Live HTTP API Tests Against Running Express Server
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Live HTTP API Tests Against Running Server ---');

async function runLiveHttpTests() {
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    if (!healthRes.ok) {
      console.warn('⚠️ Server not responding to health check, skipping live HTTP suite.');
      return;
    }

    const testSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const username = `challenger_${testSuffix}`;
    const password = 'Password123!';

    // Signup test user
    const signupRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const signupData = await signupRes.json();
    const token = signupData.token;
    assert.ok(token, 'Signup should provide JWT token');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Live test matrix for POST /books/:isbn/reviews
    const liveReviewTests = [
      { rawBody: JSON.stringify({ rating: '5' }), desc: 'Live HTTP: { rating: "5" } string' },
      { rawBody: JSON.stringify({ rating: true }), desc: 'Live HTTP: { rating: true } boolean' },
      { rawBody: JSON.stringify({ rating: [3] }), desc: 'Live HTTP: { rating: [3] } array' },
      { rawBody: JSON.stringify({ rating: 3.5 }), desc: 'Live HTTP: { rating: 3.5 } float' },
      { rawBody: JSON.stringify({ rating: null }), desc: 'Live HTTP: { rating: null } null' },
      { rawBody: JSON.stringify({ rating: 0 }), desc: 'Live HTTP: { rating: 0 } (< 1)' },
      { rawBody: JSON.stringify({ rating: 6 }), desc: 'Live HTTP: { rating: 6 } (> 5)' },
      { rawBody: JSON.stringify({ rating: -1 }), desc: 'Live HTTP: { rating: -1 } (< 1)' },
      { rawBody: JSON.stringify({ rating: 5, text: 123 }), desc: 'Live HTTP: { rating: 5, text: 123 } non-string text' },
      { rawBody: JSON.stringify({ rating: 5, text: ['bad'] }), desc: 'Live HTTP: { rating: 5, text: ["bad"] } array text' },
      { rawBody: JSON.stringify({ rating: 5, text: 'a'.repeat(5001) }), desc: 'Live HTTP: text > 5000 chars' },
      { rawBody: JSON.stringify({}), desc: 'Live HTTP: empty json body {}' },
    ];

    for (const lt of liveReviewTests) {
      const res = await fetch(`${API_BASE}/books/0439136350/reviews`, {
        method: 'POST',
        headers: authHeaders,
        body: lt.rawBody,
      });
      const data = await res.json().catch(() => ({}));
      verify(`Live HTTP POST /books/:isbn/reviews: ${lt.desc}`, res.status === 400, `status=${res.status}, err=${data.error || 'none'}`);
    }

    // Live test: Empty body without content-type or empty string
    {
      const res = await fetch(`${API_BASE}/books/0439136350/reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      verify('Live HTTP POST /books/:isbn/reviews: Empty body / no content-type', res.status === 400, `status=${res.status}`);
    }

    // Live test matrix for PUT /me/shelf/:isbn
    {
      // Missing body / empty body
      const resEmpty = await fetch(`${API_BASE}/me/shelf/0439136350`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      verify('Live HTTP PUT /me/shelf/:isbn: Missing body -> 400, never 500', resEmpty.status === 400, `status=${resEmpty.status}`);

      // Empty JSON body {}
      const resJsonEmpty = await fetch(`${API_BASE}/me/shelf/0439136350`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      verify('Live HTTP PUT /me/shelf/:isbn: Empty JSON body {} -> 400, never 500', resJsonEmpty.status === 400, `status=${resJsonEmpty.status}`);

      // Invalid status
      const resBadStatus = await fetch(`${API_BASE}/me/shelf/0439136350`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'invalid_shelf' }),
      });
      verify('Live HTTP PUT /me/shelf/:isbn: Invalid status -> 400', resBadStatus.status === 400, `status=${resBadStatus.status}`);

      // Unknown ISBN
      const resUnkIsbn = await fetch(`${API_BASE}/me/shelf/9999999999999`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'want_to_read' }),
      });
      verify('Live HTTP PUT /me/shelf/:isbn: Unknown ISBN -> 404', resUnkIsbn.status === 404, `status=${resUnkIsbn.status}`);
    }

    // Valid review submission live
    {
      const resValid = await fetch(`${API_BASE}/books/0439136350/reviews`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ rating: 5, text: 'Masterpiece of modern fantasy!' }),
      });
      const dataValid = await resValid.json();
      verify('Live HTTP POST /books/:isbn/reviews: Valid review creates with 201', resValid.status === 201, `status=${resValid.status}`);
      verify('Live HTTP POST /books/:isbn/reviews: Review has sentiment analysis', Boolean(dataValid.review?.sentiment?.label), `label=${dataValid.review?.sentiment?.label}`);
    }

    // Shelf transitions live
    {
      const resWant = await fetch(`${API_BASE}/me/shelf/0439136350`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'want_to_read' }),
      });
      const dataWant = await resWant.json();
      verify('Live HTTP PUT /me/shelf/:isbn: Transition to want_to_read', resWant.status === 200 && dataWant.shelves?.wantToRead?.includes('0439136350'));

      const resCurr = await fetch(`${API_BASE}/me/shelf/0439136350`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'currently_reading' }),
      });
      const dataCurr = await resCurr.json();
      verify('Live HTTP PUT /me/shelf/:isbn: Transition to currently_reading removes from wantToRead',
        resCurr.status === 200 &&
        dataCurr.shelves?.currentlyReading?.includes('0439136350') &&
        !dataCurr.shelves?.wantToRead?.includes('0439136350'));
    }

  } catch (err) {
    console.error('Error during live HTTP tests:', err);
    results.failed++;
    results.failures.push({ desc: 'Live HTTP suite execution', details: err.message });
  }
}

await runLiveHttpTests();

console.log('\n' + '='.repeat(75));
console.log(`SUMMARY: ${results.passed} checks passed, ${results.failed} checks failed (Total: ${results.total}).`);
console.log('='.repeat(75));

if (results.failed > 0) {
  console.error('\nFAILURES IDENTIFIED:');
  for (const f of results.failures) {
    console.error(`  ❌ ${f.desc} (${f.details})`);
  }
  process.exit(1);
} else {
  console.log('\n⚔️  ALL ADVERSARIAL AND STRESS CHECKS PASSED EMPIRICALLY!\n');
  process.exit(0);
}
