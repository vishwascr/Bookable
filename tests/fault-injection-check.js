/**
 * Adversarial Fault Injection & Assertion Strength Verification
 * Empirical Challenger Suite
 *
 * Verifies whether test suite assertions catch corrupt/invalid API data
 * or whether they pass trivially.
 */

import assert from 'node:assert/strict';

const results = [];

function recordTest(name, category, mutatedDescription, assertionFn, shouldFail) {
  try {
    assertionFn();
    // Did not throw
    if (shouldFail) {
      results.push({
        name,
        category,
        mutatedDescription,
        verdict: 'WEAK_ASSERTION (TRIVIAL PASS)',
        caught: false,
        detail: 'Assertion failed to catch injected invalid/corrupt response!'
      });
    } else {
      results.push({
        name,
        category,
        mutatedDescription,
        verdict: 'PASS (GENUINE)',
        caught: true,
        detail: 'Expected valid data passed clean assertion.'
      });
    }
  } catch (err) {
    // Threw error
    if (shouldFail) {
      results.push({
        name,
        category,
        mutatedDescription,
        verdict: 'STRONG_ASSERTION (CAUGHT)',
        caught: true,
        detail: `Successfully threw ${err.name}: ${err.message}`
      });
    } else {
      results.push({
        name,
        category,
        mutatedDescription,
        verdict: 'UNEXPECTED_FAILURE',
        caught: false,
        detail: err.message
      });
    }
  }
}

console.log('='.repeat(70));
console.log('  RUNNING EMPIRICAL FAULT INJECTION & ASSERTION SENSITIVITY TEST');
console.log('='.repeat(70));

// =========================================================================
// Category A: Strong Assertions (Features 1, 6, 7, 8)
// =========================================================================

// Test 1: T1-AUTH-01 Password hash leak in signup response
recordTest(
  'T1-AUTH-01: Password hash leaked in signup',
  'Auth & Security',
  'API returns user object containing passwordHash',
  () => {
    const res = {
      status: 201,
      body: {
        token: 'valid.token.sig',
        user: { username: 'testuser', displayName: 'Test', passwordHash: '$2b$10$insecurehash' }
      }
    };
    assert.strictEqual(res.body.user.passwordHash, undefined, 'passwordHash must never be exposed');
  },
  true
);

// Test 2: T1-REC-02 Seed book leaked into recommendations
recordTest(
  'T1-REC-02: Seed book included in candidate recommendations',
  'Recommendation Heuristics',
  'API returns candidates containing seed ISBN 0345339681',
  () => {
    const VALID_SEEDS = ['0345339681', '0441172660', '0439136350'];
    const res = {
      status: 200,
      body: {
        candidates: [{ isbn: '0345339681', score: 0.95 }, { isbn: '1111111111', score: 0.85 }]
      }
    };
    const candidateIsbns = res.body.candidates.map((c) => c.book?.isbn || c.isbn);
    for (const seed of VALID_SEEDS) {
      assert.ok(!candidateIsbns.includes(seed), `Seed ${seed} must not appear in recommendations`);
    }
  },
  true
);

// Test 3: T1-TTL-01 Title excluded flag is false
recordTest(
  'T1-TTL-01: Engine reports titleExcluded: false',
  'Title Exclusion',
  'API returns diagnostics.titleExcluded = false',
  () => {
    const res = {
      status: 200,
      body: {
        diagnostics: { titleExcluded: false, weightsUsed: { title: 0.5, genre: 0.5 } }
      }
    };
    assert.strictEqual(res.body.diagnostics?.titleExcluded, true, 'Diagnostics must explicitly declare titleExcluded: true');
  },
  true
);

// Test 4: T1-REC-03 Score out of normalized bounds (> 1.05)
recordTest(
  'T1-REC-03: Candidate score exceeds normalized [0, 1] bounds',
  'Recommendation Heuristics',
  'API returns candidate score = 4.75',
  () => {
    const res = {
      status: 200,
      body: {
        candidates: [{ isbn: '1234567890', score: 4.75 }]
      }
    };
    for (const c of res.body.candidates) {
      assert.ok(c.score >= 0 && c.score <= 1.05, `Score ${c.score} must be within normalized [0, 1] bounds`);
    }
  },
  true
);

// Test 5: T1-SNT-01 Inverted sentiment label on positive review
recordTest(
  'T1-SNT-01: Glowing review incorrectly classified as negative',
  'Sentiment Analysis',
  'API returns sentiment { score: -0.8, label: "negative" } for 5-star masterpiece',
  () => {
    const res = {
      status: 201,
      body: {
        review: {
          sentiment: { score: -0.8, label: 'negative', keywords: ['boring'] }
        }
      }
    };
    const sentiment = res.body.review.sentiment;
    assert.strictEqual(sentiment.label, 'positive');
    assert.ok(sentiment.score > 0.3);
  },
  true
);

