// Adversarial Empirical Challenge Suite for Local Sentiment Analyzer & Dynamic Adaptation
// Milestone 2 Challenger 2 Verification
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  analyzeReviewSentiment,
  adaptRecommendationsBySentiment,
  LITERARY_LEXICON,
  NEGATORS,
  INTENSIFIERS,
  DIMINISHERS,
} from '../recommender/sentiment.js';
import { engine } from '../recommender/engine.js';
import { computeHeuristicFeatures, scoreCandidate } from '../recommender/algorithms.js';

console.log('⚔️  CHALLENGER 2: Starting Adversarial Empirical Stress Tests...\n');

const results = {
  passed: 0,
  failed: 0,
  findings: [],
};

function recordTest(name, passed, details) {
  if (passed) {
    results.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.failed++;
    results.findings.push({ name, details });
    console.error(`  ❌ [FAIL] ${name} -> ${details}`);
  }
}

// ===========================================================================
// SECTION 1: Adversarial Linguistic Test Battery
// ===========================================================================
console.log('--- SECTION 1: Adversarial Linguistic Test Battery ---');

// 1.1 Pure positive
{
  const text = 'A breathtaking masterpiece of storytelling.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity >= 0.7;
  recordTest(
    'Pure Positive: "A breathtaking masterpiece of storytelling."',
    pass,
    `Expected polarity >= 0.7, observed: ${res.polarity}`
  );
}

// 1.2 Pure negative
{
  const text = 'An unreadable, boring waste of paper.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity <= -0.7;
  recordTest(
    'Pure Negative: "An unreadable, boring waste of paper."',
    pass,
    `Expected polarity <= -0.7, observed: ${res.polarity}`
  );
}

// 1.3 Double negation with "not without merit" (Explicitly requested in DISPATCH.md)
{
  const text = 'It is not without merit.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity > 0.0;
  recordTest(
    'Double Negation: "It is not without merit." -> assert polarity > 0',
    pass,
    `Expected polarity > 0.0, observed: ${res.polarity} (lexiconMatches: ${res.metrics.lexiconMatches}, label: "${res.label}")`
  );
}

// 1.4 Double negation with "not without genius" (Lexicon word in double negation)
{
  const text = 'It is not without genius.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity > 0.0;
  recordTest(
    'Double Negation: "It is not without genius." -> assert polarity > 0',
    pass,
    `Expected polarity > 0.0, observed: ${res.polarity} (classified as: "${res.label}", negators: ${JSON.stringify(res.negatorsDetected)})`
  );
}

// 1.5 Double negation with negated negative adjective
{
  const text = 'It is not unreadable.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity > 0.0;
  recordTest(
    'Double Negation: "It is not unreadable." (negator + negative word)',
    pass,
    `Expected polarity > 0.0, observed: ${res.polarity}`
  );
}

// 1.6 Negated positive
{
  const text = 'Not good, not captivating at all.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity < 0.0;
  recordTest(
    'Negated Positive: "Not good, not captivating at all."',
    pass,
    `Expected polarity < 0.0, observed: ${res.polarity}`
  );
}

// 1.7 Negated negative
{
  const text = 'Not boring, not dull.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity >= 0.0;
  recordTest(
    'Negated Negative: "Not boring, not dull."',
    pass,
    `Expected polarity >= 0.0, observed: ${res.polarity}`
  );
}

// 1.8 Contrastive shift: trailing positive clause dominates
{
  const text = 'The beginning was dull, but the second half was magnificent.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity > 0.0;
  recordTest(
    'Contrastive Shift: "dull, but ... magnificent" -> trailing positive dominates',
    pass,
    `Expected polarity > 0.0, observed: ${res.polarity}`
  );
}

// 1.9 Contrastive shift: trailing negative clause dominates
{
  const text = 'The world was fascinating, but the characters were atrocious.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity < 0.0;
  recordTest(
    'Contrastive Shift: "fascinating, but ... atrocious" -> trailing negative dominates',
    pass,
    `Expected polarity < 0.0, observed: ${res.polarity}`
  );
}

