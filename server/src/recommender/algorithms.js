// The five recommendation algorithms.
// Every algorithm = (1) candidate generation + (2) a scoring formula over shared features.
// Each returns results with a per-feature breakdown so the UI can explain *why*.
import { engine, cosine, titleNeighbours } from './engine.js';

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
  const { aKey, pKey, dKey, ...rest } = b;
  return rest;
}
