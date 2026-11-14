// Empirical Challenger 1 (Round 2) Verification Script
// Deeply tests:
// 1. Strict Title Exclusion Invariance (0.00000 delta, inferTags title decoupling)
// 2. Diversity Penalty Dynamics (monopoly resistance, mathematical decay)
// 3. Seed Self-Exclusion & Work Edition Deduplication
// 4. Adversarial Metadata & Edge Conditions

import assert from 'node:assert/strict';
import { engine, getThreeSeedCandidates } from '../recommender/engine.js';
import {
  computeHeuristicFeatures,
  scoreCandidate,
  recommendThree,
  DEFAULT_THREE_WEIGHTS,
} from '../recommender/algorithms.js';
import { inferGenres, inferTags, computeBaselineRating } from '../recommender/metadata.js';
import apiRouter from '../routes/api.js';

console.log('='.repeat(80));
console.log('  CHALLENGER 1 (ROUND 2): INDEPENDENT EMPIRICAL VERIFICATION HARNESS');
console.log('='.repeat(80));

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

let passed = 0;
let failed = 0;

async function runCheck(desc, fn) {
  process.stdout.write(`• Checking: ${desc} ... `);
  try {
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log('❌ FAIL');
    console.error(err);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// PART 1: STRICT TITLE EXCLUSION & INFERTAGS PURITY
// ---------------------------------------------------------------------------
console.log('\n--- PART 1: STRICT TITLE EXCLUSION & INFERTAGS PURITY ---');

await runCheck('1.1: inferTags does NOT extract any tokens from book.title under 20 diverse titles', async () => {
  const testTitles = [
    'The Dragon of Avalon and the Magic Sword',
    'Space Odyssey: Alien Stars and Quantum Galaxies',
    'Murder at the Manor: Detective Mystery Crime',
    'A Vampire Nightmare in the Haunted Darkness',
    'Harlequin Passion: Beloved Romantic Wedding',
    'The Medieval King and the Roman Crusade Empire',
    'Quantum Physics, Biology and the Wild Cosmos',
    'The Great Gatsby and Classic Literature Anthology',
    'Philosophy of God, Faith, Soul and Zen Meditation',
    'The Cold War, Revolution and Geopolitics',
    'Habits of Success: Mindfulness, Therapy and Wealth',
    'The Adventures of Fairy Princess and Disney Junior',
    'Sonnets, Poems and Dramatic Verse Tragedy',
    'Vegetarian Recipes: Gourmet Culinary Kitchen',
    'General Contemporary Novel of Everyday Life',
    'Supercalifragilisticexpialidocious Mystery',
    'Harry Potter and the Chamber of Secrets',
    'Dune Messiah and the Spacing Guild',
    'The Fellowship of the Ring: Return of the King',
    'A Game of Thrones and A Clash of Kings',
  ];

  for (const title of testTitles) {
    const book = {
      title,
      author: 'Unknown Author',
      year: 2015,
      publisher: 'Vintage',
    };
    const tags = inferTags(book);
    const tokens = title.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length > 2);

    for (const tok of tokens) {
      // Tags must NOT be any of the title tokens unless independently derived (e.g. from year '2010s' or publisher 'trade-edition')
      assert.ok(
        !tags.includes(tok),
        `Token "${tok}" from title "${title}" leaked into inferTags: [${tags.join(', ')}]`
      );
    }
  }
});

await runCheck('1.2: inferTags produces identical tags when title is mutated/erased, holding author/year/pub/genre constant', async () => {
  const baseBook = {
    author: 'J. R. R. Tolkien',
    aKey: 'jrrtolkien',
    year: 1985,
    publisher: 'Del Rey',
    genres: ['Fantasy'],
  };

  const variants = [
    '',
    'The Lord of the Rings: Fellowship of the Ring',
    'Space Aliens Attack the Starfleet',
    'Modern Romance and Deep Love in Paris',
    'Advanced Quantum Mechanics and Thermodynamics',
    'Random Noise 12345 @#$%^&*()_+',
    null,
    undefined,
  ];

  const referenceTags = inferTags({ ...baseBook, title: 'The Hobbit' });

  for (const variantTitle of variants) {
    const tags = inferTags({ ...baseBook, title: variantTitle });
    assert.deepEqual(
      tags,
      referenceTags,
      `inferTags output varied with title "${variantTitle}" vs reference: [${tags.join(', ')}] vs [${referenceTags.join(', ')}]`
    );
  }
});

await runCheck('1.3: 100 candidate twin pairs with identical metadata but conflicting titles have EXACTLY 0.00000 score delta', async () => {
  const seeds = [
    { isbn: 'S-A', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'tolkien', genres: ['Fantasy'], tags: ['high-fantasy'], rating: 4.8, dKey: 'hobbit' },
    { isbn: 'S-B', title: 'Dune', author: 'Frank Herbert', aKey: 'herbert', genres: ['Science Fiction'], tags: ['sci-fi'], rating: 4.7, dKey: 'dune' },
    { isbn: 'S-C', title: 'Neuromancer', author: 'William Gibson', aKey: 'gibson', genres: ['Science Fiction'], tags: ['cyberpunk'], rating: 4.5, dKey: 'neuro' },
  ];

  const weightProfiles = [
    DEFAULT_THREE_WEIGHTS,
    { genre: 0.5, author: 0.5, tag: 0.0, rating: 0.0 },
    { genre: 0.0, author: 0.0, tag: 0.5, rating: 0.5 },
    { genre: 0.25, author: 0.25, tag: 0.25, rating: 0.25 },
    { genre: 0.9, author: 0.03, tag: 0.03, rating: 0.04 },
  ];

  for (let i = 0; i < 100; i++) {
    const candA = {
      isbn: `TWIN-A-${i}`,
      title: `The Hobbit Dune Neuromancer Fellowship Part ${i}`, // extreme title overlap
      author: `Author ${i % 7}`,
      aKey: `author_${i % 7}`,
      genres: ['Fantasy'],
      tags: ['high-fantasy', '1990s'],
      rating: 4.2,
      dKey: `work_a_${i}`,
    };

    const candB = {
      isbn: `TWIN-B-${i}`,
      title: `Organic Chemistry Lab Manual Second Edition Vol ${i}`, // zero title overlap
      author: `Author ${i % 7}`,
      aKey: `author_${i % 7}`,
      genres: ['Fantasy'],
      tags: ['high-fantasy', '1990s'],
      rating: 4.2,
      dKey: `work_b_${i}`,
    };

    const featA = computeHeuristicFeatures(candA, seeds);
    const featB = computeHeuristicFeatures(candB, seeds);

    assert.strictEqual(featA.author, featB.author);
    assert.strictEqual(featA.genre, featB.genre);
    assert.strictEqual(featA.tag, featB.tag);
    assert.strictEqual(featA.rating, featB.rating);
    assert.strictEqual(featA.title, undefined);
    assert.strictEqual(featB.title, undefined);

    for (const w of weightProfiles) {
      const scoreA = scoreCandidate(featA, w);
      const scoreB = scoreCandidate(featB, w);
      const delta = Math.abs(scoreA - scoreB);
      assert.strictEqual(delta, 0, `Pair ${i} score delta must be 0.00000, got ${delta}`);
    }
  }
});

await runCheck('1.4: Title weight injection in scoreCandidate and recommendThree is strictly neutralized', async () => {
  const feat = { author: 0.9, genre: 0.8, tag: 0.7, rating: 0.6 };
  const normalScore = scoreCandidate(feat, { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 });

  const adversarialWeights = [
    { title: 1.0, genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
    { w_title: 100.0, genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
    { title: 99999, w_title: 99999, genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 },
  ];

  for (const advW of adversarialWeights) {
    const advScore = scoreCandidate(feat, advW);
    assert.strictEqual(advScore, normalScore, `Injected title weight altered score: ${advScore} vs ${normalScore}`);
  }
});

// ---------------------------------------------------------------------------
// PART 2: DIVERSITY PENALTY DYNAMICS & MONOPOLY RESISTANCE
// ---------------------------------------------------------------------------
console.log('\n--- PART 2: DIVERSITY PENALTY DYNAMICS & MONOPOLY RESISTANCE ---');

await runCheck('2.1: Greedy diversity penalty mathematically decays top seed influence (delta = 0.85)', async () => {
  // Construct a scenario:
  // Seed 1: Agatha Christie (Mystery)
  // Seed 2: J.R.R. Tolkien (Fantasy)
  // Seed 3: Isaac Asimov (Sci-Fi)
  // Catalog has 50 Agatha Christie books with very high rating (4.9) and perfect genre/author match.
  // Catalog has 2 Tolkien books with rating 4.3.
  // Catalog has 2 Asimov books with rating 4.2.
  const books = [
    { isbn: 'SEED-CHRISTIE', title: 'Murder on the Orient Express', author: 'Agatha Christie', aKey: 'christie', genres: ['Mystery & Thriller'], tags: ['mystery'], rating: 4.8, dKey: 'orient' },
    { isbn: 'SEED-TOLKIEN', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'tolkien', genres: ['Fantasy'], tags: ['high-fantasy'], rating: 4.8, dKey: 'hobbit' },
    { isbn: 'SEED-ASIMOV', title: 'Foundation', author: 'Isaac Asimov', aKey: 'asimov', genres: ['Science Fiction'], tags: ['sci-fi'], rating: 4.8, dKey: 'foundation' },
  ];

  for (let i = 1; i <= 50; i++) {
    books.push({
      isbn: `CHRISTIE-${i}`,
      title: `Christie Mystery ${i}`,
      author: 'Agatha Christie',
      aKey: 'christie',
      genres: ['Mystery & Thriller'],
      tags: ['mystery'],
      rating: 4.9,
      dKey: `christie_work_${i}`,
    });
  }

  books.push({
    isbn: 'TOLKIEN-1',
    title: 'The Silmarillion',
    author: 'J. R. R. Tolkien',
    aKey: 'tolkien',
    genres: ['Fantasy'],
    tags: ['high-fantasy'],
    rating: 4.3,
    dKey: 'silmarillion',
  });
  books.push({
    isbn: 'TOLKIEN-2',
    title: 'Unfinished Tales',
    author: 'J. R. R. Tolkien',
    aKey: 'tolkien',
    genres: ['Fantasy'],
    tags: ['high-fantasy'],
    rating: 4.2,
    dKey: 'unfinished_tales',
  });

  books.push({
    isbn: 'ASIMOV-1',
    title: 'I, Robot',
    author: 'Isaac Asimov',
    aKey: 'asimov',
    genres: ['Science Fiction'],
    tags: ['sci-fi'],
    rating: 4.3,
    dKey: 'irobot',
  });
  books.push({
    isbn: 'ASIMOV-2',
    title: 'The Caves of Steel',
    author: 'Isaac Asimov',
    aKey: 'asimov',
    genres: ['Science Fiction'],
    tags: ['sci-fi'],
    rating: 4.2,
    dKey: 'caves_of_steel',
  });

  setupCatalog(books);

  const res = recommendThree(['SEED-CHRISTIE', 'SEED-TOLKIEN', 'SEED-ASIMOV'], DEFAULT_THREE_WEIGHTS, 10);
  assert.strictEqual(res.candidates.length, 10);

  const pickedIsbns = res.candidates.map((c) => c.isbn);
  const pickedSeeds = res.candidates.map((c) => c.bestSeed);

  const christiePicks = pickedSeeds.filter((s) => s === 'SEED-CHRISTIE').length;
  const tolkienPicks = pickedSeeds.filter((s) => s === 'SEED-TOLKIEN').length;
  const asimovPicks = pickedSeeds.filter((s) => s === 'SEED-ASIMOV').length;

  console.log(`\n    Picks distribution with 50 dominant candidates:`);
  console.log(`    - Christie picks: ${christiePicks}`);
  console.log(`    - Tolkien picks:  ${tolkienPicks}`);
  console.log(`    - Asimov picks:   ${asimovPicks}`);

  assert.ok(christiePicks < 10, 'Christie must NOT monopolize all 10 slots');
  assert.ok(tolkienPicks >= 1, 'Tolkien must receive at least 1 recommendation slot');
  assert.ok(asimovPicks >= 1, 'Asimov must receive at least 1 recommendation slot');
  assert.ok(pickedIsbns.includes('TOLKIEN-1'), 'TOLKIEN-1 must be recommended');
  assert.ok(pickedIsbns.includes('ASIMOV-1'), 'ASIMOV-1 must be recommended');
});

// ---------------------------------------------------------------------------
// PART 3: SEED SELF-EXCLUSION & WORK DEDUPLICATION
// ---------------------------------------------------------------------------
console.log('\n--- PART 3: SEED SELF-EXCLUSION & WORK DEDUPLICATION ---');

await runCheck('3.1: Seed self-exclusion strictly excludes seed ISBNs and identical work keys (dKeys)', async () => {
  const books = [
    { isbn: 'S-ALPHA', title: 'Alpha Work First Ed', author: 'Author A', aKey: 'aa', genres: ['Fantasy'], tags: ['magic'], rating: 4.9, dKey: 'work_alpha' },
    { isbn: 'S-BETA', title: 'Beta Work First Ed', author: 'Author B', aKey: 'ab', genres: ['Fantasy'], tags: ['magic'], rating: 4.8, dKey: 'work_beta' },
    { isbn: 'S-GAMMA', title: 'Gamma Work First Ed', author: 'Author C', aKey: 'ac', genres: ['Fantasy'], tags: ['magic'], rating: 4.7, dKey: 'work_gamma' },

    // Alternate editions of S-ALPHA with distinct ISBNs, different titles, and varying ratings
    { isbn: 'ED-ALPHA-2', title: 'Alpha Work Paperback Edition', author: 'Author A', aKey: 'aa', genres: ['Fantasy'], tags: ['magic'], rating: 5.0, dKey: 'work_alpha' },
    { isbn: 'ED-ALPHA-3', title: 'Alpha Work Collector Deluxe', author: 'Author A', aKey: 'aa', genres: ['Fantasy'], tags: ['magic'], rating: 4.95, dKey: 'work_alpha' },

    // Alternate editions of S-BETA
    { isbn: 'ED-BETA-2', title: 'Beta Work Tenth Anniversary', author: 'Author B', aKey: 'ab', genres: ['Fantasy'], tags: ['magic'], rating: 4.85, dKey: 'work_beta' },

    // Legitimate candidate book
    { isbn: 'CAND-DELTA', title: 'Delta Work', author: 'Author A', aKey: 'aa', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 'work_delta' },
  ];

  setupCatalog(books);

  const res = recommendThree(['S-ALPHA', 'S-BETA', 'S-GAMMA'], DEFAULT_THREE_WEIGHTS, 10);
  const returnedIsbns = res.candidates.map((c) => c.isbn);

  // Exact seeds excluded
  assert.ok(!returnedIsbns.includes('S-ALPHA'), 'S-ALPHA must be excluded');
  assert.ok(!returnedIsbns.includes('S-BETA'), 'S-BETA must be excluded');
  assert.ok(!returnedIsbns.includes('S-GAMMA'), 'S-GAMMA must be excluded');

  // Alternate editions of seeds excluded
  assert.ok(!returnedIsbns.includes('ED-ALPHA-2'), 'ED-ALPHA-2 must be excluded (matches seed dKey)');
  assert.ok(!returnedIsbns.includes('ED-ALPHA-3'), 'ED-ALPHA-3 must be excluded (matches seed dKey)');
  assert.ok(!returnedIsbns.includes('ED-BETA-2'), 'ED-BETA-2 must be excluded (matches seed dKey)');

  // Legitimate work included
  assert.ok(returnedIsbns.includes('CAND-DELTA'), 'CAND-DELTA must be included');
});

await runCheck('3.2: Duplicate editions of candidate works collapse to single highest-scoring edition', async () => {
  const books = [
    { isbn: 'SEED-1', title: 'Seed 1', author: 'Auth 1', aKey: 'a1', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's1' },
    { isbn: 'SEED-2', title: 'Seed 2', author: 'Auth 2', aKey: 'a2', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's2' },
    { isbn: 'SEED-3', title: 'Seed 3', author: 'Auth 3', aKey: 'a3', genres: ['Fantasy'], tags: ['magic'], rating: 4.5, dKey: 's3' },

    // Candidate Work X with 3 editions of varying ratings
    { isbn: 'X-MED', title: 'Work X Normal Edition', author: 'Auth 4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.0, dKey: 'work_x' },
    { isbn: 'X-HIGH', title: 'Work X Gold Edition', author: 'Auth 4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 4.9, dKey: 'work_x' },
    { isbn: 'X-LOW', title: 'Work X Damaged Edition', author: 'Auth 4', aKey: 'a4', genres: ['Fantasy'], tags: ['magic'], rating: 2.1, dKey: 'work_x' },
  ];

  setupCatalog(books);

  const res = recommendThree(['SEED-1', 'SEED-2', 'SEED-3'], DEFAULT_THREE_WEIGHTS, 5);
  const xCandidates = res.candidates.filter((c) => c.isbn.startsWith('X-'));

  assert.strictEqual(xCandidates.length, 1, 'Exactly one edition of Work X should appear');
  assert.strictEqual(xCandidates[0].isbn, 'X-HIGH', 'Highest scoring edition must be selected');
});

// ---------------------------------------------------------------------------
// PART 4: ADVERSARIAL INPUTS & DEFENSIVE CONTRACTS
// ---------------------------------------------------------------------------
console.log('\n--- PART 4: ADVERSARIAL INPUTS & DEFENSIVE CONTRACTS ---');

await runCheck('4.1: scoreCandidate with null / undefined features or weights returns 0 gracefully', async () => {
  assert.strictEqual(scoreCandidate(null, null), 0);
  assert.strictEqual(scoreCandidate(undefined, undefined), 0);
  assert.strictEqual(scoreCandidate({}, {}), 0);
  assert.strictEqual(scoreCandidate({ author: 1 }, null), 0.25);
});

await runCheck('4.2: computeHeuristicFeatures with null / undefined inputs returns zeroed features', async () => {
  const zeroFeat = { author: 0, genre: 0, tag: 0, rating: 0 };
  assert.deepEqual(computeHeuristicFeatures(null, null), zeroFeat);
  assert.deepEqual(computeHeuristicFeatures(undefined, undefined), zeroFeat);
  assert.deepEqual(computeHeuristicFeatures({}, []), zeroFeat);
});

await runCheck('4.3: recommendThree throws clean Error on invalid seed counts (0, 1, 2, 4)', async () => {
  assert.throws(() => recommendThree([]), /Exactly 3 seed books/);
  assert.throws(() => recommendThree(['A']), /Exactly 3 seed books/);
  assert.throws(() => recommendThree(['A', 'B']), /Exactly 3 seed books/);
  assert.throws(() => recommendThree(['A', 'B', 'C', 'D']), /Exactly 3 seed books/);
  assert.throws(() => recommendThree(null), /Exactly 3 seed books/);
});

console.log('\n' + '='.repeat(80));
console.log(`  EMPIRICAL CHECK COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log('='.repeat(80));

if (failed > 0) process.exit(1);
else process.exit(0);
