// Integration verification for M2 endpoints using direct router request/response dispatch:
// 1. GET /health
// 2. GET /dev/diagnostics
// 3. POST /recommend/three
// 4. POST /recommend/sentiment-adapted
import assert from 'node:assert/strict';
import apiRouter from '../routes/api.js';
import { engine } from '../recommender/engine.js';

console.log('🧪 Starting API Routes Integration Test (Mock Dispatch)...\n');

// Mock index in engine state
const eng = engine();
eng.ready = true;
eng.books = [
  { isbn: '0439136350', title: 'Harry Potter Azkaban', author: 'J. K. Rowling', aKey: 'jkrowling', genres: ['Fantasy'], tags: ['magic'], rating: 4.6, dKey: 'hp3' },
  { isbn: '0345339681', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['dragons'], rating: 4.7, dKey: 'hobbit' },
  { isbn: '0060973129', title: 'The Joy Luck Club', author: 'Amy Tan', aKey: 'amytan', genres: ['General Fiction'], tags: ['classic-era'], rating: 4.2, dKey: 'joy luck' },
  { isbn: '0545010225', title: 'Harry Potter Hallows', author: 'J. K. Rowling', aKey: 'jkrowling', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'hp7' },
  { isbn: '0345339703', title: 'The Fellowship of the Ring', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['dragons'], rating: 4.7, dKey: 'lotr1' },
];

eng.byIsbn = new Map();
eng.byAuthor = new Map();
eng.byGenre = new Map();
eng.byTag = new Map();

eng.books.forEach((b, i) => {
  eng.byIsbn.set(b.isbn, i);
  if (!eng.byAuthor.has(b.aKey)) eng.byAuthor.set(b.aKey, []);
  eng.byAuthor.get(b.aKey).push(i);
  for (const g of b.genres) {
    if (!eng.byGenre.has(g)) eng.byGenre.set(g, []);
    eng.byGenre.get(g).push(i);
  }
  for (const t of b.tags) {
    if (!eng.byTag.has(t)) eng.byTag.set(t, []);
    eng.byTag.get(t).push(i);
  }
});

// Helper to simulate router invocation
function dispatch(method, url, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      body,
      query,
      params: {},
    };

    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, data });
      },
      send(data) {
        resolve({ status: statusCode, data });
      },
    };

    apiRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, data: { error: 'Not Found' } });
    });
  });
}

// Test 1: GET /health
{
  const res = await dispatch('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
  assert.equal(res.data.ready, true);
  assert.equal(res.data.features.titleExcluded, true);
  console.log('  ✅ GET /health passed.');
}

// Test 2: GET /dev/diagnostics
{
  const res = await dispatch('GET', '/dev/diagnostics');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
  assert.equal(res.data.recommender.titleExcluded, true);
  assert.equal(res.data.recommender.seedCount, 3);
  console.log('  ✅ GET /dev/diagnostics passed.');
}

// Test 3: POST /recommend/three - Happy Path
{
  const payload = {
    seeds: ['0439136350', '0345339681', '0060973129'],
    weights: { genre: 0.4, author: 0.3, tag: 0.2, rating: 0.1 },
    limit: 5,
  };
  const res = await dispatch('POST', '/recommend/three', payload);
  assert.equal(res.status, 200);
  assert(Array.isArray(res.data.candidates), 'candidates must be array');
  assert.equal(res.data.diagnostics.titleExcluded, true);
  assert.equal(res.data.diagnostics.seedCount, 3);
  assert.equal(res.data.diagnostics.weightsUsed.genre, 0.4);
  assert.equal(res.data.diagnostics.weightsUsed.title, undefined);
  console.log('  ✅ POST /recommend/three happy path passed.');
}

// Test 4: POST /recommend/three - Validation (Error cases)
{
  // Less than 3 seeds
  const res1 = await dispatch('POST', '/recommend/three', { seeds: ['0439136350', '0345339681'] });
  assert.equal(res1.status, 400);

  // Duplicate seeds
  const res2 = await dispatch('POST', '/recommend/three', { seeds: ['0439136350', '0439136350', '0345339681'] });
  assert.equal(res2.status, 400);

  // Unknown seed
  const res3 = await dispatch('POST', '/recommend/three', { seeds: ['0439136350', '0345339681', '9999999999'] });
  assert.equal(res3.status, 400);

  console.log('  ✅ POST /recommend/three input validations passed.');
}

// Test 5: POST /recommend/sentiment-adapted - Positive
{
  const payload = {
    reviewText: 'A breathtaking masterpiece! Incredible magic and fast-paced adventure.',
    targetIsbn: '0439136350',
    rating: 5,
    limit: 4,
  };
  const res = await dispatch('POST', '/recommend/sentiment-adapted', payload);
  assert.equal(res.status, 200);
  assert(res.data.sentiment, 'Response must have sentiment');
  assert.equal(res.data.sentiment.label, 'positive');
  assert(res.data.sentiment.score >= 0.20);
  assert(Array.isArray(res.data.adaptedRecommendations));
  assert.equal(res.data.diagnostics.titleExcluded, true);
  assert.equal(res.data.diagnostics.adaptationStrategy, 'positive_reinforce');
  console.log('  ✅ POST /recommend/sentiment-adapted positive review passed.');
}

// Test 6: POST /recommend/sentiment-adapted - Negative
{
  const payload = {
    reviewText: 'Disappointing and slow-dragging. Plodding plot and terrible ending.',
    targetIsbn: '0439136350',
    rating: 1,
    limit: 4,
  };
  const res = await dispatch('POST', '/recommend/sentiment-adapted', payload);
  assert.equal(res.status, 200);
  assert.equal(res.data.sentiment.label, 'negative');
  assert(res.data.sentiment.score <= -0.20);
  assert.equal(res.data.diagnostics.adaptationStrategy, 'negative_contrast');
  assert.equal(res.data.diagnostics.titleExcluded, true);
  console.log('  ✅ POST /recommend/sentiment-adapted negative review passed.');
}

// Test 7: POST /recommend/sentiment-adapted - Double Negation ("not without merit")
{
  const payload = {
    reviewText: 'It is not without merit, and possesses genuine literary depth.',
    targetIsbn: '0439136350',
    rating: 4,
    limit: 4,
  };
  const res = await dispatch('POST', '/recommend/sentiment-adapted', payload);
  assert.equal(res.status, 200);
  assert.equal(res.data.sentiment.label, 'positive');
  assert(res.data.sentiment.score > 0.0);
  assert.equal(res.data.diagnostics.adaptationStrategy, 'positive_reinforce');
  console.log('  ✅ POST /recommend/sentiment-adapted double negation passed.');
}

// Test 8: POST /recommend/sentiment-adapted - Aspect Pacing Discrimination ("slow-burn")
{
  const payload = {
    reviewText: 'A wonderful slow-burn romance with compelling characters and rich world.',
    targetIsbn: '0439136350',
    rating: 5,
    limit: 4,
  };
  const res = await dispatch('POST', '/recommend/sentiment-adapted', payload);
  assert.equal(res.status, 200);
  assert.equal(res.data.sentiment.label, 'positive');
  assert(res.data.sentiment.aspects.includes('slow-burn'), 'Must include slow-burn aspect');
  assert(!res.data.sentiment.aspects.includes('slow-dragging'), 'slow-burn must NOT trigger slow-dragging aspect');
  assert.equal(res.data.diagnostics.adaptationStrategy, 'positive_reinforce');
  console.log('  ✅ POST /recommend/sentiment-adapted aspect pacing isolation passed.');
}

console.log('\n🎉 ALL API ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY!');
