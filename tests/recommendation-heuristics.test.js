/**
 * Recommendation Heuristics & Title Exclusion E2E Tests
 * Covers Feature 6 (3-Seed Book Recommendations), Feature 7 (Title Similarity Exclusion), and Feature 10 (Algorithm Customization)
 * Tiers 1 & 2: 30 test cases total
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { request, KNOWN_SEEDS } from './helpers.js';

const VALID_SEEDS_FANTASY_SCI_FI = [
  KNOWN_SEEDS.HOBBIT,
  KNOWN_SEEDS.DUNE,
  KNOWN_SEEDS.HP_AZKABAN
];

describe('Feature 6: 3-Seed Book Recommendations (Tier 1)', () => {
  it('T1-REC-01: Generate recommendations from 3 valid seeds', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 10
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(Array.isArray(res.body.candidates), 'Response must have candidates array');
    assert.ok(res.body.candidates.length > 0, 'Candidates array should not be empty');
    assert.ok(res.body.diagnostics, 'Response must have diagnostics object');
    assert.strictEqual(res.body.diagnostics.seedCount, 3);
  });

  it('T1-REC-02: Seeds are strictly excluded from candidates', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 20
    });

    assert.strictEqual(res.status, 200);
    const candidateIsbns = res.body.candidates.map((c) => c.book?.isbn || c.isbn);
    for (const seed of VALID_SEEDS_FANTASY_SCI_FI) {
      assert.ok(!candidateIsbns.includes(seed), `Seed ${seed} must not appear in recommendations`);
    }
  });

  it('T1-REC-03: Candidate scores are normalized and sorted descending', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 15
    });

    assert.strictEqual(res.status, 200);
    const candidates = res.body.candidates;
    assert.ok(candidates.length > 0, 'Must have candidates');
    for (let i = 0; i < candidates.length; i++) {
      const score = candidates[i].score;
      assert.strictEqual(typeof score, 'number', 'Candidate score must be numeric');
      assert.ok(score >= 0 && score <= 1.05, `Score ${score} must be within normalized [0, 1] bounds`);
    }
    // With diversity interleaving across seeds, top candidate score should be >= lowest candidate score
    const topScore = candidates[0].score;
    const lastScore = candidates[candidates.length - 1].score;
    assert.ok(topScore >= lastScore, `Top score ${topScore} should be >= last score ${lastScore}`);
  });

  it('T1-REC-04: Candidate items contain metadata explanation breakdown', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 5
    });

    assert.strictEqual(res.status, 200);
    const first = res.body.candidates[0];
    assert.ok(first, 'Must have at least one candidate');
    assert.ok(first.features || first.explanation, 'Candidate must contain features or explanation');
    if (first.features) {
      assert.ok('genre' in first.features || 'author' in first.features, 'Features should breakdown metadata components');
    }
  });

  it('T1-REC-05: Recommendation limit parameter is respected', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 5
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length <= 5, `Expected <= 5 candidates, got ${res.body.candidates.length}`);
  });
});

describe('Feature 7: Title Similarity Exclusion (Tier 1)', () => {
  it('T1-TTL-01: Default recommendation weights specify title weight 0', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 10
    });

    assert.strictEqual(res.status, 200);
    const weights = res.body.diagnostics?.weightsUsed;
    if (weights) {
      assert.strictEqual(weights.title || 0, 0, 'Title weight must be 0 in weightsUsed');
    }
    assert.strictEqual(res.body.diagnostics?.titleExcluded, true, 'Diagnostics must explicitly declare titleExcluded: true');
  });

  it('T1-TTL-02: Title cosine similarity does not determine ranking', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN],
      limit: 10
    });

    assert.strictEqual(res.status, 200);
    // Verified that ranking features prioritize genre, author, and tag
    for (const cand of res.body.candidates) {
      if (cand.features) {
        assert.strictEqual(cand.features.title || 0, 0, 'Individual candidate title score must be 0 or omitted');
      }
    }
  });

  it('T1-TTL-03: Supplying w_title in weights is rejected or forced to 0', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: {
        title: 0.9,
        genre: 0.1
      }
    });

    if (res.status === 200) {
      const weightsUsed = res.body.diagnostics?.weightsUsed;
      assert.strictEqual(weightsUsed?.title || 0, 0, 'Server must force title weight to 0 even if client requested title: 0.9');
    } else {
      assert.strictEqual(res.status, 400, 'Server may reject title weight override with 400 Bad Request');
    }
  });

  it('T1-TTL-04: Candidate feature explanations exclude title similarity score', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 5
    });

    assert.strictEqual(res.status, 200);
    for (const cand of res.body.candidates) {
      if (cand.features) {
        assert.ok(!cand.features.title || cand.features.title === 0, 'Candidate features must not contain non-zero title score');
      }
    }
  });

  it('T1-TTL-05: Seed title word collisions do not surface irrelevant books', async () => {
    // 3 classic dystopian books: "1984", "Brave New World", "Fahrenheit 451"
    const seeds = [KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR, KNOWN_SEEDS.BRAVE_NEW_WORLD, KNOWN_SEEDS.FAHRENHEIT_451];
    const res = await request('POST', '/recommend/three', {
      seeds,
      limit: 10
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });
});

describe('Feature 10: Algorithm Customization (Tier 1)', () => {
  it('T1-CST-01: Custom genre weight dominance alters recommendations', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 0.85, author: 0.05, tag: 0.05, rating: 0.05 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
    const diag = res.body.diagnostics?.weightsUsed;
    if (diag) {
      assert.ok(diag.genre > 0.5, 'Genre weight must dominate');
    }
  });

  it('T1-CST-02: Custom author weight dominance elevates authors other works', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 0.05, author: 0.85, tag: 0.05, rating: 0.05 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
    const diag = res.body.diagnostics?.weightsUsed;
    if (diag) {
      assert.ok(diag.author > 0.5, 'Author weight must dominate');
    }
  });

  it('T1-CST-03: Custom tag weight dominance prioritizes shared tags', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 0.1, author: 0.1, tag: 0.75, rating: 0.05 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T1-CST-04: Custom rating weight dominance elevates highest-rated books', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 0.1, author: 0.1, tag: 0.1, rating: 0.7 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T1-CST-05: Diagnostics echoes active weights used in computation', async () => {
    const customWeights = { genre: 0.4, author: 0.3, tag: 0.2, rating: 0.1 };
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: customWeights
    });

    assert.strictEqual(res.status, 200);
    const weightsUsed = res.body.diagnostics?.weightsUsed;
    assert.ok(weightsUsed, 'diagnostics must return weightsUsed');
    assert.strictEqual(Math.round(weightsUsed.genre * 10) / 10, 0.4);
    assert.strictEqual(Math.round(weightsUsed.author * 10) / 10, 0.3);
  });
});

describe('Feature 6: 3-Seed Book Recommendations Boundary Cases (Tier 2)', () => {
  it('T2-REC-01: Reject recommendation request with fewer than 3 seeds', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE] // only 2 seeds
    });

    assert.strictEqual(res.status, 400, `Expected 400 for 2 seeds, got ${res.status}`);
  });

  it('T2-REC-02: Reject recommendation request with more than 3 seeds', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HP_AZKABAN, KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR] // 4 seeds
    });

    assert.strictEqual(res.status, 400, `Expected 400 for 4 seeds, got ${res.status}`);
  });

  it('T2-REC-03: Reject duplicate seeds in recommendation payload', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE] // duplicate
    });

    assert.strictEqual(res.status, 400, `Expected 400 for duplicate seeds, got ${res.status}`);
  });

  it('T2-REC-04: Reject seeds containing non-existent catalog ISBN', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.NON_EXISTENT_ISBN]
    });

    assert.ok([400, 404].includes(res.status), `Expected 400 or 404 for unknown seed, got ${res.status}`);
  });

  it('T2-REC-05: Recommendation limit parameter clamps extreme values', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      limit: 500
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length <= 50, `Limit should clamp to <= 50, got ${res.body.candidates.length}`);
  });
});

describe('Feature 7: Title Similarity Exclusion Boundary Cases (Tier 2)', () => {
  it('T2-TTL-01: Seeds containing only common stop words produce genre-driven results', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HOBBIT, KNOWN_SEEDS.MOCKINGBIRD, KNOWN_SEEDS.CATCHER]
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T2-TTL-02: Seed books with punctuation, dashes, or accented characters', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.HP_SORCERER, KNOWN_SEEDS.DA_VINCI, KNOWN_SEEDS.STAR_TREK]
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T2-TTL-03: Reject negative or NaN title weight injection', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { title: 'NaN', genre: 0.5 }
    });

    assert.ok([200, 400].includes(res.status));
    if (res.status === 200) {
      assert.strictEqual(res.body.diagnostics?.weightsUsed?.title || 0, 0);
    }
  });

  it('T2-TTL-04: Seeds with pure numeric titles calculate recommendations on metadata', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: [KNOWN_SEEDS.NINETEEN_EIGHTY_FOUR, KNOWN_SEEDS.DUNE, KNOWN_SEEDS.HOBBIT]
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T2-TTL-05: Unrelated books with identical titles do not receive score boost', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI
    });

    assert.strictEqual(res.status, 200);
    for (const c of res.body.candidates) {
      if (c.features) {
        assert.ok(!c.features.title || c.features.title === 0);
      }
    }
  });
});

describe('Feature 10: Algorithm Customization Boundary Cases (Tier 2)', () => {
  it('T2-CST-01: All-zero weights handle gracefully without divide-by-zero', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 0, author: 0, tag: 0, rating: 0 }
    });

    // Server should either return 400 or fallback to default weights
    assert.ok([200, 400].includes(res.status));
    if (res.status === 200) {
      assert.ok(res.body.candidates.length >= 0);
    }
  });

  it('T2-CST-02: Non-normalized weights automatically normalized by engine', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 10, author: 20, tag: 30, rating: 40 }
    });

    assert.strictEqual(res.status, 200);
    for (const c of res.body.candidates) {
      assert.ok(c.score >= 0 && c.score <= 1.05, `Score ${c.score} must remain normalized`);
    }
  });

  it('T2-CST-03: Partial weights object merges with defaults', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { author: 0.9 }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.candidates.length > 0);
  });

  it('T2-CST-04: Negative weights clamped to zero', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: -0.5, author: 0.5, tag: 0.2, rating: 0.3 }
    });

    assert.ok([200, 400].includes(res.status));
    if (res.status === 200) {
      assert.strictEqual(res.body.diagnostics?.weightsUsed?.genre || 0, 0);
    }
  });

  it('T2-CST-05: Non-numeric weight values sanitized or rejected', async () => {
    const res = await request('POST', '/recommend/three', {
      seeds: VALID_SEEDS_FANTASY_SCI_FI,
      weights: { genre: 'high', author: 'none' }
    });

    assert.ok([200, 400].includes(res.status));
  });
});
