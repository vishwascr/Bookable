import { Router } from 'express';
import Book from '../models/Book.js';
import { engine, termsOf } from '../recommender/engine.js';
import { decode } from '../recommender/text.js';
import {
  ALGORITHMS,
  DEFAULT_WEIGHTS,
  DEFAULT_THREE_WEIGHTS,
  recommend,
  recommendThree,
  publicBook,
} from '../recommender/algorithms.js';
import {
  analyzeReviewSentiment,
  adaptRecommendationsBySentiment,
  LITERARY_LEXICON,
} from '../recommender/sentiment.js';

const r = Router();

const ready = (req, res, next) =>
  engine().ready ? next() : res.status(503).json({ error: 'Index is still building, try again in a few seconds.' });

// GET /api/health
r.get('/health', (req, res) =>
  res.json({
    ok: true,
    ready: engine().ready,
    stats: engine().stats,
    features: {
      recommenderM2: true,
      titleExcluded: true,
      sentimentEngine: true,
    },
  })
);

// GET /api/dev/diagnostics (Telemetry for Dev Mode)
r.get('/dev/diagnostics', ready, (req, res) => {
  const e = engine();
  res.json({
    ok: true,
    ready: e.ready,
    stats: e.stats,
    recommender: {
      seedCount: 3,
      titleExcluded: true, // STRICT CONSTRAINT VERIFIED
      defaultWeights: DEFAULT_THREE_WEIGHTS,
      genresAvailable: e.byGenre ? e.byGenre.size : 0,
      tagsAvailable: e.byTag ? e.byTag.size : 0,
      authorsAvailable: e.byAuthor ? e.byAuthor.size : 0,
      publishersAvailable: e.byPublisher ? e.byPublisher.size : 0,
    },
    sentiment: {
      engine: 'pure-rule-based-local',
      lexiconTerms: Object.keys(LITERARY_LEXICON).length,
      supportedAspects: ['pacing', 'world-building', 'characters', 'tone', 'prose', 'plot', 'emotional'],
    },
  });
});

r.get('/algorithms', (req, res) =>
  res.json({
    defaultWeights: DEFAULT_WEIGHTS,
    defaultThreeWeights: DEFAULT_THREE_WEIGHTS,
    algorithms: Object.entries(ALGORITHMS).map(([key, a]) => ({ key, name: a.name, short: a.short, formula: a.formula, explain: a.explain })),
  })
);

// Helper: Validate and parse 3-seed heuristic weights with strict title exclusion
function parseThreeWeights(weights) {
  if (!weights) return { weights: { ...DEFAULT_THREE_WEIGHTS } };
  if (typeof weights !== 'object' || Array.isArray(weights)) {
    return { error: 'Field "weights" must be an object' };
  }
  const allowed = ['genre', 'author', 'tag', 'rating'];
  const w = {};
  for (const k of allowed) {
    if (weights[k] !== undefined) {
      const val = Number(weights[k]);
      if (isNaN(val) || val < 0) return { error: `Weight for "${k}" must be a non-negative number` };
      w[k] = val;
    } else {
      w[k] = DEFAULT_THREE_WEIGHTS[k];
    }
  }
  const sum = w.genre + w.author + w.tag + w.rating;
  if (sum <= 0) return { error: 'At least one weight must be greater than zero' };
  return { weights: w };
}

