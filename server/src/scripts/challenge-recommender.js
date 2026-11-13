// Adversarial Empirical Challenge Suite for Milestone 2: 3-Book Recommendation Engine
// Validates:
// 1. Strict Title Exclusion Invariance (zero title similarity effect, w_title = 0)
// 2. Diversity Penalty Verification (single-seed author domination resistance)
// 3. Seed & Alternate Edition Exclusion (no seeds or seed work editions leak)
// 4. Boundary & Stress Benchmark (100 consecutive queries latency, orthogonal seeds)

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { engine, getThreeSeedCandidates } from '../recommender/engine.js';
import {
  computeHeuristicFeatures,
  scoreCandidate,
  recommendThree,
  DEFAULT_THREE_WEIGHTS,
} from '../recommender/algorithms.js';
import { inferGenres, inferTags, computeBaselineRating } from '../recommender/metadata.js';
import apiRouter from '../routes/api.js';

console.log('='.repeat(75));
console.log('  CHALLENGER 1: EMPIRICAL STRESS TEST FOR 3-BOOK RECOMMENDATION ENGINE');
console.log('='.repeat(75));

// Helper: Dispatch simulated Express request
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
        resolve({ status: statusCode, body: data });
      },
      send(data) {
        resolve({ status: statusCode, body: data });
      },
    };
    apiRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, body: { error: 'Not Found' } });
    });
  });
}

// Populate an in-memory catalog in engine state for controlled experiments
function setupCatalog(books) {
  const eng = engine();
  eng.ready = true;
  eng.books = books;
  eng.byIsbn = new Map();
  eng.byAuthor = new Map();
  eng.byGenre = new Map();
  eng.byTag = new Map();
  eng.byPublisher = new Map();
  eng.vectors = [];

  books.forEach((b, i) => {
    eng.byIsbn.set(b.isbn, i);
    if (b.aKey) {
      if (!eng.byAuthor.has(b.aKey)) eng.byAuthor.set(b.aKey, []);
      eng.byAuthor.get(b.aKey).push(i);
    }
    for (const g of b.genres || []) {
      if (!eng.byGenre.has(g)) eng.byGenre.set(g, []);
      eng.byGenre.get(g).push(i);
    }
    for (const t of b.tags || []) {
      if (!eng.byTag.has(t)) eng.byTag.set(t, []);
      eng.byTag.get(t).push(i);
    }
  });
  return eng;
}

const stats = { passed: 0, failed: 0 };

async function test(name, fn) {
  process.stdout.write(`• Running: ${name} ... `);
  try {
    await fn();
    console.log('✅ PASS');
    stats.passed++;
  } catch (err) {
    console.log('❌ FAIL');
    console.error(err);
    stats.failed++;
    throw err;
  }
}

// ===========================================================================
// SUITE 1: TITLE EXCLUSION INVARIANCE
// ===========================================================================
console.log('\n--- SUITE 1: TITLE EXCLUSION INVARIANCE ---');

