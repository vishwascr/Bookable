// Recommendation algorithms:
// 1. Single-seed catalog algorithms (tfidf, author, publisher, year, hybrid)
// 2. Profile multi-seed recommendations (recommendProfile)
// 3. Milestone 2: 3-Book Seed Recommendation Engine (recommendThree) with metadata heuristics
//    (author, genre, tag, rating) and STRICT title similarity exclusion (w_title = 0).
import { engine, cosine, titleNeighbours, getThreeSeedCandidates } from './engine.js';
import { inferGenres, inferTags, computeBaselineRating } from './metadata.js';

const YEAR_SIGMA = 5; // years: gaussian width for year proximity

function yearSim(a, b) {
  if (!a || !b) return 0;
  const d = a - b;
  return Math.exp(-(d * d) / (2 * YEAR_SIGMA * YEAR_SIGMA));
}

// Shared feature vector for a (seed, candidate) pair. All features are in [0, 1].
export function features(seed, cand) {
  const { books } = engine();
  const s = books[seed], c = books[cand];
  return {
    title: +cosine(seed, cand).toFixed(4),
    author: s.aKey && s.aKey === c.aKey ? 1 : 0,
    publisher: s.pKey && s.pKey === c.pKey ? 1 : 0,
    year: +yearSim(s.year, c.year).toFixed(4),
  };
}

function topByMap(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([i]) => i);
}

export const DEFAULT_WEIGHTS = { title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 };

export const ALGORITHMS = {
  tfidf: {
    name: 'Title Similarity (TF-IDF)',
    short: 'Content-based: compares the words in titles, weighting rare words higher.',
    formula: 'score = cosine(tfidf(seed.title), tfidf(candidate.title))',
    explain: [
      'Each title is tokenised (lower-cased, punctuation & stop-words removed, light stemming).',
      'Every term gets weight (1 + log tf) × idf, where idf = ln((N+1)/(df+1)) + 1. Rare words like "hobbit" matter far more than "life".',
      'Vectors are L2-normalised and compared with cosine similarity using an inverted index (only books sharing ≥1 term are scored).',
    ],
    candidates: (seed) => topByMap(titleNeighbours(seed), 600),
    score: (f) => f.title,
  },
  author: {
    name: 'Same Author',
    short: 'Other books by the same (normalised) author, ordered by title similarity.',
    formula: 'score = author_match × (0.7 + 0.3 × title_cosine)',
    explain: [
      'Author names are normalised ("J. K. Rowling" = "J.K. Rowling").',
      'All books by that author are candidates; ties are broken by title similarity, so series siblings rank first.',
    ],
    candidates: (seed) => engine().byAuthor.get(engine().books[seed].aKey) || [],
    score: (f) => f.author * (0.7 + 0.3 * f.title),
  },
  publisher: {
    name: 'Same Publisher & Era',
    short: 'Books from the same publisher, preferring similar publication years and titles.',
    formula: 'score = publisher_match × (0.6 × year_proximity + 0.4 × title_cosine)',
    explain: [
      'Publishers often specialise in genres/imprints (e.g. Harlequin, Tor, Del Rey).',
      `Year proximity uses a Gaussian: exp(-Δyear² / (2·${YEAR_SIGMA}²)).`,
    ],
    candidates: (seed) => engine().byPublisher.get(engine().books[seed].pKey) || [],
    score: (f) => f.publisher * (0.6 * f.year + 0.4 * f.title),
  },
  year: {
    name: 'Era + Theme',
    short: 'Books on a similar theme (shared title terms) published around the same time.',
    formula: 'score = 0.65 × year_proximity + 0.35 × title_cosine   (candidates share ≥1 title term)',
    explain: [
      'Candidates come from the TF-IDF inverted index (must share at least one meaningful title word).',
      'Ranking is dominated by how close the publication year is, surfacing "what else was written about this, back then".',
    ],
    candidates: (seed) => topByMap(titleNeighbours(seed), 3000),
    score: (f) => 0.65 * f.year + 0.35 * f.title,
  },
  hybrid: {
    name: 'Weighted Hybrid',
    short: 'Blends all signals with adjustable weights.',
    formula: 'score = Σ wᵢ·featureᵢ / Σ wᵢ   over {title, author, publisher, year}',
    explain: [
      'Candidate pool = top TF-IDF neighbours ∪ same-author books ∪ same-publisher books.',
      'Each candidate gets all four features; the final score is the weighted average. Tune the sliders to see rankings shift.',
    ],
    candidates: (seed) => {
      const e = engine(); const b = e.books[seed];
      const set = new Set(topByMap(titleNeighbours(seed), 800));
      for (const i of e.byAuthor.get(b.aKey) || []) set.add(i);
      const pubs = e.byPublisher.get(b.pKey) || [];
      for (const i of pubs.length > 5000 ? pubs.slice(0, 5000) : pubs) set.add(i);
      return [...set];
    },
    score: (f, w) => {
      const tot = w.title + w.author + w.publisher + w.year || 1;
      return (w.title * f.title + w.author * f.author + w.publisher * f.publisher + w.year * f.year) / tot;
    },
  },
};