// Test 6: T1-ADP-04 Target ISBN leaked into sentiment-adapted recommendations
recordTest(
  'T1-ADP-04: Target ISBN returned in adapted recommendations',
  'Sentiment Adaptation',
  'API returns target ISBN 0441172660 in adaptedRecommendations',
  () => {
    const target = '0441172660';
    const res = {
      status: 200,
      body: {
        adaptedRecommendations: [{ isbn: '0441172660' }, { isbn: '9999999999' }]
      }
    };
    const recIsbns = res.body.adaptedRecommendations.map((b) => b.isbn);
    assert.ok(!recIsbns.includes(target), 'Target ISBN must be excluded from adapted recommendations');
  },
  true
);

// =========================================================================
// Category B: Weak / Trivial Assertions (Fallbacks & Missing Checks)
// =========================================================================

// Test 7: T1-SHF-02 Reading status transition fallback on 404
recordTest(
  'T1-SHF-02: Shelf status transition returns 404 (endpoint broken)',
  'Shelves & Reading Statuses',
  'API returns 404 Not Found on PUT /me/shelf/:isbn',
  () => {
    const res = { status: 404, body: { error: 'Not Found' } };
    const isbn = '0441172660';
    // Exact assertion logic from tests/e2e-scenarios.test.js:48-54
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.ok(shelves.currentlyReading?.includes(isbn), 'Book must be in currentlyReading');
      assert.ok(!shelves.wantToRead?.includes(isbn), 'Book must be removed from wantToRead');
    } else {
      assert.ok([200, 404].includes(res.status));
    }
  },
  true // We WANT this to fail if the feature is broken, but the test passes!
);

// Test 8: T1-SET-01 Reset books endpoint returns 404
recordTest(
  'T1-SET-01: Reset books returns 404 (feature missing)',
  'Settings Reset',
  'API returns 404 Not Found on POST /me/reset-books',
  () => {
    const res = { status: 404, body: { error: 'Not Found' } };
    // Exact assertion logic from tests/e2e-scenarios.test.js:204-211
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.strictEqual(shelves.wantToRead?.length || 0, 0);
    } else {
      assert.strictEqual(res.status, 404);
    }
  },
  true
);

// Test 9: T3-CMB-01 Auth + Shelving Lifecycle returns 404
recordTest(
  'T3-CMB-01: Shelves endpoint returns 404 or empty',
  'Cross-Feature Combinations',
  'API returns 404 Not Found on GET /me/shelves',
  () => {
    const res = { status: 404 };
    // Exact assertion from tests/e2e-scenarios.test.js:472
    assert.ok([200, 404].includes(res.status));
  },
  true
);

// Test 10: T3-CMB-08 Delete Reviews wipes user shelves (Data corruption)
recordTest(
  'T3-CMB-08: Delete reviews accidentally wipes all shelves',
  'Cross-Feature Combinations',
  'API wiped all user shelves when deleting reviews, but returns 200',
  () => {
    const shf = { status: 200, body: { wantToRead: [] } };
    // Exact assertion from tests/e2e-scenarios.test.js:556
    assert.ok([200, 404].includes(shf.status));
  },
  true
);

// Test 11: T4-SCN-06 GDPR data deletion endpoints return 404
recordTest(
  'T4-SCN-06: Clean slate endpoints both return 404',
  'Tier 4 Scenarios',
  'POST /me/reset-books and DELETE /me/reviews both return 404',
  () => {
    const resetRes = { status: 404 };
    const delRes = { status: 404 };
    // Exact assertions from tests/e2e-scenarios.test.js:721-725
    assert.ok([200, 404].includes(resetRes.status));
    assert.ok([200, 404].includes(delRes.status));
  },
  true
);

// Test 12: T1-CST-03 Custom tag weight completely ignored by server
recordTest(
  'T1-CST-03: Server ignores tag weight dominance',
  'Algorithm Customization',
  'Server returns arbitrary candidate books without tag prioritization',
  () => {
    const res = { status: 200, body: { candidates: [{ isbn: '111', score: 0.5 }] } };
    // Exact assertion from tests/recommendation-heuristics.test.js:199-200
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  },
  true
);

// Print Results Table
console.log('\n' + '-'.repeat(70));
console.log('                 FAULT INJECTION RESULTS SUMMARY');
console.log('-'.repeat(70));

let caughtCount = 0;
let missedCount = 0;

for (const r of results) {
  const icon = r.caught ? '🛡️ [CAUGHT]' : '⚠️ [MISSED]';
  console.log(`${icon} ${r.name}`);
  console.log(`   Category : ${r.category}`);
  console.log(`   Mutation : ${r.mutatedDescription}`);
  console.log(`   Verdict  : ${r.verdict}`);
  console.log(`   Detail   : ${r.detail}\n`);
  if (r.caught) caughtCount++;
  else missedCount++;
}

console.log('='.repeat(70));
console.log(`  TOTAL MUTATIONS EVALUATED: ${results.length}`);
console.log(`  STRONG ASSERTIONS (CAUGHT): ${caughtCount}`);
console.log(`  WEAK / TRIVIAL ASSERTIONS (MISSED): ${missedCount}`);
console.log('='.repeat(70));