await test('1.1: 50 Synthetic twin candidate pairs with radically divergent titles have EXACTLY 0.00000 score delta', async () => {
  const seeds = [
    { isbn: 'SEED-1', title: 'Harry Potter and the Sorcerer Stone', author: 'J. K. Rowling', aKey: 'rowling', genres: ['Fantasy'], tags: ['magic', 'wizard'], rating: 4.8, dKey: 'hp1' },
    { isbn: 'SEED-2', title: 'The Hobbit or There and Back Again', author: 'J. R. R. Tolkien', aKey: 'tolkien', genres: ['Fantasy'], tags: ['dragons', 'middle-earth'], rating: 4.7, dKey: 'hobbit' },
    { isbn: 'SEED-3', title: 'Dune: The Epic Galactic Saga', author: 'Frank Herbert', aKey: 'herbert', genres: ['Science Fiction'], tags: ['sci-fi', 'space'], rating: 4.6, dKey: 'dune' },
  ];

  const weightProfiles = [
    DEFAULT_THREE_WEIGHTS,
    { genre: 0.70, author: 0.10, tag: 0.10, rating: 0.10 },
    { genre: 0.10, author: 0.70, tag: 0.10, rating: 0.10 },
    { genre: 0.10, author: 0.10, tag: 0.70, rating: 0.10 },
    { genre: 0.10, author: 0.10, tag: 0.10, rating: 0.70 },
    { genre: 0.25, author: 0.25, tag: 0.25, rating: 0.25 },
    { genre: 100, author: 200, tag: 300, rating: 400 }, // unnormalized
    { genre: 0.9, author: 0, tag: 0, rating: 0 },
    { genre: 0, author: 0.9, tag: 0, rating: 0 },
    { genre: 0, author: 0, tag: 0, rating: 0.9 },
  ];

  for (let i = 0; i < 50; i++) {
    // Twin candidate A has heavy title keyword overlap with seeds
    const candA = {
      isbn: `TWIN-A-${i}`,
      title: `Harry Potter and the Dune Hobbit Chronicles Part ${i}`, // extreme title overlap
      author: `Test Author ${i % 5}`,
      aKey: `testauthor_${i % 5}`,
      genres: i % 2 === 0 ? ['Fantasy'] : ['Science Fiction'],
      tags: ['magic', 'sci-fi'],
      rating: 4.0 + (i % 10) * 0.1,
      dKey: `twin_work_a_${i}`,
    };

    // Twin candidate B has zero title overlap with seeds
    const candB = {
      isbn: `TWIN-B-${i}`,
      title: `Advanced Organic Chemistry & Inorganic Synthesis Manual Vol ${i}`, // zero title overlap
      author: `Test Author ${i % 5}`,
      aKey: `testauthor_${i % 5}`,
      genres: i % 2 === 0 ? ['Fantasy'] : ['Science Fiction'],
      tags: ['magic', 'sci-fi'],
      rating: 4.0 + (i % 10) * 0.1,
      dKey: `twin_work_b_${i}`,
    };

    const featA = computeHeuristicFeatures(candA, seeds);
    const featB = computeHeuristicFeatures(candB, seeds);

    // Assert exact feature equality
    assert.strictEqual(featA.author, featB.author, `Author feature mismatch in pair ${i}`);
    assert.strictEqual(featA.genre, featB.genre, `Genre feature mismatch in pair ${i}`);
    assert.strictEqual(featA.tag, featB.tag, `Tag feature mismatch in pair ${i}`);
    assert.strictEqual(featA.rating, featB.rating, `Rating feature mismatch in pair ${i}`);
    assert.strictEqual(featA.title, undefined, `candA must NOT contain title feature`);
    assert.strictEqual(featB.title, undefined, `candB must NOT contain title feature`);

    // Assert exact score equality across all 10 weight profiles
    for (const w of weightProfiles) {
      const scoreA = scoreCandidate(featA, w);
      const scoreB = scoreCandidate(featB, w);
      const delta = Math.abs(scoreA - scoreB);
      assert.strictEqual(delta, 0, `Score delta must be 0.00000, got ${delta} for pair ${i} with weights ${JSON.stringify(w)}`);
    }
  }
});

await test('1.2: Passing w_title or weights.title is strictly ignored by scoreCandidate', async () => {
  const feat = { author: 0.8, genre: 0.6, tag: 0.4, rating: 0.9 };

  // Weights with explicit title injection
  const wWithTitle = { title: 0.999, w_title: 0.999, genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 };
  const wWithoutTitle = { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 };

  const s1 = scoreCandidate(feat, wWithTitle);
  const s2 = scoreCandidate(feat, wWithoutTitle);

  assert.strictEqual(s1, s2, 'Title weight injection must have 0 effect on scoreCandidate');
});