// 1.10 Intensifiers vs Diminishers hierarchy
{
  const pExt = analyzeReviewSentiment('extremely brilliant').polarity;
  const pBase = analyzeReviewSentiment('brilliant').polarity;
  const pDim = analyzeReviewSentiment('somewhat brilliant').polarity;
  const pass = pExt > pBase && pBase > pDim;
  recordTest(
    'Modifier Hierarchy: "extremely brilliant" > "brilliant" > "somewhat brilliant"',
    pass,
    `Expected pExt (${pExt}) > pBase (${pBase}) > pDim (${pDim})`
  );
}

// 1.11 Edge Cases: Empty string, whitespace, punctuation, uppercase
{
  const emptyRes = analyzeReviewSentiment('');
  const wsRes = analyzeReviewSentiment('    \n\t  ');
  const punctRes = analyzeReviewSentiment('?!?!?!?!......-----');
  const upperRes = analyzeReviewSentiment('HORRIBLE TERRIBLE AWFUL TRASH');
  const lowerRes = analyzeReviewSentiment('horrible terrible awful trash');

  const pass =
    emptyRes.polarity === 0 &&
    wsRes.polarity === 0 &&
    punctRes.polarity === 0 &&
    upperRes.polarity <= -0.7 &&
    Math.abs(upperRes.polarity - lowerRes.polarity) < 1e-4;

  recordTest(
    'Linguistic Edge Cases: Empty, whitespace, punctuation, case-insensitivity',
    pass,
    `Empty: ${emptyRes.polarity}, WS: ${wsRes.polarity}, Punct: ${punctRes.polarity}, Upper: ${upperRes.polarity}, Lower: ${lowerRes.polarity}`
  );
}

// 1.12 Double Negation with alternative positive term ("charm")
{
  const text = 'It is not without charm.';
  const res = analyzeReviewSentiment(text);
  const pass = res.polarity > 0.0;
  recordTest(
    'Double Negation: "It is not without charm." -> assert polarity > 0',
    pass,
    `Expected polarity > 0.0, observed: ${res.polarity} (label: "${res.label}")`
  );
}

// 1.13 Aspect Pacing Separation: "slow-burn" must NOT trigger "slow-dragging"
{
  const text = 'A wonderful slow-burn romance with compelling characters.';
  const res = analyzeReviewSentiment(text, 5);
  const hasSlowBurn = res.aspects.includes('slow-burn');
  const hasSlowDragging = res.aspects.includes('slow-dragging');
  const pass = hasSlowBurn && !hasSlowDragging && res.aspectBreakdown['slow-burn'] === 'positive';
  recordTest(
    'Aspect Pacing Separation: "slow-burn" must NOT trigger "slow-dragging"',
    pass,
    `aspects: ${JSON.stringify(res.aspects)}, slow-burn present: ${hasSlowBurn}, slow-dragging present: ${hasSlowDragging}`
  );
}

// 1.14 Aspect Word Boundary Substring Protection: "explored" & "upsetting" must NOT trigger "world-building"
{
  const resExplored = analyzeReviewSentiment('She explored the quiet streets of the city.', 4);
  const resUpsetting = analyzeReviewSentiment('An upsetting and distressing tragedy.', 2);
  const resSetting = analyzeReviewSentiment('She explores the rich setting and vast universe.', 5);
  const resLore = analyzeReviewSentiment('Rich lore and magnificent mythology.', 5);

  const noFalseLore = !resExplored.aspects.includes('world-building');
  const noFalseSetting = !resUpsetting.aspects.includes('world-building');
  const hasTrueSetting = resSetting.aspects.includes('world-building');
  const hasTrueLore = resLore.aspects.includes('world-building');

  const pass = noFalseLore && noFalseSetting && hasTrueSetting && hasTrueLore;
  recordTest(
    'Aspect Word Boundary Protection: "explored" & "upsetting" must NOT trigger "world-building"',
    pass,
    `explored has lore: ${!noFalseLore}, upsetting has setting: ${!noFalseSetting}, valid setting: ${hasTrueSetting}, valid lore: ${hasTrueLore}`
  );
}

// ===========================================================================
// SECTION 2: Star Calibration Sensitivity
// ===========================================================================
console.log('\n--- SECTION 2: Star Calibration Sensitivity ---');

