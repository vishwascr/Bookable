/**
 * Local Review Sentiment Analysis & Sentiment-Adapted Recommendations E2E Tests
 * Covers Feature 8 (Review Sentiment Analysis) and Feature 9 (Sentiment-Adapted Recommendations)
 * Tiers 1 & 2: 20 test cases total
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { request, createTestUser, KNOWN_SEEDS } from './helpers.js';

describe('Feature 8: Review Sentiment Analysis (Tier 1)', () => {
  it('T1-SNT-01: Strongly positive review produces positive score and label', async () => {
    const user = await createTestUser('snt_pos');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 5,
      text: 'A breathtaking masterpiece, extraordinary world-building and unforgettable characters!'
    }, user.token);

    assert.ok([200, 201].includes(res.status), `Expected 201/200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment, 'Review response must include sentiment object');
    assert.strictEqual(sentiment.label, 'positive');
    assert.ok(sentiment.score > 0.3, `Positive score should be > 0.3, got ${sentiment.score}`);
    assert.ok(Array.isArray(sentiment.keywords), 'Keywords must be an array');
  });

  it('T1-SNT-02: Strongly negative review produces negative score and label', async () => {
    const user = await createTestUser('snt_neg');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DA_VINCI}/reviews`, {
      rating: 1,
      text: 'Terrible, boring, poorly written disaster of a book. Complete waste of time.'
    }, user.token);

    assert.ok([200, 201].includes(res.status), `Expected 201/200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment, 'Review response must include sentiment object');
    assert.strictEqual(sentiment.label, 'negative');
    assert.ok(sentiment.score < -0.3, `Negative score should be < -0.3, got ${sentiment.score}`);
  });

  it('T1-SNT-03: Balanced neutral review produces neutral label', async () => {
    const user = await createTestUser('snt_neu');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.MOCKINGBIRD}/reviews`, {
      rating: 3,
      text: 'A standard read with some decent sections and average pacing throughout.'
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.strictEqual(sentiment.label, 'neutral');
    assert.ok(sentiment.score >= -0.3 && sentiment.score <= 0.3);

    // Clean up posted review so reviews do not accumulate across runs
    const reviewId = res.body?.review?._id || res.body?._id;
    assert.ok(reviewId, 'Review must have an _id');
    const delRes = await request('DELETE', `/reviews/${reviewId}`, null, user.token);
    assert.strictEqual(delRes.status, 204, `Expected 204 on delete, got ${delRes.status}`);
  });

  it('T1-SNT-04: Sentiment payload persisted in Review database record', async () => {
    const user = await createTestUser('snt_persist');
    assert.ok(user.token);

    const postRes = await request('POST', `/books/${KNOWN_SEEDS.HP_AZKABAN}/reviews`, {
      rating: 5,
      text: 'Superb magical atmosphere and thrilling adventure.'
    }, user.token);
    assert.ok([200, 201].includes(postRes.status));

    // Verify sentiment is present when fetching public reviews
    const getRes = await request('GET', `/books/${KNOWN_SEEDS.HP_AZKABAN}/reviews`);
    assert.strictEqual(getRes.status, 200);
    const revs = getRes.body?.reviews || [];
    const myRev = revs.find((r) => r.username === user.username);
    assert.ok(myRev, 'Submitted review must be found in public reviews list');
    assert.ok(myRev.sentiment, 'Persisted review must have sentiment object');
    assert.strictEqual(typeof myRev.sentiment.score, 'number');
    assert.strictEqual(typeof myRev.sentiment.label, 'string');
  });

  it('T1-SNT-05: Keyword extraction filters out common English stopwords', async () => {
    const user = await createTestUser('snt_stop');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR}/reviews`, {
      rating: 4,
      text: 'The book was quite fascinating and brilliant in the middle of it.'
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    const keywords = (sentiment.keywords || []).map((k) => k.toLowerCase());
    const stopwords = ['the', 'was', 'and', 'in', 'of', 'it'];
    for (const sw of stopwords) {
      assert.ok(!keywords.includes(sw), `Stopword "${sw}" must not appear in extracted keywords`);
    }
  });
});

describe('Feature 9: Sentiment-Adapted Recommendations (Tier 1)', () => {
  it('T1-ADP-01: Positive review yields adapted recommendations aligned with themes', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 5,
      reviewText: 'Magnificent epic space opera with complex political intrigue.'
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.sentiment?.label, 'positive');
    assert.ok(Array.isArray(res.body.adaptedRecommendations), 'Must return adaptedRecommendations array');
    assert.ok(res.body.adaptedRecommendations.length > 0, 'Should return recommendations');
  });

  it('T1-ADP-02: Negative review steers recommendations away from disliked aspects', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 1,
      reviewText: 'Too dense, dry, and slow-paced philosophy with no action.'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment?.label, 'negative');
    assert.ok(Array.isArray(res.body.adaptedRecommendations));
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });

  it('T1-ADP-03: Sentiment-adapted response conforms to contract schema', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HOBBIT,
      rating: 5,
      reviewText: 'A delightful magical journey filled with charming characters.'
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.sentiment, 'Response must have sentiment object');
    assert.strictEqual(typeof res.body.sentiment.score, 'number');
    assert.strictEqual(typeof res.body.sentiment.label, 'string');
    assert.ok(Array.isArray(res.body.sentiment.keywords));
    assert.ok(Array.isArray(res.body.adaptedRecommendations));
  });

  it('T1-ADP-04: Target ISBN is excluded from adapted recommendations', async () => {
    const target = KNOWN_SEEDS.DUNE;
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: target,
      rating: 5,
      reviewText: 'Masterpiece of science fiction.'
    });

    assert.strictEqual(res.status, 200);
    const recIsbns = res.body.adaptedRecommendations.map((b) => b.isbn);
    assert.ok(!recIsbns.includes(target), 'Target ISBN must be excluded from adapted recommendations');
  });

  it('T1-ADP-05: Neutral review generates balanced baseline recommendations', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.MOCKINGBIRD,
      rating: 3,
      reviewText: 'Decent average story.'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment?.label, 'neutral');
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });
});

describe('Feature 8: Review Sentiment Analysis Boundary Cases (Tier 2)', () => {
  it('T2-SNT-01: Review with empty or whitespace-only text scores neutral', async () => {
    const user = await createTestUser('snt_empty');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 3,
      text: '      '
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.strictEqual(sentiment.label, 'neutral');
  });

  it('T2-SNT-02: Contradictory star rating and text safely handled', async () => {
    const user = await createTestUser('snt_contra');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: 'Horrible and disappointing.'
    }, user.token);

    assert.ok([200, 201].includes(res.status), `Server must handle contradictory text without crashing, got ${res.status}`);
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.strictEqual(typeof sentiment.score, 'number');
  });

  it('T2-SNT-03: Correct negation phrase handling', async () => {
    const user = await createTestUser('snt_negation');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.CATCHER}/reviews`, {
      rating: 2,
      text: 'Not good, not exciting, and definitely not recommended.'
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.strictEqual(sentiment.label, 'negative', 'Negation phrase must flip positive words to negative');
    assert.ok(sentiment.score < 0);
  });

  it('T2-SNT-04: Repeated intensifiers and capitalization do not exceed score bounds', async () => {
    const user = await createTestUser('snt_bounds');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.HP_AZKABAN}/reviews`, {
      rating: 5,
      text: 'AMAZING AMAZING INCREDIBLE WONDERFUL MASTERPIECE!!!!'
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.ok(sentiment.score >= -1.0 && sentiment.score <= 1.0, `Score ${sentiment.score} must be clamped to [-1.0, 1.0]`);
  });

  it('T2-SNT-05: Text with emojis and unicode characters parsed without crashing', async () => {
    const user = await createTestUser('snt_unicode');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.STAR_TREK}/reviews`, {
      rating: 5,
      text: 'Loved it! ❤️ 📚 🌟 🚀 Highly recommended! 👏'
    }, user.token);

    assert.ok([200, 201].includes(res.status));
    const sentiment = res.body?.review?.sentiment || res.body?.sentiment;
    assert.ok(sentiment);
    assert.strictEqual(typeof sentiment.score, 'number');
  });
});

describe('Feature 9: Sentiment-Adapted Recommendations Boundary Cases (Tier 2)', () => {
  it('T2-ADP-01: Fallback to star rating when review text is absent', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 5
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sentiment?.label, 'positive', '5-star rating without text should infer positive sentiment');
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });

  it('T2-ADP-02: Reject sentiment adaptation for non-existent target ISBN', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.NON_EXISTENT_ISBN,
      rating: 4,
      reviewText: 'Great book'
    });

    assert.ok([400, 404].includes(res.status), `Expected 400 or 404 for non-existent ISBN, got ${res.status}`);
  });

  it('T2-ADP-03: Extremely negative review still returns non-empty candidate list', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 1,
      reviewText: 'Vile repulsive garbage.'
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.adaptedRecommendations));
    assert.ok(res.body.adaptedRecommendations.length > 0, 'Must provide graceful fallback candidates');
  });

  it('T2-ADP-04: Adapted recommendations list contains no duplicate ISBNs', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HOBBIT,
      rating: 5,
      reviewText: 'Masterpiece of high fantasy.'
    });

    assert.strictEqual(res.status, 200);
    const isbns = res.body.adaptedRecommendations.map((b) => b.isbn);
    const unique = new Set(isbns);
    assert.strictEqual(unique.size, isbns.length, 'Every recommendation in the list must have a unique ISBN');
  });

  it('T2-ADP-05: Reject invalid rating parameter in sentiment-adapted payload', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 7, // Out of bounds
      reviewText: 'Super'
    });

    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for rating 7, got ${res.status}`);
  });
});
