// Independent Empirical Stress Test & Adversarial Verification Suite
// Challenger 2 (Round 2) — Milestone 2 Verification
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  analyzeReviewSentiment,
  analyzeSentiment,
  adaptRecommendationsBySentiment,
  LITERARY_LEXICON,
  NEGATORS,
  INTENSIFIERS,
  DIMINISHERS,
} from '../recommender/sentiment.js';
import { engine } from '../recommender/engine.js';
import { computeHeuristicFeatures, scoreCandidate, recommendThree } from '../recommender/algorithms.js';
import { inferGenres, inferTags, computeBaselineRating } from '../recommender/metadata.js';

console.log('='.repeat(75));
console.log('⚔️  CHALLENGER 2 (ROUND 2): INDEPENDENT EMPIRICAL VERIFICATION HARNESS');
console.log('='.repeat(75));

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: [],
};

function runTest(suite, name, testFn) {
  stats.total++;
  try {
    testFn();
    stats.passed++;
    console.log(`  ✅ [PASS] [${suite}] ${name}`);
  } catch (err) {
    stats.failed++;
    stats.failures.push({ suite, name, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${suite}] ${name}: ${err.message}`);
  }
}

// ===========================================================================
// SUITE 1: SPECIFIC DISPATCH LITOTES & DOUBLE NEGATION REQUIREMENTS
// ===========================================================================
console.log('\n--- SUITE 1: Double Negation & Litotes Assertions ---');

runTest('Litotes', 'Mandatory 1: "It is not without merit." -> polarity > 0', () => {
  const res = analyzeReviewSentiment('It is not without merit.');
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
  assert.strictEqual(res.classification, 'positive');
  assert.ok(res.positiveWords.some((w) => w.word === 'merit'));
});

runTest('Litotes', 'Mandatory 2: "It is not without genius." -> polarity > 0', () => {
  const res = analyzeReviewSentiment('It is not without genius.');
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
  assert.strictEqual(res.classification, 'positive');
  assert.ok(res.positiveWords.some((w) => w.word === 'genius'));
});

runTest('Litotes', 'Mandatory 3: "It is not without charm." -> polarity > 0', () => {
  const res = analyzeReviewSentiment('It is not without charm.');
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
  assert.strictEqual(res.classification, 'positive');
  assert.ok(res.positiveWords.some((w) => w.word === 'charm'));
});

runTest('Litotes', 'Contraction negation: "It isn\'t without merit."', () => {
  const res = analyzeReviewSentiment("It isn't without merit.");
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
});

runTest('Litotes', 'Contraction negation: "It wasn\'t without genius."', () => {
  const res = analyzeReviewSentiment("It wasn't without genius.");
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
});

runTest('Litotes', 'Alternative negator: "Never without charm."', () => {
  const res = analyzeReviewSentiment('Never without charm.');
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
});

runTest('Litotes', 'Double negation on negative word: "not unreadable" -> polarity > 0', () => {
  const res = analyzeReviewSentiment('It is not unreadable.');
  assert.ok(res.polarity > 0, `Expected polarity > 0, got ${res.polarity}`);
});

runTest('Litotes', 'Triple negation: odd count inverts to negative ("not never without merit")', () => {
  const res = analyzeReviewSentiment('It is not never without merit.');
  assert.ok(res.polarity < 0, `Expected polarity < 0 for odd negator count, got ${res.polarity}`);
});

runTest('Litotes', 'Lookback window boundary: negators within 3 tokens apply', () => {
  // "not at all bad" -> "not" is 3 tokens before "bad"
  const res3 = analyzeReviewSentiment('This is not at all bad.');
  assert.ok(res3.polarity >= 0, `Expected polarity >= 0 for negated negative, got ${res3.polarity}`);
});

runTest('Litotes', 'Lookback stops at preceding sentiment word: "not boring, excellent"', () => {
  const res = analyzeReviewSentiment('not boring, excellent');
  // "boring" is negated (negative -> positive/neutral)
  // "excellent" should NOT be negated by "not" because "boring" is between them
  assert.ok(res.polarity > 0.4, `Expected polarity > 0.4, got ${res.polarity}`);
});

// ===========================================================================
// SUITE 2: SPECIFIC DISPATCH ASPECT ISOLATION REQUIREMENTS
// ===========================================================================
console.log('\n--- SUITE 2: Aspect Isolation Assertions ---');

runTest('Aspects', 'Mandatory 1: "A wonderful slow-burn romance" -> slow-dragging NOT present, slow-burn present', () => {
  const res = analyzeReviewSentiment('A wonderful slow-burn romance');
  assert.ok(res.aspects.includes('slow-burn'), `Expected slow-burn in aspects: ${JSON.stringify(res.aspects)}`);
  assert.ok(!res.aspects.includes('slow-dragging'), `slow-dragging must NOT be present in: ${JSON.stringify(res.aspects)}`);
});

runTest('Aspects', 'Space variant: "A wonderful slow burn romance" -> slow-dragging NOT present, slow-burn present', () => {
  const res = analyzeReviewSentiment('A wonderful slow burn romance');
  assert.ok(res.aspects.includes('slow-burn'), `Expected slow-burn in aspects: ${JSON.stringify(res.aspects)}`);
  assert.ok(!res.aspects.includes('slow-dragging'), `slow-dragging must NOT be present in: ${JSON.stringify(res.aspects)}`);
});

runTest('Aspects', 'Mandatory 2: "The novel explores themes of loss" -> world-building NOT present', () => {
  const res = analyzeReviewSentiment('The novel explores themes of loss');
  assert.ok(!res.aspects.includes('world-building'), `world-building must NOT be present in: ${JSON.stringify(res.aspects)}`);
});

runTest('Aspects', 'False substring collision: "An upsetting tragedy" -> world-building NOT present', () => {
  const res = analyzeReviewSentiment('An upsetting tragedy');
  assert.ok(!res.aspects.includes('world-building'), `world-building must NOT be present in: ${JSON.stringify(res.aspects)}`);
});

runTest('Aspects', 'Substring collision protection: "folklore", "typesetting", "galore"', () => {
  const resFolklore = analyzeReviewSentiment('This book tells rich folklore and folklore tales.');
  // "folklore" should NOT trigger "lore" -> world-building
  const resSetting = analyzeReviewSentiment('The typesetting of this edition is fine.');
  // "typesetting" should NOT trigger "setting" -> world-building
  assert.ok(!resFolklore.aspects.includes('world-building'), `folklore triggered world-building: ${JSON.stringify(resFolklore.aspects)}`);
  assert.ok(!resSetting.aspects.includes('world-building'), `typesetting triggered world-building: ${JSON.stringify(resSetting.aspects)}`);
});

runTest('Aspects', 'Genuine aspect triggers: "lore" and "setting" standalone activate world-building', () => {
  const resLore = analyzeReviewSentiment('The deep lore of the kingdom is fascinating.');
  const resSetting = analyzeReviewSentiment('The gothic setting created a chilling atmosphere.');
  assert.ok(resLore.aspects.includes('world-building'), `lore did not trigger world-building: ${JSON.stringify(resLore.aspects)}`);
  assert.ok(resSetting.aspects.includes('world-building'), `setting did not trigger world-building: ${JSON.stringify(resSetting.aspects)}`);
});

runTest('Aspects', 'Genuine slow-dragging trigger: "The plot was so slow and dragged on"', () => {
  const res = analyzeReviewSentiment('The plot was so slow and dragged on forever.');
  assert.ok(res.aspects.includes('slow-dragging'), `Expected slow-dragging, got: ${JSON.stringify(res.aspects)}`);
  assert.ok(!res.aspects.includes('slow-burn'), `slow-burn must NOT be present: ${JSON.stringify(res.aspects)}`);
});

// ===========================================================================
// SUITE 3: THROUGHPUT BENCHMARK (< 1.0 ms/review)
// ===========================================================================
console.log('\n--- SUITE 3: High-Volume Throughput Benchmark ---');

runTest('Throughput', 'Mandatory 4: 5,000 diverse reviews throughput < 1.0 ms/review', () => {
  const reviewCorpus = [
    'A breathtaking masterpiece of storytelling with unforgettable characters and magnificent world-building.',
    'An unreadable, boring waste of paper. Plodding, slow, and completely flat characters.',
    'It is not without merit, providing thoughtful observations and delightful prose.',
    'It is not without genius, though the plot was occasionally convoluted.',
    'It is not without charm, offering a cozy and heartwarming story.',
    'A wonderful slow-burn romance with great chemistry and subtle pacing.',
    'The novel explores themes of loss and grief with poignant authenticity.',
    'An upsetting tragedy with dark tones and bleak outcomes.',
    'The beginning was dull, but the second half was magnificent and captivating.',
    'Extremely brilliant character arcs and rich lore that captivated me completely.',
    'Somewhat mediocre, formulaic plot with cardboard characters.',
    'Not boring, not dull, quite enjoyable and briskly paced.',
  ];

  const N = 5000;
  const latencies = new Float64Array(N);

  // Warmup JIT
  for (let i = 0; i < 100; i++) {
    analyzeReviewSentiment(reviewCorpus[i % reviewCorpus.length], (i % 5) + 1);
  }

  const startAll = performance.now();
  for (let i = 0; i < N; i++) {
    const text = reviewCorpus[i % reviewCorpus.length];
    const star = (i % 5) + 1;
    const t0 = performance.now();
    analyzeReviewSentiment(text, star);
    latencies[i] = performance.now() - t0;
  }
  const totalElapsed = performance.now() - startAll;

  latencies.sort();
  const meanLatency = totalElapsed / N;
  const p50 = latencies[Math.floor(N * 0.50)];
  const p95 = latencies[Math.floor(N * 0.95)];
  const p99 = latencies[Math.floor(N * 0.99)];
  const maxLat = latencies[N - 1];

  console.log(`     Benchmark Results (${N} reviews):`);
  console.log(`     - Total Time:   ${totalElapsed.toFixed(2)} ms`);
  console.log(`     - Mean Latency: ${meanLatency.toFixed(4)} ms/review`);
  console.log(`     - Median (P50): ${p50.toFixed(4)} ms`);
  console.log(`     - P95 Latency:  ${p95.toFixed(4)} ms`);
  console.log(`     - P99 Latency:  ${p99.toFixed(4)} ms`);
  console.log(`     - Max Latency:  ${maxLat.toFixed(4)} ms`);

  assert.ok(meanLatency < 1.0, `Mean latency ${meanLatency.toFixed(4)} ms exceeds 1.0 ms threshold`);
});

// ===========================================================================
// SUITE 4: DYNAMIC RECOMMENDATION ADAPTATION & TITLE EXCLUSION
// ===========================================================================
console.log('\n--- SUITE 4: Dynamic Recommendation Adaptation & Title Exclusion ---');

runTest('Adaptation', 'Adaptation returns properly structured object and titleExcluded flag', () => {
  const eng = engine();
  eng.books = [
    { isbn: '101', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['classic', 'adventure'], rating: 4.8, dKey: 'hobbit' },
    { isbn: '102', title: 'The Fellowship', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['epic', 'adventure'], rating: 4.9, dKey: 'fellowship' },
    { isbn: '103', title: 'The Two Towers', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['epic', 'adventure'], rating: 4.8, dKey: 'towers' },
    { isbn: '104', title: 'Neuromancer', author: 'William Gibson', aKey: 'williamgibson', genres: ['Science Fiction'], tags: ['cyberpunk'], rating: 4.2, dKey: 'neuromancer' },
    { isbn: '105', title: 'Snow Crash', author: 'Neal Stephenson', aKey: 'nealstephenson', genres: ['Science Fiction'], tags: ['cyberpunk', 'fast-paced'], rating: 4.3, dKey: 'snow crash' },
  ];
  eng.ready = true;

  const sentiment = analyzeReviewSentiment('An absolute masterpiece! Loved every single page.', 5);
  const recs = adaptRecommendationsBySentiment(sentiment, eng.books[0], { limit: 3 });

  assert.ok(Array.isArray(recs), 'Result should be an array');
  assert.ok(recs.diagnostics, 'Result should have diagnostics object');
  assert.strictEqual(recs.diagnostics.titleExcluded, true, 'titleExcluded must be true');
  assert.strictEqual(recs.diagnostics.mode, 'positive_reinforce', 'Mode must be positive_reinforce');
  assert.ok(recs.length > 0, 'Should return candidate books');
});

runTest('Adaptation', 'Title Invariance: Changing candidate titles does NOT alter recommendation scores', () => {
  const eng = engine();
  const bookBase = { isbn: '201', author: 'Ursula K. Le Guin', aKey: 'ursulakleguin', genres: ['Science Fiction'], tags: ['classic'], rating: 4.6, dKey: 'left hand' };
  const candA = { isbn: '202', title: 'Identical Title Word Left Hand', author: 'Ursula K. Le Guin', aKey: 'ursulakleguin', genres: ['Science Fiction'], tags: ['classic'], rating: 4.5, dKey: 'cand a' };
  const candB = { isbn: '203', title: 'Completely Different Random Words', author: 'Ursula K. Le Guin', aKey: 'ursulakleguin', genres: ['Science Fiction'], tags: ['classic'], rating: 4.5, dKey: 'cand b' };

  const featA = computeHeuristicFeatures(candA, [bookBase], eng);
  const featB = computeHeuristicFeatures(candB, [bookBase], eng);
  const scoreA = scoreCandidate(featA);
  const scoreB = scoreCandidate(featB);

  assert.strictEqual(scoreA, scoreB, `Title divergence caused score difference: ${scoreA} vs ${scoreB}`);
  assert.strictEqual(featA.tag, featB.tag, `Tag features differ: ${featA.tag} vs ${featB.tag}`);
});

// ===========================================================================
// SUITE 5: EDGE CASES, ROBUSTNESS & SAFETY
// ===========================================================================
console.log('\n--- SUITE 5: Boundary Values, Null Safety & Route Integration ---');

runTest('Safety', 'analyzeReviewSentiment handles null, undefined, empty, numbers, objects gracefully', () => {
  const nullRes = analyzeReviewSentiment(null);
  assert.strictEqual(nullRes.polarity, 0);
  assert.strictEqual(nullRes.label, 'neutral');

  const undefRes = analyzeReviewSentiment(undefined);
  assert.strictEqual(undefRes.polarity, 0);

  const numRes = analyzeReviewSentiment(12345);
  assert.strictEqual(numRes.polarity, 0);

  const objRes = analyzeReviewSentiment({ text: 'hello' });
  assert.strictEqual(objRes.polarity, 0);

  const boolRes = analyzeReviewSentiment(true);
  assert.strictEqual(boolRes.polarity, 0);
});

runTest('Safety', 'analyzeReviewSentiment star rating bounds: handles invalid types and numbers', () => {
  const rNeg = analyzeReviewSentiment('neutral statement', -5);
  const rBig = analyzeReviewSentiment('neutral statement', 100);
  const rNaN = analyzeReviewSentiment('neutral statement', NaN);
  const rInf = analyzeReviewSentiment('neutral statement', Infinity);

  assert.strictEqual(rNeg.polarity, 0);
  assert.strictEqual(rBig.polarity, 0);
  assert.strictEqual(rNaN.polarity, 0);
  assert.strictEqual(rInf.polarity, 0);
});

runTest('Safety', 'scoreCandidate handles null, undefined, empty objects without throwing', () => {
  assert.strictEqual(scoreCandidate(null), 0);
  assert.strictEqual(scoreCandidate(undefined), 0);
  assert.strictEqual(scoreCandidate({}), 0);
  assert.strictEqual(scoreCandidate({ author: NaN }), 0);
});

runTest('Safety', 'computeHeuristicFeatures handles null cand, null seeds gracefully', () => {
  const res = computeHeuristicFeatures(null, null);
  assert.deepStrictEqual(res, { author: 0, genre: 0, tag: 0, rating: 0 });
});

runTest('Safety', 'inferGenres, inferTags, computeBaselineRating handle null / undefined gracefully', () => {
  assert.deepStrictEqual(inferGenres(null), ['General Fiction']);
  assert.deepStrictEqual(inferGenres(undefined), ['General Fiction']);
  assert.deepStrictEqual(inferTags(null), ['general']);
  assert.deepStrictEqual(inferTags(undefined), ['general']);
  assert.strictEqual(computeBaselineRating(null), 4.15);
});

runTest('Route Contract', 'analyzeSentiment alias is exported and equals analyzeReviewSentiment', () => {
  assert.strictEqual(typeof analyzeSentiment, 'function');
  assert.strictEqual(analyzeSentiment, analyzeReviewSentiment);
});

// ===========================================================================
// HARNESS SUMMARY
// ===========================================================================
console.log('\n' + '='.repeat(75));
console.log(`🏁 CHALLENGER 2 SUITE SUMMARY: ${stats.passed} PASSED | ${stats.failed} FAILED (Total: ${stats.total})`);
console.log('='.repeat(75));

if (stats.failures.length > 0) {
  console.error('\n🚨 DETECTED FAILURES:');
  stats.failures.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.suite}] ${f.name}`);
    console.error(`     Error: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🌟 ALL CHALLENGER TESTS PASSED WITH ZERO DEFECTS!');
  process.exit(0);
}
