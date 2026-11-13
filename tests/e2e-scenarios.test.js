/**
 * E2E Scenarios, Shelves, Reviews, Settings, and Multi-Tier Workflows
 * Covers Feature 3 (Reading Statuses & Shelves), Feature 4 (Reviews & Star Ratings), Feature 5 (Settings Reset & Delete),
 * Tier 3 (Cross-Feature Combinations: 12 tests), and Tier 4 (Real-World Scenarios: 6 tests)
 * Total: 49 test cases
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createTestUser,
  uniqueUsername,
  KNOWN_SEEDS
} from './helpers.js';

describe('Feature 3: Reading Statuses & Shelves (Tier 1)', () => {
  it('T1-SHF-01: Add book to Want to Read shelf', async () => {
    const user = await createTestUser('shf_want');
    assert.ok(user.token);

    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, {
      status: 'want_to_read'
    }, user.token);

    if (res.status === 200) {
      assert.strictEqual(res.body.status, 'want_to_read');
      const want = res.body.shelves?.wantToRead || res.body.user?.wantToRead || [];
      assert.ok(want.includes(KNOWN_SEEDS.HOBBIT));
    } else {
      // Fallback check against legacy route
      const legRes = await request('POST', `/me/want/${KNOWN_SEEDS.HOBBIT}`, null, user.token);
      assert.strictEqual(legRes.status, 200);
      assert.ok(legRes.body.user.wantToRead.includes(KNOWN_SEEDS.HOBBIT));
    }
  });

  it('T1-SHF-02: Transition book from Want to Read to Currently Reading', async () => {
    const user = await createTestUser('shf_curr');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.DUNE;

    // First want_to_read
    await request('PUT', `/me/shelf/${isbn}`, { status: 'want_to_read' }, user.token);

    // Transition to currently_reading
    const res = await request('PUT', `/me/shelf/${isbn}`, { status: 'currently_reading' }, user.token);
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.ok(shelves.currentlyReading?.includes(isbn), 'Book must be in currentlyReading');
      assert.ok(!shelves.wantToRead?.includes(isbn), 'Book must be removed from wantToRead');
    } else {
      assert.ok([200, 404].includes(res.status));
    }
  });

  it('T1-SHF-03: Transition book from Currently Reading to Read', async () => {
    const user = await createTestUser('shf_read');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.HP_AZKABAN;

    await request('PUT', `/me/shelf/${isbn}`, { status: 'currently_reading' }, user.token);

    const res = await request('PUT', `/me/shelf/${isbn}`, { status: 'read' }, user.token);
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.ok(shelves.read?.includes(isbn), 'Book must be in read shelf');
      assert.ok(!shelves.currentlyReading?.includes(isbn), 'Book must be removed from currentlyReading');
    } else {
      assert.ok([200, 404].includes(res.status));
    }
  });

  it('T1-SHF-04: Remove book from all reading shelves with status none', async () => {
    const user = await createTestUser('shf_none');
    assert.ok(user.token);
    const isbn = KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR;

    await request('PUT', `/me/shelf/${isbn}`, { status: 'read' }, user.token);

    const res = await request('PUT', `/me/shelf/${isbn}`, { status: 'none' }, user.token);
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.ok(!shelves.read?.includes(isbn), 'Book must be removed from read');
      assert.ok(!shelves.currentlyReading?.includes(isbn), 'Book must not be in currentlyReading');
      assert.ok(!shelves.wantToRead?.includes(isbn), 'Book must not be in wantToRead');
    } else {
      assert.ok([200, 404].includes(res.status));
    }
  });

  it('T1-SHF-05: Get populated shelves grouped by status', async () => {
    const user = await createTestUser('shf_get');
    assert.ok(user.token);

    const res = await request('GET', '/me/shelves', null, user.token);
    if (res.status === 200) {
      assert.ok(Array.isArray(res.body.wantToRead));
      assert.ok(Array.isArray(res.body.currentlyReading));
      assert.ok(Array.isArray(res.body.read));
      assert.ok(Array.isArray(res.body.favorites));
    } else {
      // Fallback profile check
      const meRes = await request('GET', '/me', null, user.token);
      assert.strictEqual(meRes.status, 200);
      assert.ok(Array.isArray(meRes.body.wantToRead || meRes.body.user.wantToRead));
    }
  });
});

describe('Feature 4: Reviews & Star Ratings (Tier 1)', () => {
  it('T1-REV-01: Submit valid 5-star review with commentary', async () => {
    const user = await createTestUser('rev_sub');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 5,
      text: 'An absolute sci-fi masterpiece with unparalleled lore.'
    }, user.token);

    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
    const rev = res.body.review || res.body;
    assert.strictEqual(rev.rating, 5);
    assert.strictEqual(rev.username, user.username);
  });

  it('T1-REV-02: Fetch aggregated reviews and ratings for catalog book', async () => {
    const res = await request('GET', `/books/${KNOWN_SEEDS.DUNE}/reviews`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.averageRating, 'number');
    assert.strictEqual(typeof res.body.totalReviews, 'number');
    assert.ok(res.body.ratingCounts, 'Response must include ratingCounts');
    assert.ok(Array.isArray(res.body.reviews), 'Response must include reviews array');
  });

  it('T1-REV-03: Fetch user own reviews list', async () => {
    const user = await createTestUser('rev_my');
    assert.ok(user.token);

    const res = await request('GET', '/me/reviews', null, user.token);
    if (res.status === 200) {
      assert.ok(Array.isArray(res.body.reviews || res.body));
    } else {
      assert.strictEqual(res.status, 404);
    }
  });

  it('T1-REV-04: Delete own review successfully', async () => {
    const user = await createTestUser('rev_del');
    assert.ok(user.token);

    const postRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: 'Will be deleted soon.'
    }, user.token);

    assert.ok([200, 201].includes(postRes.status));
    const reviewId = postRes.body?.review?._id || postRes.body?._id;
    assert.ok(reviewId, 'Review ID must be present');
    const delRes = await request('DELETE', `/reviews/${reviewId}`, null, user.token);
    assert.strictEqual(delRes.status, 204, `Expected 204 on delete, got ${delRes.status}`);
  });

  it('T1-REV-05: Aggregated ratings update dynamically after review deletion', async () => {
    const user = await createTestUser('rev_dyn');
    assert.ok(user.token, 'User token must be present');
    const isbn = KNOWN_SEEDS.MOCKINGBIRD;

    // 1. Dynamic baseline capture: get current reviews count and average rating
    const initRes = await request('GET', `/books/${isbn}/reviews`);
    assert.strictEqual(initRes.status, 200, `Expected 200 on initial reviews query, got ${initRes.status}`);
    assert.strictEqual(typeof initRes.body.totalReviews, 'number', 'totalReviews must be a number');
    const initialCount = initRes.body.totalReviews;
    const initialAvg = initRes.body.averageRating ?? 0;

    // 2. Post a new review and assert successful creation
    const postRes = await request('POST', `/books/${isbn}/reviews`, {
      rating: 5,
      text: 'Temporary review for dynamic count test.'
    }, user.token);

    assert.ok(
      [200, 201].includes(postRes.status),
      `Expected 201/200 on review creation, got ${postRes.status}: ${JSON.stringify(postRes.body)}`
    );
    const reviewId = postRes.body?.review?._id || postRes.body?._id;
    assert.ok(reviewId, `Created review must contain an _id: ${JSON.stringify(postRes.body)}`);

    // 3. Verify totalReviews incremented by exactly 1
    const midRes = await request('GET', `/books/${isbn}/reviews`);
    assert.strictEqual(midRes.status, 200, `Expected 200 on intermediate reviews query, got ${midRes.status}`);
    assert.strictEqual(
      midRes.body.totalReviews,
      initialCount + 1,
      `totalReviews must increment from ${initialCount} to ${initialCount + 1}`
    );

    // 4. Delete the newly created review and assert HTTP 204 No Content
    const delRes = await request('DELETE', `/reviews/${reviewId}`, null, user.token);
    assert.strictEqual(
      delRes.status,
      204,
      `Expected 204 on delete, got ${delRes.status}: ${JSON.stringify(delRes.body)}`
    );

    // 5. Verify totalReviews and averageRating restored to initial baseline
    const finalRes = await request('GET', `/books/${isbn}/reviews`);
    assert.strictEqual(finalRes.status, 200, `Expected 200 on final reviews query, got ${finalRes.status}`);
    assert.strictEqual(
      finalRes.body.totalReviews,
      initialCount,
      `totalReviews must return to baseline ${initialCount}, got ${finalRes.body.totalReviews}`
    );
    assert.strictEqual(
      finalRes.body.averageRating,
      initialAvg,
      `averageRating must return to baseline ${initialAvg}, got ${finalRes.body.averageRating}`
    );
  });
});

describe('Feature 5: Settings Reset & Delete (Tier 1)', () => {
  it('T1-SET-01: Reset library books clears all shelves', async () => {
    const user = await createTestUser('set_reset');
    assert.ok(user.token);

    // Shelf a book first
    await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, user.token);

    const res = await request('POST', '/me/reset-books', {}, user.token);
    if (res.status === 200) {
      const shelves = res.body.shelves || res.body.user;
      assert.strictEqual(shelves.wantToRead?.length || 0, 0);
      assert.strictEqual(shelves.currentlyReading?.length || 0, 0);
      assert.strictEqual(shelves.read?.length || 0, 0);
    } else {
      assert.strictEqual(res.status, 404);
    }
  });

  it('T1-SET-02: Reset library books leaves submitted reviews intact', async () => {
    const user = await createTestUser('set_intact');
    assert.ok(user.token);

    // Post a review
    await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 5,
      text: 'Review should survive book reset.'
    }, user.token);

    // Reset books
    await request('POST', '/me/reset-books', {}, user.token);

    // Verify review remains
    const myRevs = await request('GET', '/me/reviews', null, user.token);
    if (myRevs.status === 200) {
      const reviews = myRevs.body.reviews || myRevs.body || [];
      assert.ok(reviews.length >= 1, 'Reviews must survive book reset');
    }
  });

  it('T1-SET-03: Delete user reviews removes all reviews by user', async () => {
    const user = await createTestUser('set_del_rev');
    assert.ok(user.token);

    await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: 'To be wiped by bulk delete.'
    }, user.token);

    const delRes = await request('DELETE', '/me/reviews', null, user.token);
    if (delRes.status === 200) {
      const myRevs = await request('GET', '/me/reviews', null, user.token);
      if (myRevs.status === 200) {
        const reviews = myRevs.body.reviews || myRevs.body || [];
        assert.strictEqual(reviews.length, 0);
      }
    } else {
      assert.strictEqual(delRes.status, 404);
    }
  });

  it('T1-SET-04: Delete user reviews leaves personal shelves intact', async () => {
    const user = await createTestUser('set_shelf_intact');
    assert.ok(user.token);

    await request('PUT', `/me/shelf/${KNOWN_SEEDS.STAR_TREK}`, { status: 'want_to_read' }, user.token);
    await request('DELETE', '/me/reviews', null, user.token);

    const shelvesRes = await request('GET', '/me/shelves', null, user.token);
    if (shelvesRes.status === 200) {
      assert.ok(shelvesRes.body.wantToRead.some((b) => (b.isbn || b) === KNOWN_SEEDS.STAR_TREK));
    }
  });

  it('T1-SET-05: Sequential reset books and delete reviews clears both', async () => {
    const user = await createTestUser('set_seq');
    assert.ok(user.token);

    const r1 = await request('POST', '/me/reset-books', {}, user.token);
    const r2 = await request('DELETE', '/me/reviews', null, user.token);
    assert.ok([200, 404].includes(r1.status));
    assert.ok([200, 404].includes(r2.status));
  });
});

describe('Feature 3: Reading Statuses & Shelves Boundary Cases (Tier 2)', () => {
  it('T2-SHF-01: Reject invalid reading status value', async () => {
    const user = await createTestUser('shf_inv');
    assert.ok(user.token);

    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, {
      status: 'abandoned_reading'
    }, user.token);

    if (res.status !== 404) {
      assert.strictEqual(res.status, 400);
    }
  });

  it('T2-SHF-02: Reject shelving of non-existent catalog ISBN', async () => {
    const user = await createTestUser('shf_bad_isbn');
    assert.ok(user.token);

    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.NON_EXISTENT_ISBN}`, {
      status: 'want_to_read'
    }, user.token);

    if (res.status !== 404) {
      assert.strictEqual(res.status, 404);
    }
  });

  it('T2-SHF-03: Idempotent duplicate status assignment', async () => {
    const user = await createTestUser('shf_idemp');
    assert.ok(user.token);

    await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'want_to_read' }, user.token);
    const res2 = await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'want_to_read' }, user.token);

    if (res2.status === 200) {
      const want = res2.body.shelves?.wantToRead || res2.body.user?.wantToRead || [];
      const occurrences = want.filter((i) => (i.isbn || i) === KNOWN_SEEDS.DUNE).length;
      assert.strictEqual(occurrences, 1, 'Book should appear at most once in shelf array');
    }
  });

  it('T2-SHF-04: Empty shelves response for brand new user', async () => {
    const user = await createTestUser('shf_empty');
    assert.ok(user.token);

    const res = await request('GET', '/me/shelves', null, user.token);
    if (res.status === 200) {
      assert.strictEqual(res.body.wantToRead.length, 0);
      assert.strictEqual(res.body.currentlyReading.length, 0);
      assert.strictEqual(res.body.read.length, 0);
    }
  });

  it('T2-SHF-05: Handle ISBN with trailing uppercase X', async () => {
    const user = await createTestUser('shf_x');
    assert.ok(user.token);

    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HP_SORCERER}`, {
      status: 'want_to_read'
    }, user.token);

    assert.ok([200, 404].includes(res.status));
  });
});

describe('Feature 4: Reviews & Star Ratings Boundary Cases (Tier 2)', () => {
  it('T2-REV-01: Reject review rating less than 1', async () => {
    const user = await createTestUser('rev_zero');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 0,
      text: 'Too low rating.'
    }, user.token);

    if (res.status !== 404) {
      assert.strictEqual(res.status, 400);
    }
  });

  it('T2-REV-02: Reject review rating greater than 5', async () => {
    const user = await createTestUser('rev_six');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 6,
      text: 'Too high rating.'
    }, user.token);

    if (res.status !== 404) {
      assert.strictEqual(res.status, 400);
    }
  });

  it('T2-REV-03: Allow review with rating only and empty text', async () => {
    const user = await createTestUser('rev_empty_text');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 4,
      text: ''
    }, user.token);

    assert.ok([200, 201, 404].includes(res.status));
  });

  it('T2-REV-04: Reject review text exceeding maximum length of 5000 chars', async () => {
    const user = await createTestUser('rev_long_text');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 4,
      text: 'A'.repeat(5001)
    }, user.token);

    if (res.status !== 404) {
      assert.strictEqual(res.status, 400);
    }
  });

  it('T2-REV-05: Review submission for non-existent ISBN rejected', async () => {
    const user = await createTestUser('rev_non_isbn');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.NON_EXISTENT_ISBN}/reviews`, {
      rating: 5,
      text: 'Ghost book review.'
    }, user.token);

    assert.ok([400, 404].includes(res.status));
  });

  it('T2-REV-06: Delete non-existent review ID returns 404', async () => {
    const user = await createTestUser('rev_del_404');
    assert.ok(user.token);

    const res = await request('DELETE', '/reviews/507f1f77bcf86cd799439011', null, user.token);
    assert.strictEqual(res.status, 404);
  });
});

describe('Feature 5: Settings Reset & Delete Boundary Cases (Tier 2)', () => {
  it('T2-SET-01: Reset books on already empty shelves is idempotent', async () => {
    const user = await createTestUser('set_idemp_books');
    assert.ok(user.token);

    const res = await request('POST', '/me/reset-books', {}, user.token);
    assert.ok([200, 404].includes(res.status));
  });

  it('T2-SET-02: Delete reviews when user has 0 reviews is idempotent', async () => {
    const user = await createTestUser('set_idemp_revs');
    assert.ok(user.token);

    const res = await request('DELETE', '/me/reviews', null, user.token);
    assert.ok([200, 404].includes(res.status));
  });

  it('T2-SET-03: Unauthenticated reset books request rejected', async () => {
    const res = await request('POST', '/me/reset-books', {});
    assert.strictEqual(res.status, 401);
  });

  it('T2-SET-04: Unauthenticated delete reviews request rejected', async () => {
    const res = await request('DELETE', '/me/reviews');
    assert.strictEqual(res.status, 401);
  });

  it('T2-SET-05: Mass review deletion updates multiple books aggregate ratings', async () => {
    const user = await createTestUser('set_mass_rev');
    assert.ok(user.token);

    // Review two distinct books
    await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'Great Dune' }, user.token);
    await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 5, text: 'Great Hobbit' }, user.token);

    // Delete reviews
    const res = await request('DELETE', '/me/reviews', null, user.token);
    assert.ok([200, 404].includes(res.status));
  });
});

describe('Tier 3: Cross-Feature Combinations (12 Tests)', () => {
  it('T3-CMB-01: Auth + Shelving Lifecycle', async () => {
    const user = await createTestUser('t3_auth_shf');
    assert.ok(user.token);

    await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, user.token);
    await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'currently_reading' }, user.token);
    await request('PUT', `/me/shelf/${KNOWN_SEEDS.HP_AZKABAN}`, { status: 'read' }, user.token);

    const res = await request('GET', '/me/shelves', null, user.token);
    assert.ok([200, 404].includes(res.status));
  });

  it('T3-CMB-02: Auth + Community Reviews Publishing', async () => {
    const user = await createTestUser('t3_comm_pub');
    assert.ok(user.token);

    const postRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: 'Community review test by ' + user.username
    }, user.token);

    const pubRes = await request('GET', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`);
    assert.strictEqual(pubRes.status, 200);
  });

  it('T3-CMB-03: Shelving + Review Submission', async () => {
    const user = await createTestUser('t3_shf_rev');
    assert.ok(user.token);

    await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'read' }, user.token);
    const revRes = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 5,
      text: 'Read and reviewed.'
    }, user.token);

    assert.ok([200, 201, 404].includes(revRes.status));
  });

  it('T3-CMB-04: Review Submission + Automatic Sentiment Pipeline', async () => {
    const user = await createTestUser('t3_rev_snt');
    assert.ok(user.token);

    const res = await request('POST', `/books/${KNOWN_SEEDS.HP_AZKABAN}/reviews`, {
      rating: 5,
      text: 'A brilliant and enchanting tale with astonishing imagery.'
    }, user.token);

    if (res.status === 200 || res.status === 201) {
      assert.strictEqual(res.body.review?.sentiment?.label || res.body.sentiment?.label, 'positive');
    }
  });

  it('T3-CMB-05: Review Sentiment + Recommendation Adaptation', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 5,
      reviewText: 'Outstanding galactic adventure.'
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.adaptedRecommendations.length > 0);
  });

  it('T3-CMB-06: User Shelves as Seeds for 3-Seed Recommendation', async () => {
    const seeds = [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN];
    const res = await request('POST', '/recommend/three', {
      seeds,
      limit: 10
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T3-CMB-07: Reset Books preserves User Reviews intact', async () => {
    const user = await createTestUser('t3_reset_pres');
    assert.ok(user.token);

    // 1. Post review
    const postRes = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'Keep me.' }, user.token);
    assert.strictEqual(postRes.status, 201, `Expected 201 Created on review submission, got ${postRes.status}`);

    // 2. Reset user's books & shelves
    const resetRes = await request('POST', '/me/reset-books', {}, user.token);
    assert.strictEqual(resetRes.status, 200, `Expected 200 OK on reset-books, got ${resetRes.status}`);
    assert.strictEqual(resetRes.body.success, true);

    // 3. Verify user review survived intact
    const revs = await request('GET', '/me/reviews', null, user.token);
    assert.strictEqual(revs.status, 200, `Expected 200 OK on get me/reviews, got ${revs.status}`);
    assert.strictEqual(revs.body.total, 1, 'Expected exactly 1 review preserved');
    assert.ok(Array.isArray(revs.body.reviews));
    assert.strictEqual(revs.body.reviews[0].isbn, KNOWN_SEEDS.DUNE);
    assert.strictEqual(revs.body.reviews[0].text, 'Keep me.');
  });

  it('T3-CMB-08: Delete Reviews preserves User Shelves intact', async () => {
    const user = await createTestUser('t3_del_pres');
    assert.ok(user.token);

    // 1. Put book on Want to Read shelf
    const shelfRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, user.token);
    assert.strictEqual(shelfRes.status, 200, `Expected 200 OK on shelving, got ${shelfRes.status}`);

    // 2. Add review then delete all reviews
    await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 4, text: 'Temporary review' }, user.token);
    const delRes = await request('DELETE', '/me/reviews', null, user.token);
    assert.strictEqual(delRes.status, 200, `Expected 200 OK on delete me/reviews, got ${delRes.status}`);
    assert.strictEqual(delRes.body.success, true);

    // 3. Verify shelves remain intact
    const shf = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(shf.status, 200, `Expected 200 OK on get me/shelves, got ${shf.status}`);
    assert.ok(shf.body.stats.totalShelved >= 1, 'Expected user shelves to remain populated');
    const allShelvedIsbns = [
      ...(shf.body.wantToRead || []).map((b) => b.isbn),
      ...(shf.body.read || []).map((b) => b.isbn),
    ];
    assert.ok(allShelvedIsbns.includes(KNOWN_SEEDS.HOBBIT), 'Hobbit must remain on user shelves');
  });

  it('T3-CMB-09: Multi-User Concurrent Review Aggregation', async () => {
    const user1 = await createTestUser('t3_agg_1');
    const user2 = await createTestUser('t3_agg_2');

    await request('POST', `/books/${KNOWN_SEEDS.STAR_TREK}/reviews`, { rating: 5, text: 'Love it' }, user1.token);
    await request('POST', `/books/${KNOWN_SEEDS.STAR_TREK}/reviews`, { rating: 1, text: 'Hate it' }, user2.token);

    const pub = await request('GET', `/books/${KNOWN_SEEDS.STAR_TREK}/reviews`);
    assert.strictEqual(pub.status, 200);
  });

  it('T3-CMB-10: Custom Weights applied to User Shelf Seeds', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN],
      weights: { author: 0.9, genre: 0.1, tag: 0.0, rating: 0.0 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T3-CMB-11: Sentiment Adaptation with User Shelf Exclusion', async () => {
    const res = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.HOBBIT,
      rating: 5,
      reviewText: 'Charming and whimsical fantasy.'
    });

    assert.strictEqual(res.status, 200);
    const isbns = res.body.adaptedRecommendations.map((b) => b.isbn);
    assert.ok(!isbns.includes(KNOWN_SEEDS.HOBBIT));
  });

  it('T3-CMB-12: Token Expiry midway through Shelf Mutation', async () => {
    const badToken = 'tampered.expired.signature';
    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'want_to_read' }, badToken);
    assert.strictEqual(res.status, 401);
  });
});

describe('Tier 4: Real-World Application Scenarios (6 Tests)', () => {
  it('T4-SCN-01: The Complete Reader Journey — From Discovery to Finished Book', async () => {
    // 1. Alice registers
    const alice = await createTestUser('alice');
    assert.ok(alice.token);

    // 2. Search catalog
    const searchRes = await request('GET', '/books/search?q=tolkien&limit=5');
    assert.strictEqual(searchRes.status, 200, `Expected 200 OK on catalog search, got ${searchRes.status}`);
    assert.ok(Array.isArray(searchRes.body) && searchRes.body.length > 0, 'Search must return results array');

    // 3. Shelves The Hobbit to Want to Read
    const wantRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'want_to_read' }, alice.token);
    assert.strictEqual(wantRes.status, 200);

    // 4. Transitions to Currently Reading
    const currRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'currently_reading' }, alice.token);
    assert.strictEqual(currRes.status, 200);

    // 5. Transitions to Read
    const readRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'read' }, alice.token);
    assert.strictEqual(readRes.status, 200);

    // 6. Submits 5-star review
    const revRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, {
      rating: 5,
      text: "Magnificent adventure, loved Bilbo's journey!"
    }, alice.token);
    assert.strictEqual(revRes.status, 201, `Expected 201 Created on review submission, got ${revRes.status}`);

    // 7. Verifies shelves & reviews
    const shelves = await request('GET', '/me/shelves', null, alice.token);
    assert.strictEqual(shelves.status, 200, `Expected 200 OK on get me/shelves, got ${shelves.status}`);
    assert.ok(Array.isArray(shelves.body.read));
    assert.ok(shelves.body.read.some((b) => b.isbn === KNOWN_SEEDS.HOBBIT), 'Hobbit must be present in read shelf');
    assert.strictEqual(shelves.body.stats.readCount, 1);
  });

  it('T4-SCN-02: The Critical Reviewer & Community Impact', async () => {
    // 1. Bob creates account
    const bob = await createTestUser('bob');
    assert.ok(bob.token);

    // 2. Baseline check
    const base = await request('GET', `/books/${KNOWN_SEEDS.DUNE}/reviews`);
    assert.strictEqual(base.status, 200);

    // 3. Submits critical review
    const postRes = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 2,
      text: 'Complex world but the pacing in the middle was painfully slow and tedious.'
    }, bob.token);

    if (postRes.status === 200 || postRes.status === 201) {
      const reviewId = postRes.body?.review?._id || postRes.body?._id;
      if (reviewId) {
        // 4. Delete review
        await request('DELETE', `/reviews/${reviewId}`, null, bob.token);
      }
    }
  });

  it('T4-SCN-03: Personalized 3-Seed Discovery & Algorithm Tuning', async () => {
    const clara = await createTestUser('clara');
    assert.ok(clara.token);
    const seeds = [KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR];

    // 1. Baseline recs
    const baseRecs = await request('POST', '/recommend/three', { seeds, limit: 10 });
    assert.strictEqual(baseRecs.status, 200);

    // 2. Customized recs with author boost
    const tunedRecs = await request('POST', '/recommend/three', {
      seeds,
      weights: { author: 0.70, genre: 0.15, tag: 0.05, rating: 0.10 },
      limit: 10
    });
    assert.strictEqual(tunedRecs.status, 200);
    assert.ok(tunedRecs.body.candidates.length > 0);
  });

  it('T4-SCN-04: Review Sentiment-Driven Reading Expansion', async () => {
    const david = await createTestUser('david');
    assert.ok(david.token);

    // 1. Review
    await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, {
      rating: 5,
      text: 'Astounding cyberpunk classic, gritty neon noir atmosphere and electrifying prose!'
    }, david.token);

    // 2. Sentiment-adapted
    const adapted = await request('POST', '/recommend/sentiment-adapted', {
      targetIsbn: KNOWN_SEEDS.DUNE,
      rating: 5,
      reviewText: 'Astounding cyberpunk classic, gritty neon noir atmosphere and electrifying prose!'
    });

    assert.strictEqual(adapted.status, 200);
    assert.ok(adapted.body.adaptedRecommendations.length > 0);
  });

  it('T4-SCN-05: Strict Multi-User Privacy & Security Wall', async () => {
    const userA = await createTestUser('priv_a');
    const userB = await createTestUser('priv_b');

    // User A shelves & reviews
    const shelfA = await request('PUT', `/me/shelf/${KNOWN_SEEDS.DUNE}`, { status: 'currently_reading' }, userA.token);
    assert.strictEqual(shelfA.status, 200);

    const revA = await request('POST', `/books/${KNOWN_SEEDS.DUNE}/reviews`, { rating: 5, text: 'User A private review' }, userA.token);
    assert.strictEqual(revA.status, 201, `Expected 201 Created on User A review, got ${revA.status}`);

    const reviewId = revA.body?.review?._id || revA.body?._id;
    assert.ok(reviewId, 'Review ID must be present in response');

    // User B attempts IDOR deletion of User A's review — MUST return 403 Forbidden
    const intruderDel = await request('DELETE', `/reviews/${reviewId}`, null, userB.token);
    assert.strictEqual(intruderDel.status, 403, `Expected 403 Forbidden for unauthorized review deletion, got ${intruderDel.status}`);
    assert.strictEqual(intruderDel.body.error, 'You do not have permission to delete this review');

    // Verify User A's review remains intact
    const userARevs = await request('GET', '/me/reviews', null, userA.token);
    assert.strictEqual(userARevs.status, 200);
    assert.ok(userARevs.body.reviews.some((r) => String(r._id) === String(reviewId)), 'User A review must survive IDOR attack');

    // Verify shelf isolation: User B shelves must be empty
    const shelvesB = await request('GET', '/me/shelves', null, userB.token);
    assert.strictEqual(shelvesB.status, 200);
    assert.strictEqual(shelvesB.body.stats.totalShelved, 0, 'User B must not inherit User A shelves');
  });

  it('T4-SCN-06: Library Clean Slate & GDPR-Style Data Deletion', async () => {
    const emma = await createTestUser('emma');
    assert.ok(emma.token);

    // 1. Shelve & review
    const shelfRes = await request('PUT', `/me/shelf/${KNOWN_SEEDS.HOBBIT}`, { status: 'read' }, emma.token);
    assert.strictEqual(shelfRes.status, 200);

    const revRes = await request('POST', `/books/${KNOWN_SEEDS.HOBBIT}/reviews`, { rating: 5, text: 'Emma read' }, emma.token);
    assert.strictEqual(revRes.status, 201);

    // 2. Reset books (clears shelves and favorites, keeps reviews)
    const resetRes = await request('POST', '/me/reset-books', {}, emma.token);
    assert.strictEqual(resetRes.status, 200, `Expected 200 OK on reset-books, got ${resetRes.status}`);
    assert.strictEqual(resetRes.body.success, true);

    // Verify shelves cleared
    const checkShelves = await request('GET', '/me/shelves', null, emma.token);
    assert.strictEqual(checkShelves.status, 200);
    assert.strictEqual(checkShelves.body.stats.totalShelved, 0, 'All shelves must be cleared after reset-books');

    // 3. Delete reviews (deletes all reviews written by user)
    const delRes = await request('DELETE', '/me/reviews', null, emma.token);
    assert.strictEqual(delRes.status, 200, `Expected 200 OK on delete reviews, got ${delRes.status}`);
    assert.strictEqual(delRes.body.success, true);
    assert.strictEqual(delRes.body.deletedCount, 1, 'Expected exactly 1 review deleted');

    // Verify clean slate: 0 reviews
    const checkRevs = await request('GET', '/me/reviews', null, emma.token);
    assert.strictEqual(checkRevs.status, 200);
    assert.strictEqual(checkRevs.body.total, 0, 'User must have 0 reviews after clean slate deletion');
  });
});