// 2.1 5 stars with neutral text
{
  const text = 'This publication was printed in 1998 by Random House.';
  const res = analyzeReviewSentiment(text, 5);
  const pass = res.polarity > 0.0 && res.label === 'positive';
  recordTest(
    'Star Sensitivity: 5 stars + neutral text -> positive polarity',
    pass,
    `Expected polarity > 0.0 and positive label, observed polarity: ${res.polarity}, label: ${res.label}`
  );
}

// 2.2 1 star with neutral text
{
  const text = 'This publication was printed in 1998 by Random House.';
  const res = analyzeReviewSentiment(text, 1);
  const pass = res.polarity < 0.0 && res.label === 'negative';
  recordTest(
    'Star Sensitivity: 1 star + neutral text -> negative polarity',
    pass,
    `Expected polarity < 0.0 and negative label, observed polarity: ${res.polarity}, label: ${res.label}`
  );
}

// 2.3 5 stars with negative text -> dampening effect
{
  const text = 'Horrible, terrible, awful, dreadful waste.';
  const pureNeg = analyzeReviewSentiment(text);
  const blended5 = analyzeReviewSentiment(text, 5);
  // 5-star rating (starPolarity = +1.0) must pull score upward towards neutral
  const pass = blended5.polarity > pureNeg.polarity;
  recordTest(
    'Star Calibration Dampening: 5 stars pulls severe negative review upward',
    pass,
    `Expected blended (${blended5.polarity}) > pure negative (${pureNeg.polarity})`
  );
}

// 2.4 1 star with positive text -> dampening effect
{
  const text = 'Breathtaking masterpiece, brilliant and magnificent.';
  const purePos = analyzeReviewSentiment(text);
  const blended1 = analyzeReviewSentiment(text, 1);
  // 1-star rating (starPolarity = -1.0) must pull score downward towards neutral
  const pass = blended1.polarity < purePos.polarity;
  recordTest(
    'Star Calibration Dampening: 1 star pulls pure positive review downward',
    pass,
    `Expected blended (${blended1.polarity}) < pure positive (${purePos.polarity})`
  );
}

// 2.5 Extreme review length (5,000+ characters) stability and bounding
{
  const longSentence = 'A remarkably brilliant, evocative, and poignant literary achievement with rich characterization. ';
  const extremeText = longSentence.repeat(55); // > 5,000 chars
  const res = analyzeReviewSentiment(extremeText, 5);
  const pass = res.polarity >= -1.0 && res.polarity <= 1.0 && Number.isFinite(res.polarity) && res.polarity > 0.9;
  recordTest(
    `Extreme Review Length (${extremeText.length} chars) -> bounded in [-1.0, 1.0] and stable`,
    pass,
    `Expected finite polarity in [-1, 1], observed: ${res.polarity}`
  );
}

// 2.6 Out-of-bounds star ratings handling
{
  const r0 = analyzeReviewSentiment('Good book.', 0);
  const r6 = analyzeReviewSentiment('Good book.', 6);
  const rNaN = analyzeReviewSentiment('Good book.', NaN);
  const rNull = analyzeReviewSentiment('Good book.', null);
  const pass =
    r0.polarity > 0 &&
    r6.polarity > 0 &&
    rNaN.polarity > 0 &&
    rNull.polarity > 0 &&
    r0.polarity === rNull.polarity;
  recordTest(
    'Out-of-bounds Star Ratings (0, 6, NaN, null) ignored gracefully',
    pass,
    `Observed r0: ${r0.polarity}, rNull: ${rNull.polarity}`
  );
}

// ===========================================================================
// SECTION 3: Dynamic Recommendation Adaptation Verification
// ===========================================================================
console.log('\n--- SECTION 3: Dynamic Recommendation Adaptation ---');

