import { Router } from 'express';
import Book from '../models/Book.js';
import { engine, termsOf } from '../recommender/engine.js';
import { decode } from '../recommender/text.js';
import { ALGORITHMS, DEFAULT_WEIGHTS, recommend, publicBook } from '../recommender/algorithms.js';

const r = Router();

const ready = (req, res, next) =>
  engine().ready ? next() : res.status(503).json({ error: 'Index is still building, try again in a few seconds.' });

r.get('/health', (req, res) => res.json({ ok: true, ready: engine().ready, stats: engine().stats }));

r.get('/algorithms', (req, res) =>
  res.json({
    defaultWeights: DEFAULT_WEIGHTS,
    algorithms: Object.entries(ALGORITHMS).map(([key, a]) => ({ key, name: a.name, short: a.short, formula: a.formula, explain: a.explain })),
  })
);

// GET /api/books/search?q=harry potter&limit=20
r.get('/books/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    if (q.length < 2) return res.json([]);
    const docs = await Book.find({ $text: { $search: q } }, { score: { $meta: 'textScore' }, _id: 0 })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
    res.json(docs.map(({ score, ...d }) => ({ ...d, title: decode(d.title), author: decode(d.author), publisher: decode(d.publisher) })));
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
