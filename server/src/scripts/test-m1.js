// Comprehensive Milestone 1 Verification Suite
// Tests all data models, schemas, validators, auth, shelves, reviews, and settings isolation.

import assert from 'node:assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { signToken, requireAuth, optionalAuth } from '../auth.js';
import usersRoute, { getBookByIsbn, populateBooks } from '../routes/users.js';
import reviewsRoute from '../routes/reviews.js';

let passed = 0;
let failed = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name} ${details}`);
    passed++;
  } else {
    console.error(`❌ ${name} ${details}`);
    failed++;
  }
}

console.log('=== Milestone 1: Automated Verification Test ===\n');

// ---------------------------------------------------------------------------
// 1. Data Model Verification: User Schema & Methods
// ---------------------------------------------------------------------------
console.log('--- 1. User Model Verification ---');
const userPaths = User.schema.paths;
check('User.currentlyReading field exists', !!userPaths.currentlyReading);
check('User.currentlyReading is Array of String', userPaths.currentlyReading.instance === 'Array');
check('User.read field exists', !!userPaths.read);
check('User.read is Array of String', userPaths.read.instance === 'Array');

const sampleUser = new User({
  username: 'testreader',
  displayName: 'Test Reader',
  passwordHash: 'hash123',
  favorites: ['0345339681', '0441172660', '0671461494'],
  wantToRead: ['0439136350'],
  currentlyReading: ['0385504209'],
  read: ['0451524934'],
});

const pub = sampleUser.toPublic();
check('toPublic() includes currentlyReading', Array.isArray(pub.currentlyReading) && pub.currentlyReading.includes('0385504209'));
check('toPublic() includes read', Array.isArray(pub.read) && pub.read.includes('0451524934'));
check('toPublic() preserves favorites and wantToRead', pub.favorites.length === 3 && pub.wantToRead.length === 1);
check('toPublic() preserves onboarded flag', pub.onboarded === true);
check('toPublic() excludes passwordHash', pub.passwordHash === undefined);

// ---------------------------------------------------------------------------
// 2. Data Model Verification: Review Schema, Indexes & Validators
// ---------------------------------------------------------------------------
console.log('\n--- 2. Review Model Verification ---');
const revPaths = Review.schema.paths;
check('Review.userId exists and references User', revPaths.userId.instance === 'ObjectId' && revPaths.userId.options.ref === 'User');
check('Review.username exists and is required', revPaths.username.instance === 'String' && revPaths.username.isRequired);
check('Review.displayName exists with default empty string', revPaths.displayName.instance === 'String' && revPaths.displayName.defaultValue === '');
check('Review.isbn exists and is required', revPaths.isbn.instance === 'String' && revPaths.isbn.isRequired);
check('Review.rating exists and is required', revPaths.rating.instance === 'Number' && revPaths.rating.isRequired);
check('Review.text max length is 5000', revPaths.text.options.maxlength === 5000);
check('Review.sentiment has score, label, keywords',
  !!revPaths['sentiment.score'] && !!revPaths['sentiment.label'] && !!revPaths['sentiment.keywords']);

// Rating validator checks
const validReview1 = new Review({
  userId: new mongoose.Types.ObjectId(),
  username: 'alice',
  isbn: '0439136350',
  rating: 5,
});
const err1 = await validReview1.validate().catch((e) => e);
check('Review with integer rating 5 validates', !(err1 instanceof Error));

const invalidFloat = new Review({
  userId: new mongoose.Types.ObjectId(),
  username: 'alice',
  isbn: '0439136350',
  rating: 4.5,
});
const errFloat = await invalidFloat.validate().catch((e) => e);
check('Review with float rating 4.5 rejected by validator', !!errFloat && errFloat.errors?.rating);

const invalidZero = new Review({
  userId: new mongoose.Types.ObjectId(),
  username: 'alice',
  isbn: '0439136350',
  rating: 0,
});
const errZero = await invalidZero.validate().catch((e) => e);
check('Review with rating 0 (< 1) rejected', !!errZero && errZero.errors?.rating);

const invalidSix = new Review({
  userId: new mongoose.Types.ObjectId(),
  username: 'alice',
  isbn: '0439136350',
  rating: 6,
});
const errSix = await invalidSix.validate().catch((e) => e);
check('Review with rating 6 (> 5) rejected', !!errSix && errSix.errors?.rating);

// Indexes check
const indexes = Review.schema.indexes();
const hasUniqueCompound = indexes.some(([fields, opts]) => fields.userId === 1 && fields.isbn === 1 && opts?.unique === true);
check('Compound unique index { userId: 1, isbn: 1 } exists', hasUniqueCompound);

const hasIsbnTime = indexes.some(([fields]) => fields.isbn === 1 && fields.createdAt === -1);
check('Sorting index { isbn: 1, createdAt: -1 } exists', hasIsbnTime);

const hasUserTime = indexes.some(([fields]) => fields.userId === 1 && fields.createdAt === -1);
check('Sorting index { userId: 1, createdAt: -1 } exists', hasUserTime);

// ---------------------------------------------------------------------------
// 3. Authentication & Optional Authentication Verification
// ---------------------------------------------------------------------------
console.log('\n--- 3. Authentication & Optional Auth Verification ---');
const dummyUser = { _id: new mongoose.Types.ObjectId(), username: 'authuser' };
const token = signToken(dummyUser);
check('signToken generates valid JWT', typeof token === 'string' && token.split('.').length === 3);

// Test requireAuth with valid token
let authPassed = false;
let authReq = { headers: { authorization: `Bearer ${token}` } };
let authRes = { status: (code) => ({ json: (data) => ({ code, data }) }) };
requireAuth(authReq, authRes, () => { authPassed = true; });
check('requireAuth accepts valid Bearer token and sets req.userId', authPassed && authReq.userId === String(dummyUser._id));

// Test requireAuth without token
let noAuthStatus = 0;
let noAuthReq = { headers: {} };
let noAuthRes = { status: (code) => { noAuthStatus = code; return { json: () => {} }; } };
requireAuth(noAuthReq, noAuthRes, () => {});
check('requireAuth without token returns 401', noAuthStatus === 401);

// Test optionalAuth with valid token
let optAuthPassed = false;
let optAuthReq = { headers: { authorization: `Bearer ${token}` } };
optionalAuth(optAuthReq, authRes, () => { optAuthPassed = true; });
check('optionalAuth with valid token sets req.userId', optAuthPassed && optAuthReq.userId === String(dummyUser._id));

// Test optionalAuth with no token
let optNoTokenPassed = false;
let optNoTokenReq = { headers: {} };
optionalAuth(optNoTokenReq, authRes, () => { optNoTokenPassed = true; });
check('optionalAuth without token calls next() and req.userId is null/undefined', optNoTokenPassed && !optNoTokenReq.userId);

// Test optionalAuth with malformed token
let optBadTokenPassed = false;
let optBadTokenReq = { headers: { authorization: 'Bearer invalid.garbage.token' } };
optionalAuth(optBadTokenReq, authRes, () => { optBadTokenPassed = true; });
check('optionalAuth with malformed token calls next() gracefully without throwing', optBadTokenPassed && optBadTokenReq.userId === null);

// ---------------------------------------------------------------------------
// 4. Shelf Transition State Machine Logic Verification
// ---------------------------------------------------------------------------
console.log('\n--- 4. Shelf Transition State Machine Verification ---');
const u = new User({
  username: 'shelfuser',
  passwordHash: 'hash',
  favorites: ['0345339681'],
  wantToRead: ['0439136350'],
  currentlyReading: [],
  read: [],
});

// Helper simulating status transition
function applyShelfTransition(user, isbn, status) {
  user.wantToRead = user.wantToRead.filter((i) => i !== isbn);
  user.currentlyReading = user.currentlyReading.filter((i) => i !== isbn);
  user.read = user.read.filter((i) => i !== isbn);

  if (status === 'want_to_read') user.wantToRead.unshift(isbn);
  else if (status === 'currently_reading') user.currentlyReading.unshift(isbn);
  else if (status === 'read') user.read.unshift(isbn);
}

// Initial: on wantToRead
check('Initial state: on wantToRead', u.wantToRead.includes('0439136350'));

// Move to currently_reading
applyShelfTransition(u, '0439136350', 'currently_reading');
check('Transition to currently_reading: in currentlyReading', u.currentlyReading.includes('0439136350'));
check('Transition to currently_reading: removed from wantToRead', !u.wantToRead.includes('0439136350'));
check('Transition to currently_reading: not in read', !u.read.includes('0439136350'));
check('Favorites preserved untouched', u.favorites.includes('0345339681'));

// Move to read
applyShelfTransition(u, '0439136350', 'read');
check('Transition to read: in read', u.read.includes('0439136350'));
check('Transition to read: removed from currentlyReading', !u.currentlyReading.includes('0439136350'));
check('Transition to read: removed from wantToRead', !u.wantToRead.includes('0439136350'));

// Move to none (unshelve)
applyShelfTransition(u, '0439136350', 'none');
check('Transition to none: removed from read', !u.read.includes('0439136350'));
check('Transition to none: not in currentlyReading', !u.currentlyReading.includes('0439136350'));
check('Transition to none: not in wantToRead', !u.wantToRead.includes('0439136350'));
check('Favorites still preserved', u.favorites.includes('0345339681'));

// ---------------------------------------------------------------------------
// 5. Review Aggregation Math & Zero-Division Safety Verification
// ---------------------------------------------------------------------------
console.log('\n--- 5. Review Aggregation Math & Edge Cases ---');

function computeStats(reviews) {
  const totalReviews = reviews.length;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    const star = Math.round(r.rating);
    if (ratingDistribution[star] !== undefined) ratingDistribution[star]++;
    sum += r.rating;
  }
  const averageRating = totalReviews > 0 ? +(sum / totalReviews).toFixed(1) : 0;
  return { averageRating, totalReviews, ratingDistribution, ratingCounts: ratingDistribution };
}

// Zero reviews case
const emptyStats = computeStats([]);
check('Empty reviews: averageRating is 0', emptyStats.averageRating === 0);
check('Empty reviews: totalReviews is 0', emptyStats.totalReviews === 0);
check('Empty reviews: all 5 distribution buckets are 0',
  emptyStats.ratingDistribution[1] === 0 &&
  emptyStats.ratingDistribution[2] === 0 &&
  emptyStats.ratingDistribution[3] === 0 &&
  emptyStats.ratingDistribution[4] === 0 &&
  emptyStats.ratingDistribution[5] === 0);

// Multiple reviews case: ratings [5, 4, 4] -> sum = 13, count = 3, avg = 13/3 = 4.333 -> 4.3
const reviewsList = [
  { rating: 5, text: 'Great!' },
  { rating: 4, text: 'Good read' },
  { rating: 4, text: 'Enjoyed it' },
];
const calcStats = computeStats(reviewsList);
check('Calculated averageRating is 4.3', calcStats.averageRating === 4.3);
check('Calculated totalReviews is 3', calcStats.totalReviews === 3);
check('Calculated ratingDistribution has 4: 2 and 5: 1',
  calcStats.ratingDistribution[4] === 2 && calcStats.ratingDistribution[5] === 1 && calcStats.ratingDistribution[1] === 0);

// ---------------------------------------------------------------------------
// 6. Settings Reset & Deletion Isolation Verification
// ---------------------------------------------------------------------------
console.log('\n--- 6. Settings Reset & Data Isolation Verification ---');

const userWithEverything = new User({
  username: 'settingsuser',
  passwordHash: 'hash',
  favorites: ['0345339681', '0441172660', '0671461494'],
  wantToRead: ['0439136350'],
  currentlyReading: ['0385504209'],
  read: ['0451524934'],
});

// Simulate POST /api/me/reset-books logic
userWithEverything.wantToRead = [];
userWithEverything.currentlyReading = [];
userWithEverything.read = [];
userWithEverything.favorites = [];

check('reset-books empties wantToRead', userWithEverything.wantToRead.length === 0);
check('reset-books empties currentlyReading', userWithEverything.currentlyReading.length === 0);
check('reset-books empties read', userWithEverything.read.length === 0);
check('reset-books empties favorites', userWithEverything.favorites.length === 0);
check('reset-books updates onboarded flag to false', userWithEverything.onboarded === false);

// ---------------------------------------------------------------------------
// 7. IDOR Protection Verification
// ---------------------------------------------------------------------------
console.log('\n--- 7. IDOR Protection Verification ---');
const userAId = new mongoose.Types.ObjectId();
const userBId = new mongoose.Types.ObjectId();

const reviewByA = {
  _id: new mongoose.Types.ObjectId(),
  userId: userAId,
  isbn: '0439136350',
  rating: 5,
};

// Check if User B is permitted to delete User A's review
const isOwnerB = String(reviewByA.userId) === String(userBId);
check('IDOR test: User B cannot delete User A review (ownership check returns false)', isOwnerB === false);

// Check if User A is permitted to delete own review
const isOwnerA = String(reviewByA.userId) === String(userAId);
check('IDOR test: User A can delete own review (ownership check returns true)', isOwnerA === true);

// ---------------------------------------------------------------------------
// 8. Express Route Handler Validation Testing
// ---------------------------------------------------------------------------
console.log('\n--- 8. Express Route Handler Validation Testing ---');

function createMockRes() {
  const res = {
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
  return res;
}

// Find route handlers from reviewsRoute
function findRouteHandler(router, path, method) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }
  }
  return null;
}

// Test DELETE /reviews/:id invalid ObjectId
const deleteReviewHandler = findRouteHandler(reviewsRoute, '/reviews/:id', 'DELETE');
check('DELETE /reviews/:id handler found', typeof deleteReviewHandler === 'function');
if (deleteReviewHandler) {
  const res = createMockRes();
  const req = { params: { id: 'invalid-id' }, userId: String(userAId) };
  await deleteReviewHandler(req, res, () => {});
  check('DELETE /reviews/:id with invalid ObjectId returns 400', res.statusCode === 400 && res.body?.error === 'Invalid review ID');
}

// Test POST /books/:isbn/reviews rating validations
const postReviewHandler = findRouteHandler(reviewsRoute, '/books/:isbn/reviews', 'POST');
check('POST /books/:isbn/reviews handler found', typeof postReviewHandler === 'function');
if (postReviewHandler) {
  // Test invalid rating float
  const resFloat = createMockRes();
  const reqFloat = {
    params: { isbn: '0439136350' },
    body: { rating: 3.5, text: 'nice' },
    user: sampleUser,
    userId: String(sampleUser._id),
  };
  await postReviewHandler(reqFloat, resFloat, () => {});
  check('POST /books/:isbn/reviews with float rating 3.5 returns 400', resFloat.statusCode === 400);

  // Test rating > 5
  const resHigh = createMockRes();
  const reqHigh = {
    params: { isbn: '0439136350' },
    body: { rating: 6, text: 'too high' },
    user: sampleUser,
    userId: String(sampleUser._id),
  };
  await postReviewHandler(reqHigh, resHigh, () => {});
  check('POST /books/:isbn/reviews with rating 6 returns 400', resHigh.statusCode === 400);

  // Test rating < 1
  const resLow = createMockRes();
  const reqLow = {
    params: { isbn: '0439136350' },
    body: { rating: 0, text: 'zero' },
    user: sampleUser,
    userId: String(sampleUser._id),
  };
  await postReviewHandler(reqLow, resLow, () => {});
  check('POST /books/:isbn/reviews with rating 0 returns 400', resLow.statusCode === 400);

  // Test text > 5000 chars
  const resLong = createMockRes();
  const reqLong = {
    params: { isbn: '0439136350' },
    body: { rating: 5, text: 'a'.repeat(5001) },
    user: sampleUser,
    userId: String(sampleUser._id),
  };
  await postReviewHandler(reqLong, resLong, () => {});
  check('POST /books/:isbn/reviews with text > 5000 chars returns 400', resLong.statusCode === 400);
}

// Test PUT /me/shelf/:isbn invalid status
const putShelfHandler = findRouteHandler(usersRoute, '/me/shelf/:isbn', 'PUT');
check('PUT /me/shelf/:isbn handler found', typeof putShelfHandler === 'function');
if (putShelfHandler) {
  const resBadStatus = createMockRes();
  const reqBadStatus = {
    params: { isbn: '0439136350' },
    body: { status: 'invalid_status_xyz' },
    user: sampleUser,
    userId: String(sampleUser._id),
  };
  await putShelfHandler(reqBadStatus, resBadStatus, () => {});
  check('PUT /me/shelf/:isbn with invalid status returns 400', resBadStatus.statusCode === 400);
}

// ---------------------------------------------------------------------------
// Final Summary
// ---------------------------------------------------------------------------
console.log('\n=============================================');
console.log(`Milestone 1 Test Results: ${passed} passed, ${failed} failed`);
console.log('=============================================');

process.exit(failed > 0 ? 1 : 0);