export function recommend(algoKey, seed, { limit = 12, weights = DEFAULT_WEIGHTS } = {}) {
  const algo = ALGORITHMS[algoKey];
  if (!algo) throw new Error(`Unknown algorithm "${algoKey}"`);
  const { books } = engine();
  const t0 = performance.now();
  const seedBook = books[seed];

  const cands = algo.candidates(seed);
  const scored = [];
  for (const c of cands) {
    if (c === seed || books[c].dKey === seedBook.dKey) continue; // skip other editions of the seed
    const f = features(seed, c);
    const score = algo.score(f, weights);
    if (score > 0) scored.push({ c, f, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const results = [];
  for (const s of scored) {
    const b = books[s.c];
    if (seen.has(b.dKey)) continue; // collapse duplicate editions
    seen.add(b.dKey);
    results.push({ book: publicBook(b), score: +s.score.toFixed(4), features: s.f });
    if (results.length >= limit) break;
  }

  return {
    algorithm: algoKey,
    name: algo.name,
    formula: algo.formula,
    weights: algoKey === 'hybrid' ? weights : undefined,
    meta: { candidatesConsidered: cands.length, ms: +(performance.now() - t0).toFixed(1) },
    results,
  };
}

export function publicBook(b) {
  if (!b) return null;
  const { aKey, pKey, dKey, ...rest } = b;
  return rest;
}

// ---------------------------------------------------------------------------
// Profile (multi-seed) recommendations — used by the "For You" page.
// Runs the chosen algorithm once per favourite book, then aggregates:
//   profileScore(c) = (1/|S|) · Σ_s score_s(c)
// ---------------------------------------------------------------------------
export function recommendProfile(algoKey, seeds, { limit = 12, weights = DEFAULT_WEIGHTS, exclude = [] } = {}) {
  const algo = ALGORITHMS[algoKey];
  if (!algo) throw new Error(`Unknown algorithm "${algoKey}"`);
  const { books } = engine();
  const t0 = performance.now();

  const seedKeys = new Set(seeds.map((s) => books[s].dKey));
  const excludeKeys = new Set(exclude.map((i) => books[i]?.dKey).filter(Boolean));
  const agg = new Map();
  let candidatesConsidered = 0;

  for (const seed of seeds) {
    const cands = algo.candidates(seed);
    candidatesConsidered += cands.length;
    const bestPerWork = new Map();
    for (const c of cands) {
      const k = books[c].dKey;
      if (seedKeys.has(k) || excludeKeys.has(k)) continue;
      const f = features(seed, c);
      const score = algo.score(f, weights);
      if (score <= 0) continue;
      const prev = bestPerWork.get(k);
      if (!prev || score > prev.score) bestPerWork.set(k, { c, f, score });
    }
    const seedIsbn = books[seed].isbn;
    for (const [k, v] of bestPerWork) {
      let a = agg.get(k);
      if (!a) { a = { c: v.c, total: 0, contrib: {}, best: null }; agg.set(k, a); }
      a.total += v.score;
      a.contrib[seedIsbn] = +v.score.toFixed(4);
      if (!a.best || v.score > a.best.score) a.best = { ...v, seed: seedIsbn };
    }
  }

  const n = seeds.length || 1;
  const pool = [...agg.values()]
    .map((a) => ({ ...a, score: a.total / n }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit * 8);

  const DIVERSITY = 0.85;
  const used = {};
  const picked = [];
  while (picked.length < limit && pool.length) {
    let bi = 0, bv = -1;
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i].score * DIVERSITY ** (used[pool[i].best.seed] || 0);
      if (v > bv) { bv = v; bi = i; }
    }
    const [a] = pool.splice(bi, 1);
    used[a.best.seed] = (used[a.best.seed] || 0) + 1;
    picked.push(a);
  }

  const results = picked
    .map((a) => ({
      book: publicBook(books[a.best.c]),
      score: +a.score.toFixed(4),
      features: a.best.f,
      bestSeed: a.best.seed,
      contributions: a.contrib,
      matchedSeeds: Object.keys(a.contrib).length,
    }));

  return {
    algorithm: algoKey,
    name: algo.name,
    formula: `profile = (1/${n}) · Σ over favourites [ ${algo.formula.replace(/^score = /, '')} ]`,
    weights: algoKey === 'hybrid' ? weights : undefined,
    meta: { seeds: n, candidatesConsidered, ms: +(performance.now() - t0).toFixed(1) },
    results,
  };
}

// ===========================================================================
// Milestone 2: 3-Book Recommendation Engine with Heuristic Scoring
// STRICT CONSTRAINT: Title similarity weighting is strictly excluded (w_title = 0).
// Heuristic features: author, genre, tag, rating.
// ===========================================================================

export const DEFAULT_THREE_WEIGHTS = { genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 };

/**
 * Compute heuristic features for a candidate against the 3 seeds.
 * STRICT ENFORCEMENT: Title similarity is completely omitted.
 *
 * @param {number|object} cand - Candidate book index or object
 * @param {Array<number|object>} seeds - Array of 3 seed indices or objects
 * @param {object} eng - Engine state instance
 * @returns {object} { author, genre, tag, rating } in [0, 1]
 */
export function computeHeuristicFeatures(cand, seeds, eng = engine()) {
  const books = eng?.books || [];
  const c = typeof cand === 'number' ? books[cand] : cand;
  if (!c) return { author: 0, genre: 0, tag: 0, rating: 0 };

  const seedBooks = (seeds || []).map((s) => (typeof s === 'number' ? books[s] : s)).filter(Boolean);
  if (!seedBooks.length) return { author: 0, genre: 0, tag: 0, rating: 0 };

  // 1. Author Feature (1.0 if cand author matches ANY seed author, else 0.0)
  const authorMatch = c.aKey && seedBooks.some((s) => s.aKey && s.aKey === c.aKey) ? 1.0 : 0.0;

  // 2. Genre Feature (Jaccard similarity against union of seed genres)
  const candGenres = Array.isArray(c.genres) ? c.genres : inferGenres(c);
  const seedGenres = new Set();
  for (const s of seedBooks) {
    const sg = Array.isArray(s.genres) ? s.genres : inferGenres(s);
    for (const g of sg) seedGenres.add(g);
  }
  let genreSim = 0.0;
  if (candGenres.length && seedGenres.size) {
    const intersection = candGenres.filter((g) => seedGenres.has(g)).length;
    const union = new Set([...candGenres, ...seedGenres]).size;
    genreSim = union > 0 ? intersection / union : 0.0;
  }

  // 3. Tag Feature (Normalized tag overlap with union of seed tags)
  const candTags = Array.isArray(c.tags) ? c.tags : inferTags(c);
  const seedTags = new Set();
  for (const s of seedBooks) {
    const st = Array.isArray(s.tags) ? s.tags : inferTags(s);
    for (const t of st) seedTags.add(t);
  }
  let tagSim = 0.0;
  if (candTags.length && seedTags.size) {
    const intersection = candTags.filter((t) => seedTags.has(t)).length;
    const denom = Math.max(1, Math.sqrt(candTags.length * seedTags.size));
    tagSim = Math.min(1.0, intersection / denom);
  }

  // 4. Rating Feature (Blend of absolute rating and proximity to average seed rating)
  const cRating = typeof c.rating === 'number' ? c.rating : computeBaselineRating(c);
  const seedRatings = seedBooks.map((s) => (typeof s.rating === 'number' ? s.rating : computeBaselineRating(s)));
  const meanSeedRating = seedRatings.reduce((sum, r) => sum + r, 0) / seedRatings.length;

  const ratingFeature = 0.7 * (cRating / 5.0) + 0.3 * (1.0 - Math.abs(cRating - meanSeedRating) / 5.0);

  return {
    author: +authorMatch.toFixed(4),
    genre: +genreSim.toFixed(4),
    tag: +tagSim.toFixed(4),
    rating: +Math.max(0, Math.min(1, ratingFeature)).toFixed(4),
  };
}

/**
 * Score a candidate using customizable heuristic weights.
 * Strictly ignores any passed title weight (w_title = 0).
 */
export function scoreCandidate(features = {}, weights = DEFAULT_THREE_WEIGHTS) {
  const f = features || {};
  const w = weights || DEFAULT_THREE_WEIGHTS;
  const wg = Math.max(0, Number(w.genre ?? DEFAULT_THREE_WEIGHTS.genre) || 0);
  const wa = Math.max(0, Number(w.author ?? DEFAULT_THREE_WEIGHTS.author) || 0);
  const wt = Math.max(0, Number(w.tag ?? DEFAULT_THREE_WEIGHTS.tag) || 0);
  const wr = Math.max(0, Number(w.rating ?? DEFAULT_THREE_WEIGHTS.rating) || 0);

  const total = wg + wa + wt + wr || 1.0;
  const score = (wg * (f.genre || 0) + wa * (f.author || 0) + wt * (f.tag || 0) + wr * (f.rating || 0)) / total;
  return +score.toFixed(4);
}

/**
 * Calculate similarity between a candidate and an individual seed (for bestSeed identification).
 */
function singleSeedSimilarity(cand, seed) {
  if (!cand || !seed) return 0;
  const aMatch = cand.aKey && seed.aKey && cand.aKey === seed.aKey ? 1.0 : 0.0;
  const cGenres = Array.isArray(cand.genres) ? cand.genres : inferGenres(cand);
  const sGenres = Array.isArray(seed.genres) ? seed.genres : inferGenres(seed);
  let gSim = 0;
  if (cGenres.length && sGenres.length) {
    const inter = cGenres.filter((g) => sGenres.includes(g)).length;
    const union = new Set([...cGenres, ...sGenres]).size;
    gSim = union > 0 ? inter / union : 0;
  }
  const cTags = Array.isArray(cand.tags) ? cand.tags : inferTags(cand);
  const sTags = Array.isArray(seed.tags) ? seed.tags : inferTags(seed);
  let tSim = 0;
  if (cTags.length && sTags.length) {
    const inter = cTags.filter((t) => sTags.includes(t)).length;
    tSim = inter / Math.max(1, Math.sqrt(cTags.length * sTags.length));
  }
  const rDiff = Math.abs((cand.rating || 4.0) - (seed.rating || 4.0)) / 5.0;
  return 0.4 * gSim + 0.3 * aMatch + 0.2 * tSim + 0.1 * (1.0 - rDiff);
}

function makeExplanation(cand, bestSeed) {
  const cGenres = cand.genres || inferGenres(cand);
  const sGenres = bestSeed.genres || inferGenres(bestSeed);
  const shared = cGenres.filter((g) => sGenres.includes(g));

  if (cand.aKey && cand.aKey === bestSeed.aKey) {
    if (shared.length) {
      return `Matches author ${cand.author || 'same author'} and genre ${shared.join(' & ')} from "${bestSeed.title}"`;
    }
    return `Matches author ${cand.author || 'same author'} from "${bestSeed.title}"`;
  }
  if (shared.length) {
    return `Shares genre ${shared.join(' & ')} with "${bestSeed.title}"`;
  }
  return `Curated recommendation matching themes from "${bestSeed.title}"`;
}

/**
 * Generate 3-seed recommendations using metadata heuristics (author, genre, tag, rating)
 * with strict title similarity exclusion and greedy diversity re-ranking (delta = 0.85).
 *
 * @param {Array<string|number>} seeds - Array of 3 seed ISBNs or book indices
 * @param {object} weights - Customizable heuristic weights
 * @param {number} limit - Maximum recommendations to return
 * @returns {object} { candidates, diagnostics }
 */
export function recommendThree(seeds, weights = DEFAULT_THREE_WEIGHTS, limit = 12) {
  const t0 = performance.now();
  const eng = engine();
  const books = eng.books || [];
  const byIsbn = eng.byIsbn || new Map();

  // Validate seeds: exactly 3
  if (!Array.isArray(seeds) || seeds.length !== 3) {
    throw new Error('Exactly 3 seed books must be provided');
  }

  // Resolve seeds to book indices
  const seedIndices = [];
  for (const s of seeds) {
    const idx = typeof s === 'number' ? s : byIsbn.get(String(s));
    if (idx === undefined || !books[idx]) {
      throw new Error(`Seed book not found in catalog: "${s}"`);
    }
    seedIndices.push(idx);
  }

  const seedBooks = seedIndices.map((i) => books[i]);
  const seedIsbns = new Set(seedBooks.map((b) => b.isbn));
  const seedDKeys = new Set(seedBooks.map((b) => b.dKey).filter(Boolean));

  // Sanitize weights (strict title exclusion)
  const safeWeights = {
    genre: Math.max(0, Number(weights.genre ?? DEFAULT_THREE_WEIGHTS.genre) || 0),
    author: Math.max(0, Number(weights.author ?? DEFAULT_THREE_WEIGHTS.author) || 0),
    tag: Math.max(0, Number(weights.tag ?? DEFAULT_THREE_WEIGHTS.tag) || 0),
    rating: Math.max(0, Number(weights.rating ?? DEFAULT_THREE_WEIGHTS.rating) || 0),
  };

  // Generate candidate indices using inverted maps without title similarity
  const candidateIndices = getThreeSeedCandidates(seedIndices, 2500);

  // Score candidates and group by work key (dKey)
  const workMap = new Map(); // dKey -> candidate
  let candidatesEvaluated = 0;

  for (const idx of candidateIndices) {
    const cand = books[idx];
    if (!cand || seedIsbns.has(cand.isbn) || seedDKeys.has(cand.dKey)) continue;

    candidatesEvaluated++;
    const feat = computeHeuristicFeatures(cand, seedBooks, eng);
    const score = scoreCandidate(feat, safeWeights);
    if (score <= 0) continue;

    // Find best matching seed
    let bestSim = -1;
    let bestSeed = seedBooks[0];
    let matchedCount = 0;
    for (const sb of seedBooks) {
      const sim = singleSeedSimilarity(cand, sb);
      if (sim > 0.1) matchedCount++;
      if (sim > bestSim) {
        bestSim = sim;
        bestSeed = sb;
      }
    }

    const item = {
      idx,
      cand,
      score,
      features: feat,
      bestSeedIsbn: bestSeed.isbn,
      bestSeedTitle: bestSeed.title,
      matchedSeeds: Math.max(1, matchedCount),
      bestSeed,
    };

    const key = cand.dKey || cand.isbn || String(idx);
    const existing = workMap.get(key);
    if (!existing || score > existing.score) {
      workMap.set(key, item);
    }
  }

  const pool = [...workMap.values()].sort((a, b) => b.score - a.score).slice(0, limit * 8);

  // Greedy diversity re-ranking: each time a seed drives a pick, penalty delta = 0.85
  const DIVERSITY = 0.85;
  const used = {};
  for (const sb of seedBooks) used[sb.isbn] = 0;

  const picked = [];
  while (picked.length < limit && pool.length) {
    let bi = 0;
    let bv = -1;
    for (let i = 0; i < pool.length; i++) {
      const penalty = DIVERSITY ** (used[pool[i].bestSeedIsbn] || 0);
      const val = pool[i].score * penalty;
      if (val > bv) {
        bv = val;
        bi = i;
      }
    }
    const [selected] = pool.splice(bi, 1);
    used[selected.bestSeedIsbn] = (used[selected.bestSeedIsbn] || 0) + 1;
    picked.push(selected);
  }

  const candidates = picked.map((item) => ({
    ...publicBook(item.cand),
    score: +item.score.toFixed(4),
    features: item.features,
    bestSeed: item.bestSeedIsbn,
    matchedSeeds: item.matchedSeeds,
    explanation: makeExplanation(item.cand, item.bestSeed),
  }));

  return {
    candidates,
    diagnostics: {
      seedCount: 3,
      titleExcluded: true, // STRICT CONSTRAINT VERIFIED
      weightsUsed: safeWeights,
      candidatesEvaluated,
      queryTimeMs: +(performance.now() - t0).toFixed(2),
    },
  };
}