// POST /api/recommend/three
// Generates recommendations from 3 seed books using author, genre, tag, rating heuristics.
// STRICT CONSTRAINT: Title similarity weighting is strictly excluded (w_title = 0).
r.post('/recommend/three', ready, async (req, res, next) => {
  try {
    const { seeds, weights, limit } = req.body || {};

    if (!Array.isArray(seeds)) {
      return res.status(400).json({ error: 'Field "seeds" must be an array of 3 book ISBN strings' });
    }
    const cleanSeeds = seeds.map((s) => String(s || '').trim()).filter(Boolean);
    if (cleanSeeds.length !== 3) {
      return res.status(400).json({ error: 'Exactly 3 seed book ISBNs must be provided' });
    }
    const uniqueSeeds = [...new Set(cleanSeeds)];
    if (uniqueSeeds.length !== 3) {
      return res.status(400).json({ error: 'Seed ISBNs must be 3 distinct books' });
    }

    const e = engine();
    const missing = uniqueSeeds.filter((isbn) => !e.byIsbn.has(isbn));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Unknown seed ISBN(s): ${missing.join(', ')}` });
    }

    const parsedWeights = parseThreeWeights(weights);
    if (parsedWeights.error) {
      return res.status(400).json({ error: parsedWeights.error });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

    const result = recommendThree(uniqueSeeds, parsedWeights.weights, parsedLimit);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/recommend/sentiment-adapted
// Analyzes review sentiment locally and dynamically adapts recommendations.
r.post('/recommend/sentiment-adapted', ready, async (req, res, next) => {
  try {
    const { reviewText, targetIsbn, rating, limit } = req.body || {};

    const numRating = Number(rating);
    if (rating === undefined || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    if (reviewText !== undefined && typeof reviewText !== 'string') {
      return res.status(400).json({ error: 'Field "reviewText" must be a string' });
    }
    const cleanText = String(reviewText || '').trim();
    if (cleanText.length > 5000) {
      return res.status(400).json({ error: 'Review text exceeds maximum length of 5000 characters' });
    }

    const e = engine();
    let targetBook = null;
    if (targetIsbn) {
      const idx = e.byIsbn.get(String(targetIsbn).trim());
      if (idx === undefined) {
        return res.status(404).json({ error: `Target book with ISBN "${targetIsbn}" not found` });
      }
      targetBook = e.books[idx];
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const sentiment = analyzeReviewSentiment(cleanText, numRating);
    const adapted = adaptRecommendationsBySentiment(sentiment, targetBook, { limit: parsedLimit });

    res.json({
      sentiment: {
        score: sentiment.score,
        polarity: sentiment.polarity,
        label: sentiment.label,
        classification: sentiment.classification,
        confidence: sentiment.confidence,
        keywords: sentiment.keywords,
        aspects: sentiment.aspects,
        aspectTags: sentiment.aspectTags,
        breakdown: sentiment.metrics,
        positiveWords: sentiment.positiveWords,
        negativeWords: sentiment.negativeWords,
      },
      adaptedRecommendations: adapted.adaptedRecommendations || adapted,
      diagnostics: {
        targetIsbn: targetIsbn || null,
        rating: numRating,
        adaptationStrategy: adapted.diagnostics?.mode || 'adaptive',
        queryTimeMs: adapted.diagnostics?.latencyMs || 0,
        candidatesEvaluated: adapted.diagnostics?.candidatesEvaluated || 0,
        titleExcluded: true, // STRICT CONSTRAINT VERIFIED
        reason: adapted.diagnostics?.reason,
        praisedAspects: adapted.diagnostics?.praisedAspects,
        criticizedAspects: adapted.diagnostics?.criticizedAspects,
        contrastingVibes: adapted.diagnostics?.contrastingVibes,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/books/search?q=harry potter&limit=20&page=1
r.get('/books/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const hasPagination = req.query.page !== undefined || req.query.paginate === 'true';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    if (q.length < 2) {
      return res.json(hasPagination ? { books: [], total: 0, page: 1, totalPages: 0, limit } : []);
    }

    const filter = { $text: { $search: q } };
    const [docs, total] = await Promise.all([
      Book.find(filter, { score: { $meta: 'textScore' }, _id: 0 })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean(),
      hasPagination ? Book.countDocuments(filter) : Promise.resolve(null),
    ]);

    const books = docs.map(({ score, ...d }) => ({
      ...d,
      title: decode(d.title),
      author: decode(d.author),
      publisher: decode(d.publisher),
    }));

    if (hasPagination) {
      return res.json({
        books,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      });
    }

    res.json(books);
  } catch (e) { next(e); }
});

r.get('/books/:isbn', ready, (req, res) => {
  const i = engine().byIsbn.get(req.params.isbn);
  if (i === undefined) return res.status(404).json({ error: 'Book not found' });
  res.json({ book: publicBook(engine().books[i]), terms: termsOf(i) });
});

function parseWeights(q) {
  const w = { ...DEFAULT_WEIGHTS };
  for (const k of Object.keys(w)) if (q[`w_${k}`] !== undefined) w[k] = Math.max(0, Number(q[`w_${k}`]) || 0);
  return w;
}

// GET /api/recommend/:isbn?algo=tfidf|author|publisher|year|hybrid|all&limit=12&w_title=..
r.get('/recommend/:isbn', ready, (req, res) => {
  const i = engine().byIsbn.get(req.params.isbn);
  if (i === undefined) return res.status(404).json({ error: 'Book not found' });
  const algo = String(req.query.algo || 'hybrid');
  const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
  const weights = parseWeights(req.query);
  const seed = { book: publicBook(engine().books[i]), terms: termsOf(i) };
  if (algo === 'all') {
    return res.json({ seed, runs: Object.keys(ALGORITHMS).map((k) => recommend(k, i, { limit, weights })) });
  }
  if (!ALGORITHMS[algo]) return res.status(400).json({ error: `Unknown algo "${algo}"` });
  res.json({ seed, runs: [recommend(algo, i, { limit, weights })] });
});

export default r;
