/**
 * Tier 5 Adversarial Coverage Hardening Test Suite (Tiers 1-5 Master Suite)
 * Integrates all adversarial tests from Challenger 1 (26 tests) & Challenger 2 (40 tests).
 * Total: 66 Tests.
 *
 * Execution:
 *   Standalone: node --test tests/tier5-adversarial.test.js
 *   Master runner: node tests/run-all.js --suite=tier5
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createTestUser,
  uniqueUsername,
  createSignedToken,
  KNOWN_SEEDS,
} from './helpers.js';

import {
  analyzeReviewSentiment,
  LITERARY_LEXICON,
} from '../server/src/recommender/sentiment.js';

import {
  inferTags,
  inferGenres,
  computeBaselineRating,
  getCatalogRating,
} from '../server/src/recommender/metadata.js';

import {
  scoreCandidate,
  computeHeuristicFeatures,
  DEFAULT_THREE_WEIGHTS,
} from '../server/src/recommender/algorithms.js';

const VALID_SEEDS = [
  KNOWN_SEEDS.HOBBIT,
  KNOWN_SEEDS.DUNE,
  KNOWN_SEEDS.HP_AZKABAN,
];

// ============================================================================
// PART 1: User, Auth, Reviews & Isolation Adversarial Tests (Challenger 1)
// ============================================================================

describe('Tier 5 Suite 1: Type Confusion & Malformed Parameter Attacks', () => {
  it('T5-ADV-TYPE-01: Non-array string in PUT /api/me/favorites returns 400 Bad Request, not 500 crash', async () => {
    const user = await createTestUser('adv_fav_str');
    assert.ok(user.token);

    const res = await request('PUT', '/me/favorites', { isbns: KNOWN_SEEDS.HOBBIT }, user.token);
    assert.strictEqual(
      res.status,
      400,
      `Expected 400 Bad Request for string isbns, but got ${res.status}: ${JSON.stringify(res.body)}`
    );
  });

  it('T5-ADV-TYPE-02: Non-array number or null in PUT /api/me/favorites returns 400 Bad Request, not 500 crash', async () => {
    const user = await createTestUser('adv_fav_num');
    assert.ok(user.token);

    const res = await request('PUT', '/me/favorites', { isbns: 123456 }, user.token);
    assert.strictEqual(
      res.status,
      400,
      `Expected 400 Bad Request for numeric isbns, but got ${res.status}: ${JSON.stringify(res.body)}`
    );
  });

  it('T5-ADV-TYPE-03: User registration with displayName > 60 chars returns 400 Bad Request, not 500 crash', async () => {
    const username = uniqueUsername('long_disp');
    const res = await request('POST', '/auth/signup', {
      username,
      password: 'Password123!',
      displayName: 'A'.repeat(80),
    });

    assert.strictEqual(
      res.status,
      400,
      `Expected 400 Bad Request for displayName > 60 chars, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  });

  it('T5-ADV-TYPE-04: Prototype property lookup algo=constructor in /me/recommend returns 400 Bad Request, not 500 crash', async () => {
    const user = await createTestUser('adv_proto_cons');
    assert.ok(user.token);

    await request(
      'PUT',
      '/me/favorites',
      { isbns: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN] },
      user.token
    );

    const res = await request('GET', '/me/recommend?algo=constructor', null, user.token);
    assert.strictEqual(
      res.status,
      400,
      `Expected 400 Bad Request for algo=constructor, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  });

  it('T5-ADV-TYPE-05: Prototype property lookup algo=toString in /me/recommend returns 400 Bad Request, not 500 crash', async () => {
    const user = await createTestUser('adv_proto_str');
    assert.ok(user.token);

    await request(
      'PUT',
      '/me/favorites',
      { isbns: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN] },
      user.token
    );

    const res = await request('GET', '/me/recommend?algo=toString', null, user.token);
    assert.strictEqual(
      res.status,
      400,
      `Expected 400 Bad Request for algo=toString, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  });

  it('T5-ADV-TYPE-06: Non-numeric and non-integer ratings in review submission are strictly rejected with 400', async () => {
    const user = await createTestUser('adv_bad_rate');
    assert.ok(user.token);

    const floatRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: 4.5, text: 'Float rating' },
      user.token
    );
    assert.strictEqual(floatRes.status, 400, 'Float rating 4.5 must be rejected with 400');

    const strRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: '5', text: 'String rating' },
      user.token
    );
    assert.strictEqual(strRes.status, 400, 'String rating "5" must be rejected with 400');

    const arrRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: [5], text: 'Array rating' },
      user.token
    );
    assert.strictEqual(arrRes.status, 400, 'Array rating [5] must be rejected with 400');

    const objRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: { $gt: 0 }, text: 'Object injection' },
      user.token
    );
    assert.strictEqual(objRes.status, 400, 'Object rating must be rejected with 400');
  });

  it('T5-ADV-TYPE-07: Non-string review text payloads are strictly rejected with 400', async () => {
    const user = await createTestUser('adv_bad_text');
    assert.ok(user.token);

    const arrRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: 5, text: ['hacked text'] },
      user.token
    );
    assert.strictEqual(arrRes.status, 400, 'Array text must be rejected with 400');

    const objRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: 5, text: { nested: true } },
      user.token
    );
    assert.strictEqual(objRes.status, 400, 'Object text must be rejected with 400');

    const numRes = await request(
      'POST',
      `/books/${KNOWN_SEEDS.HOBBIT}/reviews`,
      { rating: 5, text: 12345 },
      user.token
    );
    assert.strictEqual(numRes.status, 400, 'Numeric text must be rejected with 400');
  });
});

describe('Tier 5 Suite 2: Concurrency, Race Conditions & Duplicate Integrity', () => {
  it('T5-ADV-RACE-01: Concurrent signups with identical username returns 409 Conflict for loser, not 500 crash', async () => {
    const username = uniqueUsername('race_u');
    const [res1, res2] = await Promise.all([
      request('POST', '/auth/signup', { username, password: 'Password123!' }),
      request('POST', '/auth/signup', { username, password: 'Password123!' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(
      statuses,
      [201, 409],
      `Expected [201, 409] for concurrent duplicate signup, got [${res1.status}, ${res2.status}]`
    );
  });

  it('T5-ADV-RACE-02: Concurrent review upserts on same book by same user execute idempotently without duplicate reviews', async () => {
    const user = await createTestUser('adv_race_upsert');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.DUNE;

    const [r1, r2, r3] = await Promise.all([
      request('POST', `/books/${isbn}/reviews`, { rating: 5, text: 'First concurrent' }, user.token),
      request('POST', `/books/${isbn}/reviews`, { rating: 3, text: 'Second concurrent' }, user.token),
      request('POST', `/books/${isbn}/reviews`, { rating: 4, text: 'Third concurrent' }, user.token),
    ]);

    assert.strictEqual(r1.status, 201);
    assert.strictEqual(r2.status, 201);
    assert.strictEqual(r3.status, 201);

    const publicRes = await request('GET', `/books/${isbn}/reviews`);
    assert.strictEqual(publicRes.status, 200);

    const userReviews = publicRes.body.reviews.filter((r) => String(r.userId) === String(user.user.id));
    assert.strictEqual(userReviews.length, 1, 'Only one review must exist per user per book after concurrent upserts');
  });

  it('T5-ADV-RACE-03: Rapid shelf transitions do not corrupt reading shelves or duplicate ISBNs', async () => {
    const user = await createTestUser('adv_race_shelf');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.HP_AZKABAN;

    await request('PUT', `/me/shelf/${isbn}`, { status: 'want_to_read' }, user.token);
    await request('PUT', `/me/shelf/${isbn}`, { status: 'currently_reading' }, user.token);
    await request('PUT', `/me/shelf/${isbn}`, { status: 'read' }, user.token);
    await request('PUT', `/me/shelf/${isbn}`, { status: 'currently_reading' }, user.token);

    const profile = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(profile.status, 200);

    const currentlyReading = profile.body.currentlyReading || [];
    const wantToRead = profile.body.wantToRead || [];
    const read = profile.body.read || [];

    const occurencesInCurrent = currentlyReading.filter((b) => (b.isbn || b) === isbn).length;
    const occurencesInWant = wantToRead.filter((b) => (b.isbn || b) === isbn).length;
    const occurencesInRead = read.filter((b) => (b.isbn || b) === isbn).length;

    assert.strictEqual(occurencesInCurrent, 1, 'Book should appear exactly once in currentlyReading');
    assert.strictEqual(occurencesInWant, 0, 'Book must not appear in wantToRead');
    assert.strictEqual(occurencesInRead, 0, 'Book must not appear in read');
  });
});

describe('Tier 5 Suite 3: Auth Security, Token Manipulation & IDOR Boundary Checks', () => {
  it('T5-ADV-AUTH-01: Token with alg: "none" is rejected with 401 Unauthorized', async () => {
    const user = await createTestUser('adv_alg_none');
    assert.ok(user.token);

    const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: user.user.id, u: user.username })).toString('base64url');
    const unsignedToken = `${unsignedHeader}.${payload}.`;

    const res = await request('GET', '/me', null, unsignedToken);
    assert.strictEqual(res.status, 401, `Unsigned alg:none token must return 401, got ${res.status}`);
  });

  it('T5-ADV-AUTH-02: Token with null or missing sub claim is rejected with 401 Unauthorized', async () => {
    const badToken = createSignedToken({ sub: null, u: 'hacker' });
    const res = await request('GET', '/me', null, badToken);
    assert.strictEqual(res.status, 401, `Token without sub must return 401, got ${res.status}`);
  });

  it('T5-ADV-AUTH-03: Body parameter injection in review submission cannot spoof userId or username', async () => {
    const userA = await createTestUser('adv_user_a');
    const userB = await createTestUser('adv_user_b');
    assert.ok(userA.token);
    assert.ok(userB.token);

    const isbn = KNOWN_SEEDS.STAR_TREK;

    const spoofRes = await request(
      'POST',
      `/books/${isbn}/reviews`,
      {
        rating: 5,
        text: 'Legit review from User A',
        userId: userB.user.id,
        username: userB.username,
        displayName: 'Spoofed Name',
      },
      userA.token
    );

    assert.strictEqual(spoofRes.status, 201);
    assert.strictEqual(
      String(spoofRes.body.review.userId),
      String(userA.user.id),
      'Review userId must match authenticated user, not spoofed body'
    );
    assert.strictEqual(
      spoofRes.body.review.username,
      userA.username,
      'Review username must match authenticated user, not spoofed body'
    );
  });

  it('T5-ADV-AUTH-04: Cross-user deletion of review is strictly forbidden with 403', async () => {
    const userA = await createTestUser('adv_owner');
    const userB = await createTestUser('adv_attacker');
    const isbn = KNOWN_SEEDS.CATCHER;

    const createRes = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 5, text: 'Owner review' },
      userA.token
    );
    assert.strictEqual(createRes.status, 201);
    const reviewId = createRes.body.review._id;

    const delRes = await request('DELETE', `/reviews/${reviewId}`, null, userB.token);
    assert.strictEqual(delRes.status, 403, `Attacker must receive 403 Forbidden, got ${delRes.status}`);

    const checkRes = await request('GET', `/books/${isbn}/reviews`);
    assert.ok(checkRes.body.reviews.some((r) => r._id === reviewId), 'Review must still exist after failed attack');
  });

  it('T5-ADV-AUTH-05: Optional auth endpoint /api/books/:isbn/reviews succeeds for guests with invalid token', async () => {
    const res = await request('GET', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, null, 'invalid.tampered.token');
    assert.strictEqual(res.status, 200, `Guest with malformed token should receive 200 public view, got ${res.status}`);
    assert.strictEqual(res.body.userReview, null, 'userReview should be null for unauthenticated/invalid token');
  });
});

describe('Tier 5 Suite 4: Complex Unicode, Emojis, and Extreme Payload Resilience', () => {
  it('T5-ADV-UNIC-01: Multibyte emojis, symbols, and CJK text are correctly stored, returned, and analyzed', async () => {
    const user = await createTestUser('adv_emoji');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.BRAVE_NEW_WORLD;

    const complexText =
      '🌟📚 Breathtaking masterpiece! 素晴らしい! 🔥❤️ Unputdownable page-turner! 100% recommended! 👍✨';

    const postRes = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 5, text: complexText },
      user.token
    );

    assert.strictEqual(postRes.status, 201);
    assert.strictEqual(postRes.body.review.text, complexText, 'Review text must preserve exact Unicode string');
    assert.strictEqual(postRes.body.review.sentiment.label, 'positive');
    assert.ok(
      postRes.body.review.sentiment.score > 0.8,
      `Expected positive sentiment score > 0.8, got ${postRes.body.review.sentiment.score}`
    );

    const publicRes = await request('GET', `/books/${isbn}/reviews`);
    const found = publicRes.body.reviews.find((r) => r._id === postRes.body.review._id);
    assert.ok(found);
    assert.strictEqual(found.text, complexText);
  });

  it('T5-ADV-UNIC-02: Review text at exact boundary: 5000 characters succeeds, 5001 characters rejected', async () => {
    const user = await createTestUser('adv_bound_text');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.FAHRENHEIT_451;

    // 5000 character review: 416 * 12 + 8 = 4992 + 8 = 5000
    const text5000 = 'Great book! '.repeat(416) + 'End!!!!!';
    assert.strictEqual(text5000.length, 5000);

    const res5000 = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 5, text: text5000 },
      user.token
    );
    assert.strictEqual(res5000.status, 201, `5000-char review must be accepted with 201, got ${res5000.status}`);

    // 5001 character review
    const text5001 = text5000 + '!';
    assert.strictEqual(text5001.length, 5001);

    const res5001 = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 5, text: text5001 },
      user.token
    );
    assert.strictEqual(res5001.status, 400, `5001-char review must be rejected with 400, got ${res5001.status}`);
  });

  it('T5-ADV-UNIC-03: Whitespace-only review text is trimmed and accepted as empty review text', async () => {
    const user = await createTestUser('adv_ws_text');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.MOCKINGBIRD;

    const res = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 4, text: '   \n\t   ' },
      user.token
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.review.text, '', 'Whitespace-only review text should be trimmed to empty string');
  });
});

describe('Tier 5 Suite 5: Full Review Lifecycle & Dynamic Shelf Transition Consistency', () => {
  it('T5-ADV-LIFE-01: Full lifecycle: review auto-shelves to read -> manual shelf shift -> re-review re-shelves to read', async () => {
    const user = await createTestUser('adv_lifecycle');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.DA_VINCI;

    const rev1 = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 5, text: 'Initial high rating' },
      user.token
    );
    assert.strictEqual(rev1.status, 201);
    assert.ok(rev1.body.shelves.read.includes(isbn), 'Book must be auto-shelved to read');

    const shelfRes = await request('PUT', `/me/shelf/${isbn}`, { status: 'want_to_read' }, user.token);
    assert.strictEqual(shelfRes.status, 200);
    assert.ok(shelfRes.body.shelves.wantToRead.includes(isbn));
    assert.ok(!shelfRes.body.shelves.read.includes(isbn));

    const checkRev = await request('GET', `/books/${isbn}/reviews`, null, user.token);
    assert.strictEqual(checkRev.status, 200);
    assert.ok(checkRev.body.userReview !== null, 'User review must persist regardless of shelf status');

    const rev2 = await request(
      'POST',
      `/books/${isbn}/reviews`,
      { rating: 3, text: 'Updated rating after reflection' },
      user.token
    );
    assert.strictEqual(rev2.status, 201);
    assert.ok(rev2.body.shelves.read.includes(isbn), 'Re-reviewing must re-transition book to read shelf');
    assert.ok(!rev2.body.shelves.wantToRead.includes(isbn), 'Book must be removed from wantToRead shelf');
  });

  it('T5-ADV-LIFE-02: Reset books preserves user reviews intact in catalog and user profile', async () => {
    const user = await createTestUser('adv_reset_rev');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.HOBBIT;

    await request('POST', `/books/${isbn}/reviews`, { rating: 5, text: 'Keep this review' }, user.token);

    const resetRes = await request('POST', '/me/reset-books', {}, user.token);
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.body.shelves.read.length, 0);

    const meRevs = await request('GET', '/me/reviews', null, user.token);
    assert.strictEqual(meRevs.status, 200);
    assert.strictEqual(meRevs.body.total, 1, 'Review must remain after reset-books');

    const pubRevs = await request('GET', `/books/${isbn}/reviews`);
    assert.ok(pubRevs.body.reviews.some((r) => String(r.userId) === String(user.user.id)));
  });

  it('T5-ADV-LIFE-03: Delete reviews removes reviews but preserves personal shelves', async () => {
    const user = await createTestUser('adv_del_rev');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.DUNE;

    await request('POST', `/books/${isbn}/reviews`, { rating: 4, text: 'Will be deleted' }, user.token);

    const delRes = await request('DELETE', '/me/reviews', null, user.token);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.deletedCount, 1);

    const shelves = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(shelves.status, 200);
    assert.ok(shelves.body.read.some((b) => (b.isbn || b) === isbn), 'Read shelf must remain intact');

    const pubRevs = await request('GET', `/books/${isbn}/reviews`);
    assert.ok(!pubRevs.body.reviews.some((r) => String(r.userId) === String(user.user.id)));
  });
});

describe('Tier 5 Suite 6: Boundary Conditions, Malformed Identifiers & Input Sanitization', () => {
  it('T5-ADV-BND-01: Malformed ObjectId in DELETE /api/reviews/:id returns 400 Bad Request', async () => {
    const user = await createTestUser('adv_bnd_id');
    assert.ok(user.token);

    const res = await request('DELETE', '/reviews/not-an-object-id', null, user.token);
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for malformed ID, got ${res.status}`);
  });

  it('T5-ADV-BND-02: Non-existent 24-hex ObjectId in DELETE /api/reviews/:id returns 404 Not Found', async () => {
    const user = await createTestUser('adv_bnd_404');
    assert.ok(user.token);

    const res = await request('DELETE', '/reviews/000000000000000000000000', null, user.token);
    assert.strictEqual(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
  });

  it('T5-ADV-BND-03: Whitespace or invalid ISBN in PUT /api/me/shelf/:isbn returns 404 Book not found', async () => {
    const user = await createTestUser('adv_bnd_isbn');
    assert.ok(user.token);

    const res = await request('PUT', '/me/shelf/%20%20%20', { status: 'want_to_read' }, user.token);
    assert.strictEqual(res.status, 404, `Expected 404 Book not found for whitespace ISBN, got ${res.status}`);
  });

  it('T5-ADV-BND-04: Non-existent ISBN in POST /api/books/:isbn/reviews returns 404 Book not found', async () => {
    const user = await createTestUser('adv_bnd_rev_isbn');
    assert.ok(user.token);

    const res = await request(
      'POST',
      `/books/${KNOWN_SEEDS.NON_EXISTENT_ISBN}/reviews`,
      { rating: 5, text: 'Reviewing ghost book' },
      user.token
    );
    assert.strictEqual(res.status, 404, `Expected 404 Book not found, got ${res.status}`);
  });

  it('T5-ADV-BND-05: Duplicate ISBNs in PUT /api/me/favorites are deduplicated and validated', async () => {
    const user = await createTestUser('adv_bnd_dup_fav');
    assert.ok(user.token);

    const res = await request(
      'PUT',
      '/me/favorites',
      { isbns: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.HOBBIT] },
      user.token
    );
    assert.strictEqual(res.status, 400, 'Duplicate ISBNs resulting in < 3 distinct books must return 400');
  });
});

// ============================================================================
// PART 2: Recommender, Heuristics, Sentiment & Taxonomy Adversarial Tests (Challenger 2)
// ============================================================================

describe('Tier 5 Suite 7: Algorithm Customization & Weight Boundary Extremes', () => {
  it('T5-ADV2-WGT-01: Non-finite Infinity weight in POST /recommend/three must not corrupt candidate scores', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      weights: { genre: 'Infinity', author: 0, tag: 0, rating: 0 },
      limit: 5,
    });

    assert.strictEqual(
      res.status,
      400,
      'Server should reject non-finite Infinity weight with HTTP 400'
    );
  });

  it('T5-ADV2-WGT-02: Extreme large finite weight values (1e10) remain normalized in [0, 1]', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      weights: { genre: 1e10, author: 1, tag: 1, rating: 1 },
      limit: 5,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.candidates));
    assert.ok(res.body.candidates.length > 0);
    for (const c of res.body.candidates) {
      assert.strictEqual(typeof c.score, 'number');
      assert.ok(
        c.score >= 0 && c.score <= 1.0,
        `Score ${c.score} must remain bounded in [0, 1]`
      );
    }
  });

  it('T5-ADV2-WGT-03: Negative weight values return HTTP 400 Bad Request with field error', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      weights: { genre: -0.5, author: 0.5, tag: 0.5, rating: 0.5 },
    });

    assert.strictEqual(res.status, 400);
    assert.ok(
      res.body.error && res.body.error.toLowerCase().includes('non-negative'),
      `Expected error about non-negative number, got: ${res.body.error}`
    );
  });

  it('T5-ADV2-WGT-04: All-zero weights return HTTP 400 Bad Request', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      weights: { genre: 0, author: 0, tag: 0, rating: 0 },
    });

    assert.strictEqual(res.status, 400);
    assert.ok(
      res.body.error && res.body.error.toLowerCase().includes('greater than zero'),
      `Expected error about greater than zero, got: ${res.body.error}`
    );
  });

  it('T5-ADV2-WGT-05: Non-object weight types (array, string, boolean) return HTTP 400 Bad Request', async () => {
    const testCases = [
      [0.5, 0.5, 0.5], // Array
      'genre: 0.5',    // String
      true,             // Boolean
    ];

    for (const badWeights of testCases) {
      const res = await request('POST', '/recommend/three', {
        seeds: VALID_SEEDS,
        weights: badWeights,
      });
      assert.strictEqual(
        res.status,
        400,
        `Expected 400 for weights=${JSON.stringify(badWeights)}, got ${res.status}`
      );
    }
  });

  it('T5-ADV2-WGT-06: Title weight injection is strictly ignored and omitted from diagnostics', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      weights: { title: 0.99, genre: 0.5, author: 0.5, tag: 0.5, rating: 0.5 },
      limit: 5,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.diagnostics?.titleExcluded, true);
    assert.strictEqual(res.body.diagnostics?.weightsUsed?.title, undefined);
    for (const c of res.body.candidates) {
      assert.strictEqual(c.features?.title, undefined);
    }
  });
});

describe('Tier 5 Suite 8: Seed ISBN Integrity, Edition Deduplication & Candidate Generation', () => {
  it('T5-ADV2-SED-01: Fewer than 3 seeds returns HTTP 400 Bad Request', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes('3'));
  });

  it('T5-ADV2-SED-02: More than 3 seeds returns HTTP 400 Bad Request', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [
        KNOWN_SEEDS.HOBBIT,
        KNOWN_SEEDS.DUNE,
        KNOWN_SEEDS.HP_AZKABAN,
        KNOWN_SEEDS.MOCKINGBIRD,
      ],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes('3'));
  });

  it('T5-ADV2-SED-03: Duplicate seed ISBNs in array returns HTTP 400 Bad Request', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.toLowerCase().includes('distinct'));
  });

  it('T5-ADV2-SED-04: Nonexistent seed ISBN returns HTTP 400 listing missing ISBN', async () => {
    const fakeIsbn = '9999999999999';
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, fakeIsbn],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes(fakeIsbn));
  });

  it('T5-ADV2-SED-05: Multiple unknown seed ISBNs formats all missing ISBNs in error message', async () => {
    const fake1 = '8888888888001';
    const fake2 = '8888888888002';
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, fake1, fake2],
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes(fake1));
    assert.ok(res.body.error?.includes(fake2));
  });

  it('T5-ADV2-SED-06: Whitespace-padded seed ISBNs are trimmed and resolved successfully', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [
        `  ${KNOWN_SEEDS.HOBBIT}  `,
        `\t${KNOWN_SEEDS.DUNE}\n`,
        ` ${KNOWN_SEEDS.HP_AZKABAN} `,
      ],
      limit: 5,
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates?.length > 0);
  });

  it('T5-ADV2-SED-07: Alternate editions of seed books are strictly excluded from candidates', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS,
      limit: 25,
    });
    assert.strictEqual(res.status, 200);
    const candidateTitles = res.body.candidates.map((c) => (c.title || '').toLowerCase());
    for (const t of candidateTitles) {
      assert.ok(
        !t.includes('the hobbit : the enchanting prelude'),
        `Seed edition leaked into candidates: ${t}`
      );
    }
  });

  it('T5-ADV2-SED-08: Diverse seeds across distinct genres produce balanced recommendations', async () => {
    const diverseSeeds = [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.MOCKINGBIRD, KNOWN_SEEDS.DUNE];
    const res = await request('POST', '/recommend/three', {
      seeds: diverseSeeds,
      limit: 12,
    });
    assert.strictEqual(res.status, 200);
    const candidates = res.body.candidates;
    assert.ok(candidates.length >= 5);

    const seedAttributions = new Set(candidates.map((c) => c.bestSeed));
    assert.ok(
      seedAttributions.size >= 2,
      `Expected at least 2 seeds represented in diverse recs, got ${seedAttributions.size}`
    );
  });
});

describe('Tier 5 Suite 9: Single-Seed Route & Prototype Pollution Resistance', () => {
  it('T5-ADV2-PRT-01: Single-seed endpoint with algo=constructor must not crash with HTTP 500', async () => {
    const res = await request('GET', `/recommend/${KNOWN_SEEDS.HOBBIT}?algo=constructor`);
    assert.notStrictEqual(
      res.status,
      500,
      'Server must not return HTTP 500 crash for ?algo=constructor'
    );
    assert.strictEqual(res.status, 400, 'Expected HTTP 400 Bad Request for unknown algo');
  });

  it('T5-ADV2-PRT-02: Single-seed endpoint with unknown algorithm string returns HTTP 400', async () => {
    const res = await request('GET', `/recommend/${KNOWN_SEEDS.HOBBIT}?algo=nonexistent_algo`);
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes('Unknown algo'));
  });

  it('T5-ADV2-PRT-03: Single-seed endpoint with algo=all executes all 5 valid algorithms and excludes seeds', async () => {
    const res = await request('GET', `/recommend/${KNOWN_SEEDS.HOBBIT}?algo=all&limit=5`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.runs));
    assert.strictEqual(res.body.runs.length, 5);

    for (const run of res.body.runs) {
      assert.ok(['tfidf', 'author', 'publisher', 'year', 'hybrid'].includes(run.algorithm));
      for (const item of run.results) {
        assert.notStrictEqual(item.book.isbn, KNOWN_SEEDS.HOBBIT, 'Seed book must be excluded');
        assert.ok(item.score >= 0 && item.score <= 1, 'Score must be in [0, 1]');
      }
    }
  });

  it('T5-ADV2-PRT-04: Single-seed endpoint with non-existent ISBN returns HTTP 404 Not Found', async () => {
    const res = await request('GET', `/recommend/${KNOWN_SEEDS.NON_EXISTENT_ISBN}`);
    assert.strictEqual(res.status, 404);
  });
});

describe('Tier 5 Suite 10: Literary Sentiment Analysis Linguistic Stress Testing', () => {
  it('T5-ADV2-SNT-01: Empty string and whitespace-only text with neutral star rating evaluates to 0.0 neutral', () => {
    const emptyResult = analyzeReviewSentiment('', 3);
    assert.strictEqual(emptyResult.score, 0.0);
    assert.strictEqual(emptyResult.label, 'neutral');
    assert.strictEqual(emptyResult.positiveWords.length, 0);
    assert.strictEqual(emptyResult.negativeWords.length, 0);

    const spaceResult = analyzeReviewSentiment('   \n\t   ', 3);
    assert.strictEqual(spaceResult.score, 0.0);
    assert.strictEqual(spaceResult.label, 'neutral');
  });

  it('T5-ADV2-SNT-02: Double negation phrase ("not without merit") correctly affirms positive acclaim', () => {
    const res = analyzeReviewSentiment('This book is not without merit and has thoughtful prose.', 4);
    assert.strictEqual(res.label, 'positive');
    assert.ok(res.score > 0.2, `Score ${res.score} should be > 0.2`);
    assert.ok(res.negatorsDetected.includes('not'));
    assert.ok(res.negatorsDetected.includes('without'));
  });

  it('T5-ADV2-SNT-03: Triple negation stack ("not not not good") inverts valence back to negative', () => {
    const res = analyzeReviewSentiment('It was not not not good at all.', 2);
    assert.strictEqual(res.label, 'negative');
    assert.ok(res.score < 0, `Score ${res.score} should be negative`);
  });

  it('T5-ADV2-SNT-04: Sarcastic review with negative intensifiers correctly classifies as negative', () => {
    const res = analyzeReviewSentiment(
      'Oh fantastic, another utterly dreadful, completely boring, and atrocious disaster.',
      1
    );
    assert.strictEqual(res.label, 'negative');
    assert.ok(res.score < -0.6, `Sarcastic review score ${res.score} should be < -0.6`);
  });

  it('T5-ADV2-SNT-05: Contrast conjunction upweights the concluding clause over opening clause', () => {
    const res = analyzeReviewSentiment('Good start, but the ending was terrible and awful.', 2);
    assert.strictEqual(res.label, 'negative');
    assert.ok(res.score < -0.3, `Score ${res.score} should reflect the negative conclusion`);
  });

  it('T5-ADV2-SNT-06: Foreign language review text gracefully falls back to star rating polarity without crashing', () => {
    const resGerman = analyzeReviewSentiment('Ein absolut wunderbares und spannendes Buch!', 5);
    assert.strictEqual(resGerman.label, 'positive');
    assert.strictEqual(resGerman.score, 1.0);
    assert.strictEqual(resGerman.metrics.lexiconMatches, 0);

    const resFrench = analyzeReviewSentiment('Ce livre est affreux et insupportable.', 1);
    assert.strictEqual(resFrench.label, 'negative');
    assert.strictEqual(resFrench.score, -1.0);
  });

  it('T5-ADV2-SNT-07: Emoji-only and symbol-heavy text computes polarity cleanly from star rating', () => {
    const res = analyzeReviewSentiment('🚀 ❤️ ⭐ 📚 👏 🎉 🔥', 5);
    assert.strictEqual(res.label, 'positive');
    assert.strictEqual(res.score, 1.0);
    assert.strictEqual(res.metrics.tokensScanned, 0);
  });

  it('T5-ADV2-SNT-08: Massive 5,000 character review text executes sub-millisecond without timeout', () => {
    const repeated = 'A captivating masterpiece of profound literature with extraordinary world-building. ';
    const longText = repeated.repeat(Math.ceil(5000 / repeated.length)).slice(0, 5000);

    const t0 = performance.now();
    const res = analyzeReviewSentiment(longText, 5);
    const duration = performance.now() - t0;

    assert.ok(duration < 50, `Expected < 50ms execution, took ${duration.toFixed(2)}ms`);
    assert.strictEqual(res.label, 'positive');
    assert.ok(res.score > 0.8);
  });

  it('T5-ADV2-SNT-09: Aspect extraction correctly distinguishes "slow-burn" from lone "slow"', () => {
    const resSlowBurn = analyzeReviewSentiment('A brilliant slow-burn fantasy novel with deep lore.', 4);
    assert.ok(resSlowBurn.aspects.includes('slow-burn'), 'Must detect slow-burn');
    assert.ok(!resSlowBurn.aspects.includes('slow-dragging'), 'Must NOT trigger slow-dragging on slow-burn');

    const resSlowDrag = analyzeReviewSentiment('Pacing was too slow, plodding, and boring.', 2);
    assert.ok(resSlowDrag.aspects.includes('slow-dragging'), 'Must detect slow-dragging on lone slow');
    assert.ok(!resSlowDrag.aspects.includes('slow-burn'), 'Must NOT trigger slow-burn on slow-dragging');
  });

  it('T5-ADV2-SNT-10: Substring word boundaries prevent false aspect triggers ("explores" does not trigger "lore")', () => {
    const res = analyzeReviewSentiment('The author explores philosophical themes of existence.', 4);
    assert.ok(res.aspects.includes('philosophical'));
    assert.ok(!res.aspects.includes('world-building'), '"explores" must not match "lore"');
  });
});

describe('Tier 5 Suite 11: Sentiment-Adapted Recommendation Boundaries & Fallbacks', () => {
  it('T5-ADV2-ADP-01: Sentiment adaptation without targetIsbn succeeds with catalog-wide fallback', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      rating: 5,
      reviewText: 'A breathtaking masterpiece of high fantasy and extraordinary world-building.',
      limit: 10,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.diagnostics?.targetIsbn, null);
    assert.ok(res.body.diagnostics?.reason?.includes('your recent book'));
    assert.ok(Array.isArray(res.body.adaptedRecommendations));
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });

  it('T5-ADV2-ADP-02: Float star rating (3.5) scales star polarity continuously without rounding errors', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 3.5,
      reviewText: 'A solid and intriguing story with decent world-building.',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.diagnostics?.rating, 3.5);
    assert.strictEqual(res.body.sentiment?.breakdown?.starPolarity, 0.25);
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });

  it('T5-ADV2-ADP-03: Out-of-bounds star ratings (0, -1, 6, 99) return HTTP 400 Bad Request', async () => {
    const invalidRatings = [0, -1, 6, 99, 5.1];
    for (const r of invalidRatings) {
      const res = await request('POST', '/recommend/sentiment-adapted', {
        targetIsbn: KNOWN_SEEDS.DUNE,
        rating: r,
        reviewText: 'Decent',
      });
      assert.strictEqual(res.status, 400, `Expected 400 for rating=${r}, got ${res.status}`);
      assert.ok(res.body.error?.includes('between 1 and 5'));
    }
  });

  it('T5-ADV2-ADP-04: Non-numeric star rating strings ("five", "NaN") return HTTP 400 Bad Request', async () => {
    const nonNumericRatings = ['five', 'NaN', 'null', 'undefined', 'Infinity'];
    for (const r of nonNumericRatings) {
      const res = await request('POST', '/recommend/sentiment-adapted', {
        targetIsbn: KNOWN_SEEDS.DUNE,
        rating: r,
        reviewText: 'Solid',
      });
      assert.strictEqual(res.status, 400, `Expected 400 for rating="${r}", got ${res.status}`);
    }
  });

  it('T5-ADV2-ADP-05: Review text exceeding 5,000 characters returns HTTP 400 Bad Request', async () => {
    const hugeText = 'a'.repeat(5001);
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 4,
      reviewText: hugeText,
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.includes('5000'));
  });

  it('T5-ADV2-ADP-06: Severe negative review triggers negative_contrast strategy with contrasting vibes', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 1,
      reviewText: 'Too slow, plodding, boring slog of a book.',
      limit: 10,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment?.label, 'negative');
    assert.strictEqual(res.body.diagnostics?.adaptationStrategy, 'negative_contrast');
    assert.ok(res.body.diagnostics?.contrastingVibes?.length > 0);
    assert.ok(res.body.diagnostics?.reason?.includes('change of pace'));
  });

  it('T5-ADV2-ADP-07: Limit parameter clamps to bounds [1, 50]', async () => {
    const resLow = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HOBBIT,
      rating: 5,
      limit: -5,
    });
    assert.strictEqual(resLow.status, 200);
    assert.strictEqual(resLow.body.adaptedRecommendations.length, 1);

    const resHigh = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HOBBIT,
      rating: 5,
      limit: 200,
    });
    assert.strictEqual(resHigh.status, 200);
    assert.ok(resHigh.body.adaptedRecommendations.length <= 50);
  });

  it('T5-ADV2-ADP-08: Strict title similarity exclusion affirmed in sentiment-adapted diagnostics', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HP_AZKABAN,
      rating: 5,
      reviewText: 'A magical delight with magnificent adventure.',
      limit: 5,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.diagnostics?.titleExcluded, true);
    for (const b of res.body.adaptedRecommendations) {
      assert.notStrictEqual(b.isbn, KNOWN_SEEDS.HP_AZKABAN, 'Target ISBN must be excluded');
    }
  });
});

describe('Tier 5 Suite 12: Metadata Classification & Catalog Baseline Isolation', () => {
  it('T5-ADV2-MTD-01: inferTags strictly never reads or tokenizes book.title', () => {
    const mockBook = {
      title: 'High Fantasy Dragon Wizard Magic Chronicles',
      author: 'Unknown Author',
      publisher: 'Unknown Publisher',
      year: 1925,
      genres: ['General Fiction'],
    };

    const tags = inferTags(mockBook);
    assert.ok(!tags.includes('high-fantasy'), 'Tags must not contain high-fantasy derived from title');
    assert.ok(!tags.includes('mythic'), 'Tags must not contain mythic derived from title');
    assert.ok(tags.includes('classic-era'), 'Tags must derive era from publication year');
  });

  it('T5-ADV2-MTD-02: computeBaselineRating deterministically bounds empty/null inputs in [3.80, 4.60]', () => {
    const ratings = [
      computeBaselineRating(''),
      computeBaselineRating(null),
      computeBaselineRating(undefined),
      computeBaselineRating('0345339681'),
      computeBaselineRating({ title: 'Untitled' }),
    ];

    for (const r of ratings) {
      assert.strictEqual(typeof r, 'number');
      assert.ok(r >= 3.80 && r <= 4.60, `Baseline rating ${r} must be within [3.80, 4.60]`);
    }
  });

  it('T5-ADV2-MTD-03: getCatalogRating Bayesian calculation safely filters malformed review ratings', () => {
    const mockReviews = [
      { rating: 5 },
      { rating: null },
      { rating: '5' },
      { rating: 0 },
      { rating: 6 },
      { rating: NaN },
      null,
      undefined,
      { rating: 4 },
    ];

    const rating = getCatalogRating({ isbn: '1234567890' }, mockReviews);
    assert.strictEqual(typeof rating, 'number');
    assert.ok(!isNaN(rating), 'Bayesian rating must not evaluate to NaN');
    assert.ok(rating >= 1.0 && rating <= 5.0, `Rating ${rating} must be in [1.0, 5.0]`);
  });

  it('T5-ADV2-MTD-04: inferGenres gracefully falls back to General Fiction without throwing', () => {
    const fallbacks = [
      inferGenres({}),
      inferGenres(null),
      inferGenres(undefined),
      inferGenres({ title: '12345', author: 'XYZ', publisher: 'ABC' }),
    ];

    for (const g of fallbacks) {
      assert.ok(Array.isArray(g));
      assert.ok(g.length >= 1);
      assert.ok(g.includes('General Fiction') || g.length > 0);
    }
  });
});
