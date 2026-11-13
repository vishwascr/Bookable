// Empirical Challenger Stress & Boundary Test Suite for Milestone 1
// Adversarial validation of shelf state machines, review validations, aggregations, and edge cases.

import assert from 'node:assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Book from '../models/Book.js';
import { engine } from '../recommender/engine.js';
import usersRoute from '../routes/users.js';
import reviewsRoute from '../routes/reviews.js';

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

// Helper to find Express route handler
function findRouteHandler(router, path, method) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }
  }
  return null;
}

// Mock Response Builder
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

console.log('======================================================================');
console.log('       EMPIRICAL CHALLENGER STRESS & ADVERSARIAL TEST SUITE (M1)      ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Setup in-memory mock engine & Book.exists for deterministic testing
// ---------------------------------------------------------------------------
const VALID_ISBNS = ['0439136350', '0345339681', '0441172660', '0451524934', '0385504209'];
const UNKNOWN_ISBN = '9999999999999';

const eng = engine();
eng.ready = true;
VALID_ISBNS.forEach((isbn, idx) => {
  eng.byIsbn.set(isbn, idx);
  eng.books[idx] = {
    isbn,
    title: `Book ${idx}`,
    author: `Author ${idx}`,
    publisher: `Publisher ${idx}`,
    genres: ['Fiction'],
    tags: ['Classic'],
    rating: 4.0,
  };
});

// Deterministic Book.exists mock to avoid unmocked buffering timeouts
Book.exists = async ({ isbn }) => {
  return eng.byIsbn.has(isbn) ? { _id: new mongoose.Types.ObjectId() } : null;
};

// ===========================================================================
// SUITE 1: Reading Shelf State Machine Adversarial Stress Testing
// ===========================================================================
console.log('--- SUITE 1: Reading Shelf State Machine Adversarial Stress ---');

const putShelfHandler = findRouteHandler(usersRoute, '/me/shelf/:isbn', 'PUT');
assert.ok(putShelfHandler, 'PUT /me/shelf/:isbn handler must exist');

// 1.1 Invalid Status Values
console.log('\n[1.1] Testing Invalid Status Values (Expect HTTP 400)...');
const invalidStatuses = [
  'invalid_status',
  '',
  null,
  123,
  undefined,
  {},
  [],
  'WANT_TO_READ',
  'read ',
  ' reading',
  'finished',
  true,
];

for (const badStatus of invalidStatuses) {
  const req = {
    params: { isbn: '0439136350' },
    body: { status: badStatus },
    user: new User({ username: 'tester', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  const res = mockRes();
  let errorCaught = null;
  try {
    await putShelfHandler(req, res, (err) => { errorCaught = err; });
  } catch (err) {
    errorCaught = err;
  }
  const is400 = res.statusCode === 400 && res.body?.error;
  check(`Invalid status "${JSON.stringify(badStatus)}" rejected with 400`, is400, `got status ${res.statusCode}`);
}

// 1.2 Missing Request Body (Edge Case)
console.log('\n[1.2] Testing Missing or Malformed Request Body in PUT /me/shelf/:isbn...');
{
  const reqNoBody = {
    params: { isbn: '0439136350' },
    body: undefined,
    user: new User({ username: 'tester', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  const resNoBody = mockRes();
  let nextErr = null;
  try {
    await putShelfHandler(reqNoBody, resNoBody, (err) => { nextErr = err; });
  } catch (err) {
    nextErr = err;
  }
  const safeHandling = resNoBody.statusCode === 400 || (nextErr instanceof TypeError);
  check('Missing req.body surfaces error (not silent success)', safeHandling, `status: ${resNoBody.statusCode}, err: ${nextErr?.name || 'none'}`);
}

// 1.3 Unknown ISBN (Expect HTTP 404)
console.log('\n[1.3] Testing Unknown ISBNs (Expect HTTP 404)...');
const unknownIsbnCases = [UNKNOWN_ISBN, 'unknown_isbn_abc', '999-000-111'];
for (const unkIsbn of unknownIsbnCases) {
  const req = {
    params: { isbn: unkIsbn },
    body: { status: 'want_to_read' },
    user: new User({ username: 'tester', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  const res = mockRes();
  await putShelfHandler(req, res, () => {});
  check(`Unknown ISBN "${unkIsbn}" rejected with 404`, res.statusCode === 404, `got status ${res.statusCode}`);
}

// 1.4 State Machine Fuzzing: 1,000 Rapid Random Transitions & Invariant Checks
console.log('\n[1.4] State Machine Fuzzing: 1,000 Rapid Random Transitions...');
const fuzzedUser = new User({
  username: 'fuzzuser',
  passwordHash: 'hash',
  favorites: ['0345339681', '0441172660', '0385504209'],
  wantToRead: [],
  currentlyReading: [],
  read: [],
});

fuzzedUser.save = async function () { return this; };

const initialFavorites = [...fuzzedUser.favorites];
const statuses = ['want_to_read', 'currently_reading', 'read', 'none'];
let invariantViolations = 0;

for (let step = 0; step < 1000; step++) {
  const chosenIsbn = VALID_ISBNS[step % VALID_ISBNS.length];
  const chosenStatus = statuses[Math.floor(Math.random() * statuses.length)];

  const req = {
    params: { isbn: chosenIsbn },
    body: { status: chosenStatus },
    user: fuzzedUser,
    userId: 'mock-user-id',
  };
  const res = mockRes();
  await putShelfHandler(req, res, () => {});

  // INVARIANT 1: Disjoint shelves (no ISBN in more than one reading shelf)
  const setWant = new Set(fuzzedUser.wantToRead);
  const setCurr = new Set(fuzzedUser.currentlyReading);
  const setRead = new Set(fuzzedUser.read);

  const overlap1 = fuzzedUser.wantToRead.filter((x) => setCurr.has(x) || setRead.has(x));
  const overlap2 = fuzzedUser.currentlyReading.filter((x) => setWant.has(x) || setRead.has(x));
  const overlap3 = fuzzedUser.read.filter((x) => setWant.has(x) || setCurr.has(x));

  if (overlap1.length > 0 || overlap2.length > 0 || overlap3.length > 0) {
    invariantViolations++;
  }

  // INVARIANT 2: No duplicates within any individual shelf
  if (
    setWant.size !== fuzzedUser.wantToRead.length ||
    setCurr.size !== fuzzedUser.currentlyReading.length ||
    setRead.size !== fuzzedUser.read.length
  ) {
    invariantViolations++;
  }

  // INVARIANT 3: Favorites NEVER mutated or cleared by shelf transition
  if (
    fuzzedUser.favorites.length !== initialFavorites.length ||
    !initialFavorites.every((f) => fuzzedUser.favorites.includes(f))
  ) {
    invariantViolations++;
  }

  // INVARIANT 4: Target state reached accurately
  if (chosenStatus === 'want_to_read' && !fuzzedUser.wantToRead.includes(chosenIsbn)) invariantViolations++;
  if (chosenStatus === 'currently_reading' && !fuzzedUser.currentlyReading.includes(chosenIsbn)) invariantViolations++;
  if (chosenStatus === 'read' && !fuzzedUser.read.includes(chosenIsbn)) invariantViolations++;
  if (
    chosenStatus === 'none' &&
    (fuzzedUser.wantToRead.includes(chosenIsbn) ||
      fuzzedUser.currentlyReading.includes(chosenIsbn) ||
      fuzzedUser.read.includes(chosenIsbn))
  ) {
    invariantViolations++;
  }
}

check('1,000 rapid transitions: 0 mutual exclusivity violations', invariantViolations === 0, `violations: ${invariantViolations}`);
check('Favorites preserved 100% untouched throughout all 1,000 transitions',
  fuzzedUser.favorites.length === initialFavorites.length &&
  initialFavorites.every((f) => fuzzedUser.favorites.includes(f)));

// ===========================================================================
// SUITE 2: Review Validations & Boundaries
// ===========================================================================
console.log('\n--- SUITE 2: Review Validations & Boundaries ---');

const postReviewHandler = findRouteHandler(reviewsRoute, '/books/:isbn/reviews', 'POST');
assert.ok(postReviewHandler, 'POST /books/:isbn/reviews handler must exist');

// 2.1 Rating Boundaries in Handler
console.log('\n[2.1] Testing Rating Boundaries in POST /books/:isbn/reviews...');

// Setup in-memory mock for Review methods
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
    sort: () => ({
      lean: () => list,
    }),
  };
};

const ratingBoundaryMatrix = [
  { rating: 0, expect400: true, desc: 'rating 0 (< 1)' },
  { rating: 6, expect400: true, desc: 'rating 6 (> 5)' },
  { rating: -1, expect400: true, desc: 'rating -1 (< 1)' },
  { rating: 3.5, expect400: true, desc: 'float rating 3.5' },
  { rating: '5', expect400: true, desc: 'string "5"' },
  { rating: '0', expect400: true, desc: 'string "0"' },
  { rating: '6', expect400: true, desc: 'string "6"' },
  { rating: null, expect400: true, desc: 'null rating' },
  { rating: undefined, expect400: true, desc: 'undefined rating' },
  { rating: NaN, expect400: true, desc: 'NaN rating' },
  { rating: true, expect400: true, desc: 'boolean true rating' },
  { rating: false, expect400: true, desc: 'boolean false rating' },
  { rating: [3], expect400: true, desc: 'array [3] rating' },
  { rating: {}, expect400: true, desc: 'object {} rating' },
  { rating: 'five', expect400: true, desc: 'string "five"' },
  { rating: 1, expect400: false, desc: 'valid rating 1' },
  { rating: 5, expect400: false, desc: 'valid rating 5' },
];

for (const testCase of ratingBoundaryMatrix) {
  const req = {
    params: { isbn: '0439136350' },
    body: { rating: testCase.rating, text: 'Sample review text' },
    user: new User({ username: 'alice', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  req.user.save = async function () { return this; };

  const res = mockRes();
  try {
    await postReviewHandler(req, res, () => {});
  } catch {}

  if (testCase.expect400) {
    const isRejectedWith400 = res.statusCode === 400;
    check(`Boundary [${testCase.desc}] rejected with 400`, isRejectedWith400, `got status ${res.statusCode} (body: ${JSON.stringify(res.body)})`);
  } else {
    const isSuccess = res.statusCode === 201;
    check(`Valid [${testCase.desc}] accepted with 201`, isSuccess, `status: ${res.statusCode}`);
  }
}

// 2.2 Text Limits: 0, 5000, 5001 chars
console.log('\n[2.2] Testing Review Text Length Boundaries...');
const textCases = [
  { len: 0, expect400: false, desc: 'text length 0 (empty text allowed)' },
  { len: 5000, expect400: false, desc: 'text length exactly 5000 (at limit)' },
  { len: 5001, expect400: true, desc: 'text length 5001 (exceeds limit)' },
  { len: 10000, expect400: true, desc: 'text length 10000 (far exceeds limit)' },
];

for (const tc of textCases) {
  const req = {
    params: { isbn: '0439136350' },
    body: { rating: 5, text: 'a'.repeat(tc.len) },
    user: new User({ username: 'alice', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  req.user.save = async function () { return this; };

  const res = mockRes();
  try {
    await postReviewHandler(req, res, () => {});
  } catch {}

  if (tc.expect400) {
    check(`Text boundary [${tc.desc}] rejected with 400`, res.statusCode === 400, `status: ${res.statusCode}`);
  } else {
    check(`Text boundary [${tc.desc}] accepted with 201`, res.statusCode === 201, `status: ${res.statusCode}`);
  }
}

// 2.3 Non-existent ISBN in Review Submission (Expect 404)
console.log('\n[2.3] Testing Review Submission for Non-Existent ISBN...');
{
  const req = {
    params: { isbn: UNKNOWN_ISBN },
    body: { rating: 5, text: 'Great non-existent book!' },
    user: new User({ username: 'alice', favorites: [], wantToRead: [], currentlyReading: [], read: [] }),
    userId: 'mock-user-id',
  };
  const res = mockRes();
  await postReviewHandler(req, res, () => {});
  check(`POST /books/${UNKNOWN_ISBN}/reviews rejected with 404`, res.statusCode === 404, `status: ${res.statusCode}`);
}

// 2.4 Non-existent ISBN in GET Reviews (Expect 404)
console.log('\n[2.4] Testing GET Reviews for Non-Existent ISBN...');
const getReviewsHandler = findRouteHandler(reviewsRoute, '/books/:isbn/reviews', 'GET');
assert.ok(getReviewsHandler, 'GET /books/:isbn/reviews handler must exist');
{
  const req = { params: { isbn: UNKNOWN_ISBN } };
  const res = mockRes();
  await getReviewsHandler(req, res, () => {});
  check(`GET /books/${UNKNOWN_ISBN}/reviews rejected with 404`, res.statusCode === 404, `status: ${res.statusCode}`);
}

// 2.5 Upsert Semantics: Updating Review Maintains totalReviews === 1
console.log('\n[2.5] Testing Upsert Semantics (Duplicate Prevention & Stats)...');
{
  mockReviewCollection.clear();
  const upsertUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: 'upsert_tester',
    favorites: [],
    wantToRead: ['0439136350'],
    currentlyReading: [],
    read: [],
  });
  upsertUser.save = async function () { return this; };

  // First submission: 4 stars
  const req1 = {
    params: { isbn: '0439136350' },
    body: { rating: 4, text: 'Initial review' },
    user: upsertUser,
    userId: String(upsertUser._id),
  };
  const res1 = mockRes();
  await postReviewHandler(req1, res1, () => {});

  check('First submission returned 201', res1.statusCode === 201);
  check('First submission totalReviews === 1', res1.body?.stats?.totalReviews === 1);
  check('First submission averageRating === 4.0', res1.body?.stats?.averageRating === 4.0);
  check('Auto-transitioned to read shelf', upsertUser.read.includes('0439136350'));
  check('Pulled from wantToRead shelf', !upsertUser.wantToRead.includes('0439136350'));

  // Second submission for SAME book: update to 5 stars
  const req2 = {
    params: { isbn: '0439136350' },
    body: { rating: 5, text: 'Updated review to 5 stars' },
    user: upsertUser,
    userId: String(upsertUser._id),
  };
  const res2 = mockRes();
  await postReviewHandler(req2, res2, () => {});

  check('Updated submission returned 201', res2.statusCode === 201);
  check('Updated submission totalReviews REMAINS 1 (no duplicates)', res2.body?.stats?.totalReviews === 1, `got ${res2.body?.stats?.totalReviews}`);
  check('Updated submission averageRating updated to 5.0', res2.body?.stats?.averageRating === 5.0, `got ${res2.body?.stats?.averageRating}`);
  check('Read shelf still has exactly 1 entry for this book', upsertUser.read.filter((x) => x === '0439136350').length === 1);
}

// ===========================================================================
// SUITE 3: Review Aggregation Math & Rounding Oracles
// ===========================================================================
console.log('\n--- SUITE 3: Review Aggregation Math & Rounding Oracles ---');

// Aggregation simulation oracle according to specs
function oracleAggregate(ratingsList) {
  const totalReviews = ratingsList.length;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of ratingsList) {
    const star = Math.round(r);
    if (ratingDistribution[star] !== undefined) ratingDistribution[star]++;
    sum += r;
  }
  const averageRating = totalReviews > 0 ? +(sum / totalReviews).toFixed(1) : 0;
  return { averageRating, totalReviews, ratingDistribution };
}

const testDistributions = [
  { name: 'Empty reviews (0)', list: [], expectedAvg: 0, expectedTotal: 0 },
  { name: 'Single 5-star', list: [5], expectedAvg: 5.0, expectedTotal: 1 },
  { name: 'Single 1-star', list: [1], expectedAvg: 1.0, expectedTotal: 1 },
  { name: 'Two ratings [1, 2]', list: [1, 2], expectedAvg: 1.5, expectedTotal: 2 },
  { name: 'Three ratings [5, 4, 4]', list: [5, 4, 4], expectedAvg: 4.3, expectedTotal: 3 }, // 13/3 = 4.333 -> 4.3
  { name: 'Six ratings [5, 5, 4, 3, 2, 1]', list: [5, 5, 4, 3, 2, 1], expectedAvg: 3.3, expectedTotal: 6 }, // 20/6 = 3.333 -> 3.3
  { name: 'All 5s [5, 5, 5, 5, 5]', list: [5, 5, 5, 5, 5], expectedAvg: 5.0, expectedTotal: 5 },
  { name: 'Uniform 1-5 [1, 2, 3, 4, 5]', list: [1, 2, 3, 4, 5], expectedAvg: 3.0, expectedTotal: 5 },
  { name: 'Rounding up boundary [4, 4, 5]', list: [4, 4, 5], expectedAvg: 4.3, expectedTotal: 3 }, // 13/3 = 4.333 -> 4.3
  { name: 'Rounding up [3, 4, 4]', list: [3, 4, 4], expectedAvg: 3.7, expectedTotal: 3 }, // 11/3 = 3.666 -> 3.7
];

for (const td of testDistributions) {
  const result = oracleAggregate(td.list);
  const avgMatches = result.averageRating === td.expectedAvg;
  const totalMatches = result.totalReviews === td.expectedTotal;
  const hasAllBins = [1, 2, 3, 4, 5].every((k) => typeof result.ratingDistribution[k] === 'number');

  check(`Aggregation [${td.name}]: averageRating === ${td.expectedAvg}`, avgMatches, `got ${result.averageRating}`);
  check(`Aggregation [${td.name}]: totalReviews === ${td.expectedTotal}`, totalMatches, `got ${result.totalReviews}`);
  check(`Aggregation [${td.name}]: all keys 1..5 present`, hasAllBins);
}

// 3.2 Live Route Handler Aggregation via GET /books/:isbn/reviews
console.log('\n[3.2] Testing Live Route Handler Aggregations on GET /books/:isbn/reviews...');
{
  mockReviewCollection.clear();
  const isbnForAgg = '0439136350';
  mockReviewCollection.set('u1:isbn', { userId: 'u1', isbn: isbnForAgg, rating: 5, createdAt: new Date() });
  mockReviewCollection.set('u2:isbn', { userId: 'u2', isbn: isbnForAgg, rating: 4, createdAt: new Date() });
  mockReviewCollection.set('u3:isbn', { userId: 'u3', isbn: isbnForAgg, rating: 4, createdAt: new Date() });

  const req = { params: { isbn: isbnForAgg }, userId: null };
  const res = mockRes();
  await getReviewsHandler(req, res, () => {});

  check('GET /books/:isbn/reviews returns status 200', res.statusCode === 200);
  check('GET /books/:isbn/reviews totalReviews === 3', res.body?.totalReviews === 3, `got ${res.body?.totalReviews}`);
  check('GET /books/:isbn/reviews averageRating === 4.3', res.body?.averageRating === 4.3, `got ${res.body?.averageRating}`);
  check('GET /books/:isbn/reviews ratingDistribution has all 1..5 keys',
    [1, 2, 3, 4, 5].every((k) => res.body?.ratingDistribution?.[k] !== undefined));
  check('GET /books/:isbn/reviews ratingDistribution count for 4 is 2', res.body?.ratingDistribution?.[4] === 2);
  check('GET /books/:isbn/reviews ratingDistribution count for 5 is 1', res.body?.ratingDistribution?.[5] === 1);
  check('GET /books/:isbn/reviews ratingDistribution count for 1 is 0', res.body?.ratingDistribution?.[1] === 0);
}

// ===========================================================================
// SUITE 4: Settings Reset vs Deletion Separation
// ===========================================================================
console.log('\n--- SUITE 4: Settings Reset vs Review Deletion Separation ---');

const resetBooksHandler = findRouteHandler(usersRoute, '/me/reset-books', 'POST');
assert.ok(resetBooksHandler, 'POST /me/reset-books handler must exist');

const testUserForReset = new User({
  username: 'resetuser',
  favorites: ['0345339681', '0441172660', '0385504209'],
  wantToRead: ['0439136350'],
  currentlyReading: ['0451524934'],
  read: ['059035342X'],
});
testUserForReset.save = async function () { return this; };

const resetReq = { user: testUserForReset, userId: String(testUserForReset._id) };
const resetRes = mockRes();
await resetBooksHandler(resetReq, resetRes, () => {});

check('POST /me/reset-books returns 200', resetRes.statusCode === 200);
check('POST /me/reset-books clears wantToRead', testUserForReset.wantToRead.length === 0);
check('POST /me/reset-books clears currentlyReading', testUserForReset.currentlyReading.length === 0);
check('POST /me/reset-books clears read', testUserForReset.read.length === 0);
check('POST /me/reset-books clears favorites', testUserForReset.favorites.length === 0);

// ===========================================================================
// SUMMARY & VERDICT
// ===========================================================================
console.log('\n======================================================================');
console.log(`SUMMARY: ${passed} checks passed, ${failed} checks failed.`);
if (failures.length > 0) {
  console.log('\nFAILURES IDENTIFIED:');
  for (const f of failures) {
    console.log(`  ❌ ${f.name} (${f.details})`);
  }
}
console.log('======================================================================\n');

process.exit(failed > 0 ? 1 : 0);