{
  // Setup in-memory mock catalog
  const eng = engine();
  eng.books = [];
  eng.byIsbn = new Map();
  eng.byAuthor = new Map();
  eng.byGenre = new Map();
  eng.byTag = new Map();
  eng.ready = true;

  const mockCatalog = [
    { isbn: 'F1', title: 'The Silmarillion', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['high-fantasy', 'world-building', 'magic'], rating: 4.8, dKey: 'silmarillion' },
    { isbn: 'F2', title: 'The Fellowship of the Ring', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['world-building', 'high-fantasy'], rating: 4.9, dKey: 'fellowship' },
    { isbn: 'F3', title: 'The Way of Kings', author: 'Brandon Sanderson', aKey: 'brandonsanderson', genres: ['Fantasy'], tags: ['magic', 'world-building'], rating: 4.7, dKey: 'way of kings' },
    { isbn: 'F4', title: 'A Game of Thrones', author: 'George R. R. Martin', aKey: 'georgerrmartin', genres: ['Fantasy'], tags: ['magic', 'dragons'], rating: 4.6, dKey: 'game of thrones' },
    { isbn: 'T1', title: 'Jurassic Park', author: 'Michael Crichton', aKey: 'michaelcrichton', genres: ['Mystery & Thriller'], tags: ['fast-paced', 'gripping-plot'], rating: 4.5, dKey: 'jurassic park' },
    { isbn: 'T2', title: 'Along Came a Spider', author: 'James Patterson', aKey: 'jamespatterson', genres: ['Mystery & Thriller'], tags: ['fast-paced', 'action-packed'], rating: 4.3, dKey: 'along came a spider' },
    { isbn: 'S1', title: 'A Slow and Plodding Tale', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['slow-dragging'], rating: 3.4, dKey: 'slow plodding' },
  ];

  mockCatalog.forEach((b, i) => {
    eng.books.push(b);
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

  const target = mockCatalog[0]; // F1: Tolkien's The Silmarillion

  // 3.1 Positive review reinforces matching genres and same author
  const posSent = analyzeReviewSentiment('A breathtaking masterpiece! Incredible world-building and magic lore.', 5);
  const posRecs = adaptRecommendationsBySentiment(posSent, target, { limit: 5 });

  const posMode = posRecs.diagnostics.mode === 'positive_reinforce';
  const posAuthors = posRecs.map((b) => b.author);
  const posGenres = posRecs.map((b) => b.genres).flat();
  const includesTolkien = posAuthors.includes('J. R. R. Tolkien');
  const includesFantasy = posGenres.includes('Fantasy');

  recordTest(
    'Dynamic Adaptation (Positive Review): Reinforces same author and fantasy genre',
    posMode && includesTolkien && includesFantasy,
    `Mode: ${posRecs.diagnostics.mode}, Authors: ${JSON.stringify(posAuthors)}, Fantasy present: ${includesFantasy}`
  );

  // 3.2 Negative review penalizes criticized author and surfaces contrasting fast-paced recommendations
  const negSent = analyzeReviewSentiment('A slow, dragging, tedious slog. The plot was completely dragging and boring.', 1);
  const negRecs = adaptRecommendationsBySentiment(negSent, target, { limit: 5 });

  const negMode = negRecs.diagnostics.mode === 'negative_contrast';
  const negAuthors = negRecs.map((b) => b.author);
  const negTags = negRecs.map((b) => b.tags || []).flat();
  const authorPenalized = !negAuthors.slice(0, 2).includes('J. R. R. Tolkien');
  const surfacesFastPaced = negTags.includes('fast-paced') || negRecs.some((b) => b.genres.includes('Mystery & Thriller'));

  recordTest(
    'Dynamic Adaptation (Negative Review): Penalizes author & surfaces fast-paced alternatives',
    negMode && authorPenalized && surfacesFastPaced,
    `Mode: ${negRecs.diagnostics.mode}, Top Authors: ${JSON.stringify(negAuthors.slice(0, 2))}, Tags: ${JSON.stringify(negTags)}`
  );

  // 3.3 Strict Title Similarity Exclusion Invariant
  const titleDiagnostic = posRecs.diagnostics.titleExcluded && negRecs.diagnostics.titleExcluded;
  recordTest(
    'Strict Title Similarity Exclusion Invariant: titleExcluded is true in diagnostics',
    titleDiagnostic,
    `posRecs.titleExcluded: ${posRecs.diagnostics.titleExcluded}, negRecs.titleExcluded: ${negRecs.diagnostics.titleExcluded}`
  );
}

// ===========================================================================
// SECTION 4: Latency & Throughput Benchmark
// ===========================================================================
console.log('\n--- SECTION 4: Latency & Throughput Benchmark (1,000 Synthetic Reviews) ---');

{
  const benchmarkCorpus = [
    'A breathtaking masterpiece of storytelling with unforgettable characters and magnificent world-building.',
    'An unreadable, boring waste of paper. Plodding, slow, and completely flat characters.',
    'The beginning was dull and slow, but the second half was magnificent, riveting, and sublime.',
    'The world was fascinating and rich, but the characters were atrocious and wooden.',
    'Not good, not captivating at all. Thoroughly disappointing and clichéd from start to finish.',
    'Not boring, not dull, quite a pleasant and engaging read with witty dialogue.',
    'It had high potential and promising prose, however the ending was a rushed, disjointed disaster.',
    'An extremely brilliant and profoundly touching narrative that made me cry tears of joy.',
    'Somewhat pleasant but ultimately forgettable and mediocre story with average pacing.',
    'Utterly dreadful, garbage plot with cardboard characters. Absolutely hated every minute.',
  ];

  const N = 1000;
  const latencies = new Float64Array(N);

  // Warmup JIT
  for (let i = 0; i < 50; i++) {
    analyzeReviewSentiment(benchmarkCorpus[i % benchmarkCorpus.length], (i % 5) + 1);
  }

  const startTotal = performance.now();
  for (let i = 0; i < N; i++) {
    const text = benchmarkCorpus[i % benchmarkCorpus.length];
    const rating = (i % 5) + 1;
    const t0 = performance.now();
    analyzeReviewSentiment(text, rating);
    latencies[i] = performance.now() - t0;
  }
  const totalElapsed = performance.now() - startTotal;

  latencies.sort();
  const avgLatency = totalElapsed / N;
  const minLatency = latencies[0];
  const maxLatency = latencies[N - 1];
  const p50Latency = latencies[Math.floor(N * 0.50)];
  const p95Latency = latencies[Math.floor(N * 0.95)];
  const p99Latency = latencies[Math.floor(N * 0.99)];

  const pass = avgLatency < 1.0;
  recordTest(
    `Latency Benchmark (${N} reviews): Avg latency = ${avgLatency.toFixed(4)} ms/review (< 1.0 ms threshold)`,
    pass,
    `Total: ${totalElapsed.toFixed(2)}ms, Avg: ${avgLatency.toFixed(4)}ms, Min: ${minLatency.toFixed(4)}ms, P50: ${p50Latency.toFixed(4)}ms, P95: ${p95Latency.toFixed(4)}ms, P99: ${p99Latency.toFixed(4)}ms, Max: ${maxLatency.toFixed(4)}ms`
  );
}

// ===========================================================================
// SECTION 5: Review Route Module Contract Verification
// ===========================================================================
console.log('\n--- SECTION 5: Review Route Module Contract Verification ---');

{
  const sentimentModule = await import('../recommender/sentiment.js');
  const hasExport = typeof sentimentModule.analyzeSentiment === 'function';
  const isAlias = sentimentModule.analyzeSentiment === sentimentModule.analyzeReviewSentiment;

  // Verify evaluation on rating 4 with negative text produces negative polarity
  let calibratedNegative = null;
  if (hasExport) {
    calibratedNegative = sentimentModule.analyzeSentiment(
      'Not good, not exciting, and definitely not recommended.',
      4
    );
  }
  const pass = hasExport && isAlias && calibratedNegative && calibratedNegative.polarity < 0 && calibratedNegative.label === 'negative';
  recordTest(
    'Review Route Contract: analyzeSentiment is exported as alias and produces calibrated score',
    pass,
    `hasExport: ${hasExport}, isAlias: ${isAlias}, polarity: ${calibratedNegative?.polarity}, label: ${calibratedNegative?.label}`
  );
}

// ===========================================================================
// SUMMARY & VERDICT
// ===========================================================================
console.log('\n===========================================================================');
console.log(`📊 CHALLENGE SUMMARY: ${results.passed} PASSED | ${results.failed} FAILED`);
console.log('===========================================================================');

if (results.findings.length > 0) {
  console.log('\n⚠️  EMPIRICAL DEFECTS & FINDINGS:');
  results.findings.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.name}]`);
    console.log(`     Details: ${f.details}`);
  });
}

const finalVerdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
console.log(`\n🏁 FINAL VERDICT: ${finalVerdict}`);

process.exit(results.failed === 0 ? 0 : 1);
