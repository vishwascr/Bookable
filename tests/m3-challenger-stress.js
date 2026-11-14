/**
 * Milestone 3 Empirical Challenger Stress Test Suite
 * 
 * Adversarial verification targeting:
 * 1. Reading Status Transitions & Mutual Exclusivity Invariants
 * 2. Review Lifecycle, Auto-Shelving to Read, Review Deletion & Dynamic Recalculation
 * 3. Settings Actions (Reset Books preserving Reviews, Delete Reviews preserving Shelves)
 * 4. Concurrent / Race Condition Stress & Extreme Boundary Fuzzing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_BASE,
  KNOWN_SEEDS,
  createTestUser,
  request,
  uniqueUsername,
} from './helpers.js';

test('Milestone 3 Challenger: Reading Status Mutual Exclusivity Invariants', async (t) => {
  const user = await createTestUser('chall_shelf');
  assert.ok(user.token, 'Test user creation must succeed');

  const isbnA = KNOWN_SEEDS.HOBBIT;
  const isbnB = KNOWN_SEEDS.DUNE;
  const isbnC = KNOWN_SEEDS.HP_AZKABAN;

  await t.test('INV-01: Rapid state cycling maintains strict mutual exclusivity', async () => {
    const transitions = [
      'want_to_read',
      'currently_reading',
      'read',
      'want_to_read',
      'read',
      'currently_reading',
      'none',
      'read',
    ];

    for (const status of transitions) {
      const res = await request('PUT', `/me/shelf/${isbnA}`, { status }, user.token);
      assert.strictEqual(res.status, 200, `Shelf transition to ${status} should return 200`);
      assert.strictEqual(res.body.status, status);

      // Verify mutual exclusivity in response shelves
      const { wantToRead, currentlyReading, read } = res.body.shelves;
      const inWant = wantToRead.includes(isbnA);
      const inCurrent = currentlyReading.includes(isbnA);
      const inRead = read.includes(isbnA);

      if (status === 'want_to_read') {
        assert.ok(inWant, 'Must be in wantToRead');
        assert.ok(!inCurrent, 'Must NOT be in currentlyReading');
        assert.ok(!inRead, 'Must NOT be in read');
      } else if (status === 'currently_reading') {
        assert.ok(!inWant, 'Must NOT be in wantToRead');
        assert.ok(inCurrent, 'Must be in currentlyReading');
        assert.ok(!inRead, 'Must NOT be in read');
      } else if (status === 'read') {
        assert.ok(!inWant, 'Must NOT be in wantToRead');
        assert.ok(!inCurrent, 'Must NOT be in currentlyReading');
        assert.ok(inRead, 'Must be in read');
      } else if (status === 'none') {
        assert.ok(!inWant, 'Must NOT be in wantToRead');
        assert.ok(!inCurrent, 'Must NOT be in currentlyReading');
        assert.ok(!inRead, 'Must NOT be in read');
      }

      // Mutual exclusivity invariant: sum of memberships must be <= 1
      const count = (inWant ? 1 : 0) + (inCurrent ? 1 : 0) + (inRead ? 1 : 0);
      assert.ok(count <= 1, `Invariant violated: ISBN appears in ${count} shelves simultaneously`);
    }

    // Double check with GET /api/me/shelves
    const shelvesRes = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(shelvesRes.status, 200);
    const readIsbns = shelvesRes.body.read.map((b) => b.isbn);
    const wantIsbns = shelvesRes.body.wantToRead.map((b) => b.isbn);
    const currIsbns = shelvesRes.body.currentlyReading.map((b) => b.isbn);

    assert.ok(readIsbns.includes(isbnA), 'Final state must be read in GET /me/shelves');
    assert.ok(!wantIsbns.includes(isbnA), 'Final state must not be in wantToRead in GET /me/shelves');
    assert.ok(!currIsbns.includes(isbnA), 'Final state must not be in currentlyReading in GET /me/shelves');
  });

  await t.test('INV-02: Simultaneous multi-book independent shelving', async () => {
    // Put A in want_to_read, B in currently_reading, C in read
    await request('PUT', `/me/shelf/${isbnA}`, { status: 'want_to_read' }, user.token);
    await request('PUT', `/me/shelf/${isbnB}`, { status: 'currently_reading' }, user.token);
    await request('PUT', `/me/shelf/${isbnC}`, { status: 'read' }, user.token);

    const res = await request('GET', '/me/shelves', null, user.token);
    assert.strictEqual(res.status, 200);

    const want = res.body.wantToRead.map((b) => b.isbn);
    const curr = res.body.currentlyReading.map((b) => b.isbn);
    const read = res.body.read.map((b) => b.isbn);

    assert.ok(want.includes(isbnA));
    assert.ok(curr.includes(isbnB));
    assert.ok(read.includes(isbnC));

    // Assert intersection across all 3 sets is completely empty
    const allShelved = [...want, ...curr, ...read];
    const uniqueShelved = new Set(allShelved);
    assert.strictEqual(allShelved.length, uniqueShelved.size, 'No book may appear across multiple shelves');
  });

  await t.test('INV-03: Adversarial status payload validation', async () => {
    const invalidStatuses = [
      'WANT_TO_READ',
      'currently-reading',
      'finished',
      '',
      null,
      123,
      true,
      {},
      [],
      'none; DROP TABLE books',
    ];

    for (const bad of invalidStatuses) {
      const res = await request('PUT', `/me/shelf/${isbnA}`, { status: bad }, user.token);
      assert.strictEqual(res.status, 400, `Expected 400 for status "${bad}", got ${res.status}`);
      assert.ok(res.body.error, 'Error message expected');
    }
  });

  await t.test('INV-04: Non-existent ISBN rejection', async () => {
    const res = await request('PUT', `/me/shelf/${KNOWN_SEEDS.NON_EXISTENT_ISBN}`, { status: 'want_to_read' }, user.token);
    assert.strictEqual(res.status, 404, 'Shelving non-existent ISBN must return 404');
  });
});

test('Milestone 3 Challenger: Review Lifecycle & Rating Recalculation', async (t) => {
  const userA = await createTestUser('rev_user_a');
  const userB = await createTestUser('rev_user_b');
  const userC = await createTestUser('rev_user_c');

  const targetIsbn = '0151008116'; // Clean catalog book with 0 reviews initially

  await t.test('INV-05: Review submission auto-shelves to read and pulls from other shelves', async () => {
    // First, userA puts targetIsbn on want_to_read
    const shelfRes1 = await request('PUT', `/me/shelf/${targetIsbn}`, { status: 'want_to_read' }, userA.token);
    assert.strictEqual(shelfRes1.status, 200);
    assert.ok(shelfRes1.body.shelves.wantToRead.includes(targetIsbn));

    // Now userA submits a review
    const revRes = await request(
      'POST',
      `/books/${targetIsbn}/reviews`,
      { rating: 5, text: 'An absolute masterpiece of American literature!' },
      userA.token
    );
    assert.strictEqual(revRes.status, 201, 'Review creation should return 201');
    assert.ok(revRes.body.shelves, 'Response should include updated shelves');

    // Auto-shelving invariant verification
    const { wantToRead, currentlyReading, read } = revRes.body.shelves;
    assert.ok(read.includes(targetIsbn), 'Target book MUST be auto-shelved to read');
    assert.ok(!wantToRead.includes(targetIsbn), 'Target book MUST be removed from wantToRead');
    assert.ok(!currentlyReading.includes(targetIsbn), 'Target book MUST not be in currentlyReading');

    // Confirm with GET /me
    const meRes = await request('GET', '/me', null, userA.token);
    const readList = meRes.body.read.map((b) => b.isbn);
    const wantList = meRes.body.wantToRead.map((b) => b.isbn);
    assert.ok(readList.includes(targetIsbn), 'GET /me must show book in read');
    assert.ok(!wantList.includes(targetIsbn), 'GET /me must not show book in wantToRead');
  });

  await t.test('INV-06: Deleting review PRESERVES read shelf status', async () => {
    // UserA gets their review
    const myRevs = await request('GET', '/me/reviews', null, userA.token);
    assert.strictEqual(myRevs.status, 200);
    const userARev = myRevs.body.reviews.find((r) => r.isbn === targetIsbn);
    assert.ok(userARev, 'User review must exist');

    // UserA deletes their review
    const delRes = await request('DELETE', `/reviews/${userARev._id}`, null, userA.token);
    assert.strictEqual(delRes.status, 204, 'Review deletion must return 204');

    // INVARIANT CHECK: Target book MUST still be in read shelf!
    const meRes = await request('GET', '/me', null, userA.token);
    const readList = meRes.body.read.map((b) => b.isbn);
    assert.ok(readList.includes(targetIsbn), 'Deleting a review MUST preserve the read shelf status!');
  });

  await t.test('INV-07: Dynamic mathematical recalculation of aggregate ratings', async () => {
    // Step 1: User A posts rating 5
    const rA = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 5, text: '5 stars' }, userA.token);
    assert.strictEqual(rA.status, 201);

    // Step 2: User B posts rating 3
    const rB = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 3, text: '3 stars' }, userB.token);
    assert.strictEqual(rB.status, 201);

    // Step 3: User C posts rating 1
    const rC = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 1, text: '1 star' }, userC.token);
    assert.strictEqual(rC.status, 201);

    // Fetch aggregate: average = (5 + 3 + 1) / 3 = 3.0, total = 3
    const agg1 = await request('GET', `/books/${targetIsbn}/reviews`);
    assert.strictEqual(agg1.status, 200);
    assert.strictEqual(agg1.body.totalReviews, 3);
    assert.strictEqual(agg1.body.averageRating, 3.0);
    assert.strictEqual(agg1.body.ratingCounts[5], 1);
    assert.strictEqual(agg1.body.ratingCounts[3], 1);
    assert.strictEqual(agg1.body.ratingCounts[1], 1);

    // Step 4: User C deletes review.
    // Remaining: 5 and 3. Average = 8 / 2 = 4.0, total = 2.
    const userCRev = rC.body.review._id;
    const delC = await request('DELETE', `/reviews/${userCRev}`, null, userC.token);
    assert.strictEqual(delC.status, 204);

    const agg2 = await request('GET', `/books/${targetIsbn}/reviews`);
    assert.strictEqual(agg2.status, 200);
    assert.strictEqual(agg2.body.totalReviews, 2);
    assert.strictEqual(agg2.body.averageRating, 4.0);
    assert.strictEqual(agg2.body.ratingCounts[1], 0);
    assert.strictEqual(agg2.body.ratingCounts[3], 1);
    assert.strictEqual(agg2.body.ratingCounts[5], 1);

    // Step 5: User A updates rating from 5 to 1 (upsert behavior)
    const rA2 = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 1, text: 'Changed my mind' }, userA.token);
    assert.strictEqual(rA2.status, 201);

    // Remaining: 1 (User A) and 3 (User B). Average = 4 / 2 = 2.0, total = 2.
    const agg3 = await request('GET', `/books/${targetIsbn}/reviews`);
    assert.strictEqual(agg3.status, 200);
    assert.strictEqual(agg3.body.totalReviews, 2, 'Total reviews must not duplicate on upsert');
    assert.strictEqual(agg3.body.averageRating, 2.0);
    assert.strictEqual(agg3.body.ratingCounts[1], 1);
    assert.strictEqual(agg3.body.ratingCounts[5], 0);

    // Clean up User A and B reviews
    await request('DELETE', `/reviews/${rA2.body.review._id}`, null, userA.token);
    await request('DELETE', `/reviews/${rB.body.review._id}`, null, userB.token);

    // Fetch aggregate after all deletions: total = 0, average = 0
    const aggFinal = await request('GET', `/books/${targetIsbn}/reviews`);
    assert.strictEqual(aggFinal.status, 200);
    assert.strictEqual(aggFinal.body.totalReviews, 0);
    assert.strictEqual(aggFinal.body.averageRating, 0);
    assert.deepStrictEqual(aggFinal.body.ratingCounts, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  await t.test('INV-08: Review boundary constraints & data sanitation', async () => {
    // Invalid star ratings (floating point, out of bounds, negative)
    const badRatings = [0, 6, -1, 3.5, 4.99, NaN, Infinity, null, '5'];
    for (const r of badRatings) {
      const res = await request('POST', `/books/${targetIsbn}/reviews`, { rating: r, text: 'test' }, userA.token);
      assert.strictEqual(res.status, 400, `Expected 400 for rating ${r}, got ${res.status}`);
    }

    // Boundary text length: exactly 5000 chars should pass, 5001 chars should fail
    const valid5000 = 'a'.repeat(5000);
    const res5000 = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 4, text: valid5000 }, userA.token);
    assert.strictEqual(res5000.status, 201, '5000 characters review text must be accepted');

    const invalid5001 = 'a'.repeat(5001);
    const res5001 = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 4, text: invalid5001 }, userA.token);
    assert.strictEqual(res5001.status, 400, '5001 characters review text must be rejected with 400');

    // Clean up userA review
    await request('DELETE', `/reviews/${res5000.body.review._id}`, null, userA.token);
  });
});

test('Milestone 3 Challenger: Settings Actions Invariants', async (t) => {
  const user = await createTestUser('settings_chall');
  const isbn1 = KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR;
  const isbn2 = KNOWN_SEEDS.BRAVE_NEW_WORLD;

  // Setup: Add books to shelves and write reviews
  await request('PUT', `/me/shelf/${isbn1}`, { status: 'currently_reading' }, user.token);
  await request('PUT', `/me/shelf/${isbn2}`, { status: 'read' }, user.token);
  await request('PUT', '/me/favorites', { isbns: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN] }, user.token);

  const revRes1 = await request('POST', `/books/${isbn1}/reviews`, { rating: 5, text: 'Chilling dystopia' }, user.token);
  const revRes2 = await request('POST', `/books/${isbn2}/reviews`, { rating: 4, text: 'Prophetic classic' }, user.token);
  assert.strictEqual(revRes1.status, 201);
  assert.strictEqual(revRes2.status, 201);

  await t.test('INV-09: Reset Books clears all shelves but preserves all reviews', async () => {
    // Action: Reset books
    const resetRes = await request('POST', '/me/reset-books', null, user.token);
    assert.strictEqual(resetRes.status, 200, 'Reset books should return 200');
    assert.strictEqual(resetRes.body.success, true);
    assert.deepStrictEqual(resetRes.body.shelves.wantToRead, []);
    assert.deepStrictEqual(resetRes.body.shelves.currentlyReading, []);
    assert.deepStrictEqual(resetRes.body.shelves.read, []);
    assert.deepStrictEqual(resetRes.body.shelves.favorites, []);

    // Verify shelves in GET /me are empty
    const meRes = await request('GET', '/me', null, user.token);
    assert.strictEqual(meRes.body.wantToRead.length, 0);
    assert.strictEqual(meRes.body.currentlyReading.length, 0);
    assert.strictEqual(meRes.body.read.length, 0);
    assert.strictEqual(meRes.body.favorites.length, 0);

    // CRITICAL INVARIANT: User reviews MUST be intact!
    const myRevs = await request('GET', '/me/reviews', null, user.token);
    assert.strictEqual(myRevs.status, 200);
    assert.strictEqual(myRevs.body.total, 2, 'All 2 reviews must remain intact after resetting books');
    const isbnsInReviews = myRevs.body.reviews.map((r) => r.isbn);
    assert.ok(isbnsInReviews.includes(isbn1));
    assert.ok(isbnsInReviews.includes(isbn2));
  });

  await t.test('INV-10: Delete Reviews clears all reviews but preserves shelves', async () => {
    // Re-populate shelves
    await request('PUT', `/me/shelf/${isbn1}`, { status: 'want_to_read' }, user.token);
    await request('PUT', `/me/shelf/${isbn2}`, { status: 'currently_reading' }, user.token);

    // Action: Delete reviews
    const delRevsRes = await request('DELETE', '/me/reviews', null, user.token);
    assert.strictEqual(delRevsRes.status, 200, 'Delete reviews should return 200');
    assert.strictEqual(delRevsRes.body.success, true);
    assert.strictEqual(delRevsRes.body.deletedCount, 2, 'Should report 2 deleted reviews');

    // Verify reviews are gone
    const myRevsAfter = await request('GET', '/me/reviews', null, user.token);
    assert.strictEqual(myRevsAfter.body.total, 0, 'User should have 0 reviews');

    // CRITICAL INVARIANT: Shelves MUST be intact!
    const meRes = await request('GET', '/me', null, user.token);
    const wantIsbns = meRes.body.wantToRead.map((b) => b.isbn);
    const currIsbns = meRes.body.currentlyReading.map((b) => b.isbn);
    assert.ok(wantIsbns.includes(isbn1), 'wantToRead shelf must be preserved');
    assert.ok(currIsbns.includes(isbn2), 'currentlyReading shelf must be preserved');
  });

  await t.test('INV-11: Cross-user isolation under settings actions', async () => {
    // Create victim user
    const victim = await createTestUser('victim_user');
    await request('PUT', `/me/shelf/${isbn1}`, { status: 'read' }, victim.token);
    await request('POST', `/books/${isbn1}/reviews`, { rating: 5, text: 'Victim review' }, victim.token);

    // Create attacker user
    const attacker = await createTestUser('attacker_user');
    await request('PUT', `/me/shelf/${isbn1}`, { status: 'want_to_read' }, attacker.token);

    // Attacker resets their books
    await request('POST', '/me/reset-books', null, attacker.token);

    // Attacker deletes their reviews
    await request('DELETE', '/me/reviews', null, attacker.token);

    // Verify victim data is completely untouched
    const victimMe = await request('GET', '/me', null, victim.token);
    assert.ok(victimMe.body.read.map((b) => b.isbn).includes(isbn1), 'Victim shelves must not be touched');

    const victimRevs = await request('GET', '/me/reviews', null, victim.token);
    assert.strictEqual(victimRevs.body.total, 1, 'Victim review must not be touched');
  });
});

test('Milestone 3 Challenger: High-Concurrency & Adversarial Fuzzing', async (t) => {
  const user = await createTestUser('fuzz_user');
  const targetIsbn = '0142001740'; // The Secret Life of Bees

  await t.test('STRESS-01: Concurrent shelf updates across distinct books', async () => {
    const isbns = [
      KNOWN_SEEDS.HOBBIT,
      KNOWN_SEEDS.DUNE,
      KNOWN_SEEDS.HP_AZKABAN,
      KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR,
      KNOWN_SEEDS.CATCHER,
    ];

    // Fire 5 simultaneous PUT requests with different statuses
    const promises = [
      request('PUT', `/me/shelf/${isbns[0]}`, { status: 'want_to_read' }, user.token),
      request('PUT', `/me/shelf/${isbns[1]}`, { status: 'currently_reading' }, user.token),
      request('PUT', `/me/shelf/${isbns[2]}`, { status: 'read' }, user.token),
      request('PUT', `/me/shelf/${isbns[3]}`, { status: 'want_to_read' }, user.token),
      request('PUT', `/me/shelf/${isbns[4]}`, { status: 'currently_reading' }, user.token),
    ];

    const results = await Promise.all(promises);
    for (const res of results) {
      assert.strictEqual(res.status, 200, 'Concurrent shelf update must return 200');
    }

    // Check final consistency
    const meRes = await request('GET', '/me', null, user.token);
    assert.strictEqual(meRes.status, 200);

    const want = meRes.body.wantToRead.map((b) => b.isbn);
    const curr = meRes.body.currentlyReading.map((b) => b.isbn);
    const read = meRes.body.read.map((b) => b.isbn);

    // Assert mutual exclusivity across all
    const allShelved = [...want, ...curr, ...read];
    const set = new Set(allShelved);
    assert.strictEqual(allShelved.length, set.size, 'No duplicates permitted across shelves under concurrent load');
  });

  await t.test('STRESS-02: Review text unicode, emoji, HTML & newline handling', async () => {
    const complexText = `🌟 Highly recommended! 📚\n\nLine 2: Contains special chars: <script>alert("xss")</script> & "quotes" & 'apostrophes'.\n\nEmoji test: 🚀🎉🔥 Invariant test: 100% verified.`;

    const res = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 5, text: complexText }, user.token);
    assert.strictEqual(res.status, 201, 'Complex Unicode and HTML entities should be stored safely');
    assert.strictEqual(res.body.review.rating, 5);
    assert.strictEqual(res.body.review.text, complexText);

    // Fetch review publicly to verify formatting and safety
    const pubRes = await request('GET', `/books/${targetIsbn}/reviews`);
    assert.strictEqual(pubRes.status, 200);
    const rev = pubRes.body.reviews.find((r) => r.isbn === targetIsbn);
    assert.ok(rev, 'Stored review must be retrieved');
    assert.strictEqual(rev.text, complexText);

    // Clean up
    await request('DELETE', `/reviews/${res.body.review._id}`, null, user.token);
  });

  await t.test('STRESS-03: Unauthorized mutation defense', async () => {
    // 1. Unauthenticated shelf mutation
    const r1 = await request('PUT', `/me/shelf/${targetIsbn}`, { status: 'read' });
    assert.strictEqual(r1.status, 401, 'Unauthenticated shelf mutation must be rejected with 401');

    // 2. Unauthenticated review submission
    const r2 = await request('POST', `/books/${targetIsbn}/reviews`, { rating: 4, text: 'nice' });
    assert.strictEqual(r2.status, 401, 'Unauthenticated review submission must be rejected with 401');

    // 3. Unauthenticated settings reset
    const r3 = await request('POST', '/me/reset-books');
    assert.strictEqual(r3.status, 401, 'Unauthenticated reset-books must be rejected with 401');

    // 4. Unauthenticated review delete-all
    const r4 = await request('DELETE', '/me/reviews');
    assert.strictEqual(r4.status, 401, 'Unauthenticated delete-all reviews must be rejected with 401');
  });
});