await test('1.3: API POST /recommend/three sanitizes weights and declares titleExcluded: true', async () => {
  const catalog = [
    { isbn: 'S1', title: 'Seed Book One', author: 'Author 1', aKey: 'a1', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's1' },
    { isbn: 'S2', title: 'Seed Book Two', author: 'Author 2', aKey: 'a2', genres: ['Fantasy'], tags: ['dragons'], rating: 4.5, dKey: 's2' },
    { isbn: 'S3', title: 'Seed Book Three', author: 'Author 3', aKey: 'a3', genres: ['Science Fiction'], tags: ['space'], rating: 4.5, dKey: 's3' },
    { isbn: 'C1', title: 'Seed Book One Special Edition', author: 'Author 4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'c1' },
    { isbn: 'C2', title: 'Completely Different Title', author: 'Author 4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'c2' },
  ];
  setupCatalog(catalog);

  const res = await dispatch('POST', '/recommend/three', {
    seeds: ['S1', 'S2', 'S3'],
    weights: {
      title: 0.99,
      w_title: 0.99,
      genre: 0.4,
      author: 0.3,
      tag: 0.2,
      rating: 0.1,
    },
    limit: 5,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.diagnostics.titleExcluded, true);
  assert.strictEqual(res.body.diagnostics.weightsUsed.title, undefined);
  assert.strictEqual(res.body.diagnostics.weightsUsed.w_title, undefined);

  // C1 and C2 have identical author (a4), genres (Fantasy), tags (magic), rating (4.5)
  // Even though C1 shares title tokens with S1 ("Seed Book One Special Edition"), both must score identically!
  const candC1 = res.body.candidates.find((c) => c.isbn === 'C1');
  const candC2 = res.body.candidates.find((c) => c.isbn === 'C2');
  assert.ok(candC1 && candC2, 'Both candidates must be present in recommendations');
  assert.strictEqual(candC1.score, candC2.score, 'Candidates C1 and C2 must have identical score despite title differences');
});

// ===========================================================================
// SUITE 2: DIVERSITY PENALTY & DOMINATION RESISTANCE
// ===========================================================================
console.log('\n--- SUITE 2: DIVERSITY PENALTY & DOMINATION RESISTANCE ---');

await test('2.1: Greedy diversity penalty prevents prolific author from completely monopolizing top picks', async () => {
  // Scenario:
  // Seed A is by Stephen King.
  // Seed B is by J.K. Rowling.
  // Seed C is by Frank Herbert.
  // Catalog has 25 books by Stephen King (Seed A) and 5 books by Rowling, 5 by Herbert.
  // All have matching genre 'Horror' or 'Fantasy'.
  // Without diversity penalty, Stephen King books would take all 10 recommendation slots.
  // With diversity penalty (0.85^used), subsequent King books are penalized and Rowling/Herbert books get selected.

  const books = [
    { isbn: 'SEED-A', title: 'The Shining', author: 'Stephen King', aKey: 'king', genres: ['Horror'], tags: ['haunted'], rating: 4.6, dKey: 'shining' },
    { isbn: 'SEED-B', title: 'Harry Potter 1', author: 'J. K. Rowling', aKey: 'rowling', genres: ['Fantasy'], tags: ['magic'], rating: 4.7, dKey: 'hp1' },
    { isbn: 'SEED-C', title: 'Dune', author: 'Frank Herbert', aKey: 'herbert', genres: ['Science Fiction'], tags: ['space'], rating: 4.5, dKey: 'dune' },
  ];

  // 25 King candidate books
  for (let i = 1; i <= 25; i++) {
    books.push({
      isbn: `KING-${i}`,
      title: `King Novel ${i}`,
      author: 'Stephen King',
      aKey: 'king',
      genres: ['Horror'],
      tags: ['haunted'],
      rating: 4.5,
      dKey: `king_novel_${i}`,
    });
  }

  // 5 Rowling candidate books
  for (let i = 2; i <= 6; i++) {
    books.push({
      isbn: `ROWLING-${i}`,
      title: `Rowling Book ${i}`,
      author: 'J. K. Rowling',
      aKey: 'rowling',
      genres: ['Fantasy'],
      tags: ['magic'],
      rating: 4.4,
      dKey: `rowling_book_${i}`,
    });
  }

  // 5 Herbert candidate books
  for (let i = 2; i <= 6; i++) {
    books.push({
      isbn: `HERBERT-${i}`,
      title: `Herbert Novel ${i}`,
      author: 'Frank Herbert',
      aKey: 'herbert',
      genres: ['Science Fiction'],
      tags: ['space'],
      rating: 4.3,
      dKey: `herbert_novel_${i}`,
    });
  }

  setupCatalog(books);

  const res = recommendThree(['SEED-A', 'SEED-B', 'SEED-C'], DEFAULT_THREE_WEIGHTS, 10);
  assert.strictEqual(res.candidates.length, 10);

  const countsBySeed = {};
  for (const c of res.candidates) {
    countsBySeed[c.bestSeed] = (countsBySeed[c.bestSeed] || 0) + 1;
  }

  console.log(`\n    Recommendation distribution across seeds (limit 10):`);
  console.log(`    - Seed A (King, 25 in catalog): ${countsBySeed['SEED-A'] || 0} books`);
  console.log(`    - Seed B (Rowling, 5 in catalog): ${countsBySeed['SEED-B'] || 0} books`);
  console.log(`    - Seed C (Herbert, 5 in catalog): ${countsBySeed['SEED-C'] || 0} books`);

  // Assertions on diversity
  assert.ok(countsBySeed['SEED-A'] < 10, 'King must NOT capture all 10 slots (diversity penalty must restrict domination)');
  assert.ok((countsBySeed['SEED-B'] || 0) > 0, 'Seed B (Rowling) must have at least 1 book selected');
  assert.ok((countsBySeed['SEED-C'] || 0) > 0, 'Seed C (Herbert) must have at least 1 book selected');
  assert.ok(countsBySeed['SEED-A'] <= 6, 'King should not have more than 6 slots out of 10');
});

// ===========================================================================
// SUITE 3: SEED EXCLUSION & WORK DEDUPLICATION
// ===========================================================================
console.log('\n--- SUITE 3: SEED EXCLUSION & WORK DEDUPLICATION ---');

await test('3.1: Seed books and alternate editions with identical dKey NEVER leak into recommendations', async () => {
  const books = [
    { isbn: 'SEED-X', title: 'The Great Work (Hardcover)', author: 'Author X', aKey: 'ax', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'great_work' },
    { isbn: 'SEED-Y', title: 'Second Work', author: 'Author Y', aKey: 'ay', genres: ['Fantasy'], tags: ['magic'], rating: 4.7, dKey: 'second_work' },
    { isbn: 'SEED-Z', title: 'Third Work', author: 'Author Z', aKey: 'az', genres: ['Fantasy'], tags: ['magic'], rating: 4.6, dKey: 'third_work' },

    // Alternate editions of SEED-X with identical dKey but different ISBNs and titles
    { isbn: 'ALT-X1', title: 'The Great Work (Paperback Edition)', author: 'Author X', aKey: 'ax', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'great_work' },
    { isbn: 'ALT-X2', title: 'The Great Work [Audiobook Edition]', author: 'Author X', aKey: 'ax', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'great_work' },
    { isbn: 'ALT-X3', title: 'The Great Work: 10th Anniversary Deluxe', author: 'Author X', aKey: 'ax', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'great_work' },

    // Alternate editions of SEED-Y
    { isbn: 'ALT-Y1', title: 'Second Work (Mass Market)', author: 'Author Y', aKey: 'ay', genres: ['Fantasy'], tags: ['magic'], rating: 4.7, dKey: 'second_work' },

    // Legitimate candidate books
    { isbn: 'LEGIT-1', title: 'A Legitimate Recommendation 1', author: 'Author X', aKey: 'ax', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'legit_1' },
    { isbn: 'LEGIT-2', title: 'A Legitimate Recommendation 2', author: 'Author Y', aKey: 'ay', genres: ['Fantasy'], tags: ['magic'], rating: 4.4, dKey: 'legit_2' },
    { isbn: 'LEGIT-3', title: 'A Legitimate Recommendation 3', author: 'Author Z', aKey: 'az', genres: ['Fantasy'], tags: ['magic'], rating: 4.3, dKey: 'legit_3' },
  ];

  setupCatalog(books);

  const res = recommendThree(['SEED-X', 'SEED-Y', 'SEED-Z'], DEFAULT_THREE_WEIGHTS, 10);

  const returnedIsbns = new Set(res.candidates.map((c) => c.isbn));
  const returnedTitles = res.candidates.map((c) => c.title);

  // Exact seeds excluded
  assert.ok(!returnedIsbns.has('SEED-X'), 'SEED-X must not be recommended');
  assert.ok(!returnedIsbns.has('SEED-Y'), 'SEED-Y must not be recommended');
  assert.ok(!returnedIsbns.has('SEED-Z'), 'SEED-Z must not be recommended');

  // Alternate editions of seeds excluded
  assert.ok(!returnedIsbns.has('ALT-X1'), 'ALT-X1 (paperback edition of seed X) must be excluded');
  assert.ok(!returnedIsbns.has('ALT-X2'), 'ALT-X2 (audiobook edition of seed X) must be excluded');
  assert.ok(!returnedIsbns.has('ALT-X3'), 'ALT-X3 (deluxe edition of seed X) must be excluded');
  assert.ok(!returnedIsbns.has('ALT-Y1'), 'ALT-Y1 (edition of seed Y) must be excluded');

  // Only legitimate books recommended
  assert.ok(returnedIsbns.has('LEGIT-1'), 'LEGIT-1 should be recommended');
  assert.ok(returnedIsbns.has('LEGIT-2'), 'LEGIT-2 should be recommended');
  assert.ok(returnedIsbns.has('LEGIT-3'), 'LEGIT-3 should be recommended');
});

await test('3.2: Candidate work duplicates collapse to single highest scoring edition', async () => {
  const books = [
    { isbn: 'S1', title: 'Seed 1', author: 'A1', aKey: 'a1', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's1' },
    { isbn: 'S2', title: 'Seed 2', author: 'A2', aKey: 'a2', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's2' },
    { isbn: 'S3', title: 'Seed 3', author: 'A3', aKey: 'a3', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's3' },

    // 4 editions of the same candidate work W with different ratings
    { isbn: 'W-LOW', title: 'Work W (Old Paperback)', author: 'A4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 3.5, dKey: 'work_w' },
    { isbn: 'W-HIGH', title: 'Work W (Definitive Edition)', author: 'A4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.9, dKey: 'work_w' },
    { isbn: 'W-MID1', title: 'Work W (Hardcover)', author: 'A4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.2, dKey: 'work_w' },
    { isbn: 'W-MID2', title: 'Work W [Audiobook]', author: 'A4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.1, dKey: 'work_w' },
  ];

  setupCatalog(books);
  const res = recommendThree(['S1', 'S2', 'S3'], DEFAULT_THREE_WEIGHTS, 5);

  const workWEntries = res.candidates.filter((c) => c.isbn.startsWith('W-'));
  assert.strictEqual(workWEntries.length, 1, 'Exactly one edition of Work W must appear in recommendations');
  assert.strictEqual(workWEntries[0].isbn, 'W-HIGH', 'The highest scoring edition (W-HIGH) must be the one retained');
});

// ===========================================================================
// SUITE 4: BOUNDARY CONDITIONS & STRESS BENCHMARK
// ===========================================================================
console.log('\n--- SUITE 4: BOUNDARY CONDITIONS & STRESS BENCHMARK ---');

await test('4.1: API validates identical seeds with 400 Bad Request', async () => {
  const res1 = await dispatch('POST', '/recommend/three', {
    seeds: ['S1', 'S1', 'S1'],
  });
  assert.strictEqual(res1.status, 400);
  assert.match(res1.body.error, /3 distinct books/);

  const res2 = await dispatch('POST', '/recommend/three', {
    seeds: ['S1', 'S1', 'S2'],
  });
  assert.strictEqual(res2.status, 400);
  assert.match(res2.body.error, /3 distinct books/);

  const res3 = await dispatch('POST', '/recommend/three', {
    seeds: ['S1', 'S2'],
  });
  assert.strictEqual(res3.status, 400);
  assert.match(res3.body.error, /3 seed book/);
});

await test('4.2: Orthogonal seeds (different genres and authors) produce coherent recommendations', async () => {
  const books = [
    { isbn: 'ORTHO-1', title: 'The Lord of the Rings', author: 'J. R. R. Tolkien', aKey: 'tolkien', genres: ['Fantasy'], tags: ['magic', 'dragons'], rating: 4.9, dKey: 'lotr' },
    { isbn: 'ORTHO-2', title: 'Pride and Prejudice', author: 'Jane Austen', aKey: 'austen', genres: ['Romance'], tags: ['romance', 'classic-era'], rating: 4.7, dKey: 'pride' },
    { isbn: 'ORTHO-3', title: 'A Brief History of Time', author: 'Stephen Hawking', aKey: 'hawking', genres: ['Science & Nature'], tags: ['physics', 'science'], rating: 4.6, dKey: 'history_time' },

    // Candidates in each genre
    { isbn: 'C-FANTASY', title: 'The Silmarillion', author: 'J. R. R. Tolkien', aKey: 'tolkien', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'silmarillion' },
    { isbn: 'C-ROMANCE', title: 'Sense and Sensibility', author: 'Jane Austen', aKey: 'austen', genres: ['Romance'], tags: ['romance'], rating: 4.4, dKey: 'sense' },
    { isbn: 'C-SCIENCE', title: 'The Universe in a Nutshell', author: 'Stephen Hawking', aKey: 'hawking', genres: ['Science & Nature'], tags: ['physics'], rating: 4.5, dKey: 'nutshell' },
  ];

  setupCatalog(books);
  const res = recommendThree(['ORTHO-1', 'ORTHO-2', 'ORTHO-3'], DEFAULT_THREE_WEIGHTS, 5);

  assert.strictEqual(res.candidates.length, 3);
  for (const c of res.candidates) {
    assert.ok(!isNaN(c.score), `Candidate ${c.isbn} score must be valid number, got NaN`);
    assert.ok(c.score > 0 && c.score <= 1.0, `Score must be in (0, 1], got ${c.score}`);
    assert.ok(c.explanation.length > 5, 'Explanation must be generated');
  }
});

await test('4.3: Latency under stress benchmark (100 consecutive queries on 1,500 book catalog)', async () => {
  // Construct a realistic catalog with 1,500 books across 16 genres and diverse authors
  const catalogSize = 1500;
  const stressCatalog = [];

  const genreList = [
    'Fantasy', 'Science Fiction', 'Mystery & Thriller', 'Romance',
    'Historical Fiction', 'Horror', 'Classics & Literature', 'Biography & Memoir',
    'Philosophy & Religion', 'Science & Nature', 'History & Politics', 'General Fiction'
  ];

  for (let i = 0; i < catalogSize; i++) {
    const gIndex = i % genreList.length;
    const aIndex = i % 80;
    stressCatalog.push({
      isbn: `ISBN-${1000000 + i}`,
      title: `Stress Test Catalog Book Title Volume ${i}`,
      author: `Author Number ${aIndex}`,
      aKey: `author_${aIndex}`,
      genres: [genreList[gIndex], genreList[(gIndex + 1) % genreList.length]],
      tags: [`tag_${i % 50}`, `tag_${(i + 7) % 50}`, 'classic-era'],
      rating: 3.5 + (i % 15) * 0.1,
      dKey: `stress_work_${Math.floor(i / 2)}`, // some alternate editions
    });
  }

  setupCatalog(stressCatalog);

  const querySeeds = [
    [stressCatalog[0].isbn, stressCatalog[50].isbn, stressCatalog[100].isbn],
    [stressCatalog[10].isbn, stressCatalog[60].isbn, stressCatalog[110].isbn],
    [stressCatalog[20].isbn, stressCatalog[70].isbn, stressCatalog[120].isbn],
    [stressCatalog[30].isbn, stressCatalog[80].isbn, stressCatalog[130].isbn],
    [stressCatalog[40].isbn, stressCatalog[90].isbn, stressCatalog[140].isbn],
  ];

  const iterations = 100;
  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const seeds = querySeeds[i % querySeeds.length];
    const t0 = performance.now();
    const res = recommendThree(seeds, DEFAULT_THREE_WEIGHTS, 12);
    const ms = performance.now() - t0;
    latencies.push(ms);
    assert.strictEqual(res.candidates.length, 12);
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = sum / latencies.length;
  const median = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`\n    Latency Benchmark (100 queries, 1,500 catalog items):`);
  console.log(`    - Min:    ${min.toFixed(2)} ms`);
  console.log(`    - Mean:   ${mean.toFixed(2)} ms`);
  console.log(`    - Median: ${median.toFixed(2)} ms`);
  console.log(`    - P95:    ${p95.toFixed(2)} ms`);
  console.log(`    - P99:    ${p99.toFixed(2)} ms`);
  console.log(`    - Max:    ${max.toFixed(2)} ms`);

  // Assert latency targets (< 50ms mean, < 100ms p99)
  assert.ok(mean < 50.0, `Mean latency must be < 50.0ms, got ${mean.toFixed(2)}ms`);
  assert.ok(p99 < 100.0, `P99 latency must be < 100.0ms, got ${p99.toFixed(2)}ms`);
});

// ===========================================================================
// SUITE 5: ADVERSARIAL EDGE CASES & METADATA RESILIENCE
// ===========================================================================
console.log('\n--- SUITE 5: ADVERSARIAL EDGE CASES & METADATA RESILIENCE ---');

await test('5.1: Malformed and boundary API payloads are rejected with descriptive 400 errors', async () => {
  // Seeds not an array
  const r1 = await dispatch('POST', '/recommend/three', { seeds: 'not-an-array' });
  assert.strictEqual(r1.status, 400);

  // Less than 3 seeds
  const r2 = await dispatch('POST', '/recommend/three', { seeds: ['S1', 'S2'] });
  assert.strictEqual(r2.status, 400);

  // More than 3 seeds
  const r3 = await dispatch('POST', '/recommend/three', { seeds: ['S1', 'S2', 'S3', 'S4'] });
  assert.strictEqual(r3.status, 400);

  // Non-existent ISBN
  const r4 = await dispatch('POST', '/recommend/three', { seeds: ['S1', 'S2', 'NON_EXISTENT_ISBN_99999'] });
  assert.strictEqual(r4.status, 400);
  assert.match(r4.body.error, /Unknown seed ISBN/);

  const validSeeds = engine().books.slice(0, 3).map((b) => b.isbn);

  // Negative weights
  const r5 = await dispatch('POST', '/recommend/three', { seeds: validSeeds, weights: { genre: -0.5 } });
  assert.strictEqual(r5.status, 400);
  assert.match(r5.body.error, /non-negative/);

  // NaN weights
  const r6 = await dispatch('POST', '/recommend/three', { seeds: validSeeds, weights: { genre: 'abc' } });
  assert.strictEqual(r6.status, 400);

  // All-zero weights
  const r7 = await dispatch('POST', '/recommend/three', { seeds: validSeeds, weights: { genre: 0, author: 0, tag: 0, rating: 0 } });
  assert.strictEqual(r7.status, 400);
  assert.match(r7.body.error, /greater than zero/);
});

await test('5.2: Catalog starvation handles gracefully (0 candidates without throwing)', async () => {
  // Catalog with ONLY the 3 seeds
  const starvedCatalog = [
    { isbn: 'ISO-1', title: 'Isolated Seed 1', author: 'Author 1', aKey: 'a1', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'iso_1' },
    { isbn: 'ISO-2', title: 'Isolated Seed 2', author: 'Author 2', aKey: 'a2', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'iso_2' },
    { isbn: 'ISO-3', title: 'Isolated Seed 3', author: 'Author 3', aKey: 'a3', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'iso_3' },
  ];
  setupCatalog(starvedCatalog);

  const res = recommendThree(['ISO-1', 'ISO-2', 'ISO-3'], DEFAULT_THREE_WEIGHTS, 10);
  assert.strictEqual(res.candidates.length, 0, 'Candidates must be empty when catalog only contains seeds');
  assert.strictEqual(res.diagnostics.candidatesEvaluated, 0);
  assert.strictEqual(res.diagnostics.titleExcluded, true);
});

await test('5.3: Sparse metadata candidates (missing genre, tag, author, rating) evaluate without NaN', async () => {
  const sparseCatalog = [
    { isbn: 'SP-1', title: 'Seed 1', author: 'A1', aKey: 'a1', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'sp_1' },
    { isbn: 'SP-2', title: 'Seed 2', author: 'A2', aKey: 'a2', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'sp_2' },
    { isbn: 'SP-3', title: 'Seed 3', author: 'A3', aKey: 'a3', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'sp_3' },

    // Candidate with completely blank / undefined metadata
    { isbn: 'CAND-BLANK', title: 'A Book with No Metadata', author: '', aKey: '', genres: [], tags: [], rating: undefined, dKey: 'blank' },
  ];
  setupCatalog(sparseCatalog);

  const res = recommendThree(['SP-1', 'SP-2', 'SP-3'], DEFAULT_THREE_WEIGHTS, 5);
  const cand = res.candidates.find((c) => c.isbn === 'CAND-BLANK');
  if (cand) {
    assert.ok(!isNaN(cand.score), 'Score must not be NaN');
    assert.ok(cand.score >= 0 && cand.score <= 1.0, 'Score must be within [0, 1]');
  }
});

await test('5.4: Strict Exclusion of Title Tokens in inferTags', async () => {
  // Verify that inferTags NEVER extracts tokens from book.title:
  // e.g. "The Dragon King" must NOT get tag "dragon".
  const seed = { isbn: 'S-DRAGON', title: 'The Dragon King', author: 'A1', aKey: 'a1', year: 2000 };
  const candWithMatchingTitleToken = { isbn: 'C-DRAGON', title: 'Dragon Rider', author: 'A2', aKey: 'a2', year: 2000 };
  const candWithoutMatchingTitleToken = { isbn: 'C-FLOWER', title: 'Flower Garden', author: 'A2', aKey: 'a2', year: 2000 };

  const tagsSeed = inferTags(seed);
  const tagsCand1 = inferTags(candWithMatchingTitleToken);
  const tagsCand2 = inferTags(candWithoutMatchingTitleToken);

  console.log(`\n    inferTags tokens extracted from titles:`);
  console.log(`    - Seed ("${seed.title}"): [${tagsSeed.join(', ')}]`);
  console.log(`    - Candidate 1 ("${candWithMatchingTitleToken.title}"): [${tagsCand1.join(', ')}]`);
  console.log(`    - Candidate 2 ("${candWithoutMatchingTitleToken.title}"): [${tagsCand2.join(', ')}]`);

  assert.ok(!tagsSeed.includes('dragon'), 'inferTags must NEVER extract title words like "dragon" as tags');
  assert.ok(!tagsCand1.includes('dragon'), 'inferTags must NEVER extract title words like "dragon" as tags');
  assert.ok(!tagsCand2.includes('flower'), 'inferTags must NEVER extract title words like "flower" as tags');

  // Candidate 1 must NOT share 'dragon' tag with seed purely based on title word
  const shared1 = tagsCand1.filter((t) => tagsSeed.includes(t));
  const shared2 = tagsCand2.filter((t) => tagsSeed.includes(t));

  console.log(`    - Candidate 1 tag overlap with Seed: [${shared1.join(', ')}]`);
  console.log(`    - Candidate 2 tag overlap with Seed: [${shared2.join(', ')}]`);

  assert.ok(!shared1.includes('dragon'), 'inferTags must not allow title tokens to enter tag feature');
  assert.deepEqual(shared1, shared2, 'Tag overlap with seed must be identical despite title word overlap');
});

// ===========================================================================
// SUMMARY
// ===========================================================================
console.log('\n' + '='.repeat(75));
console.log(`  CHALLENGE SUITE COMPLETE: ${stats.passed} PASSED, ${stats.failed} FAILED`);
console.log('='.repeat(75));

if (stats.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
