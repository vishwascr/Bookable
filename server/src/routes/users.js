import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../auth.js';
import { engine } from '../recommender/engine.js';
import { ALGORITHMS, DEFAULT_WEIGHTS, recommendProfile, publicBook } from '../recommender/algorithms.js';

const r = Router();

// Curated, well-known titles from Books.csv for the onboarding "pick books you love" grid.
export const POPULAR_ISBNS = [
  '059035342X', '0345339681', '0385504209', '0446310786', '0451524934', '055321215X',
  '0316769487', '0618129022', '0316666343', '185326041X', '0441172660', '0446605239',
  '0385416342', '0345370775', '0142001740', '0151008116', '0451523415', '0671461494',
  '0451526341', '0330332775', '0062502174', '0345337662', '0743424425', '0440211727',
  '0312195516', '0375400117', '0060809833', '0439136350',
];

const bookByIsbn = (isbn) => {
  const i = engine().byIsbn.get(isbn);
  return i === undefined ? null : publicBook(engine().books[i]);
};

// ---------- auth ----------
r.post('/auth/signup', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, _ . -' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.exists({ username })) return res.status(409).json({ error: 'That username is taken' });
    const user = await User.create({ username, displayName, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

r.post('/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash)))
      return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

// ---------- current user ----------
const loadUser = async (req, res, next) => {
  try {
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};

r.get('/me', requireAuth, loadUser, (req, res) => {
  res.json({
    user: req.user.toPublic(),
    favorites: req.user.favorites.map(bookByIsbn).filter(Boolean),
    wantToRead: req.user.wantToRead.map(bookByIsbn).filter(Boolean),
  });
});

// Replace favourites (onboarding + editing). 3–5 valid ISBNs.
r.put('/me/favorites', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbns = [...new Set((req.body.isbns || []).map(String))];
    if (isbns.length < 3 || isbns.length > 5) return res.status(400).json({ error: 'Pick between 3 and 5 books' });
    const unknown = isbns.filter((i) => !engine().byIsbn.has(i));
    if (unknown.length) return res.status(400).json({ error: `Unknown ISBN(s): ${unknown.join(', ')}` });
    req.user.favorites = isbns;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

r.post('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    if (!engine().byIsbn.has(req.params.isbn)) return res.status(404).json({ error: 'Book not found' });
    if (!req.user.wantToRead.includes(req.params.isbn)) req.user.wantToRead.unshift(req.params.isbn);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

r.delete('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    req.user.wantToRead = req.user.wantToRead.filter((i) => i !== req.params.isbn);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

// Personalised recommendations from the user's favourites.
// GET /api/me/recommend?algo=hybrid|tfidf|author|publisher|year|all&limit=&w_*=
r.get('/me/recommend', requireAuth, loadUser, (req, res) => {
  if (!engine().ready) return res.status(503).json({ error: 'Index is still building, try again in a few seconds.' });
  const e = engine();
  const seeds = req.user.favorites.map((i) => e.byIsbn.get(i)).filter((i) => i !== undefined);
  if (seeds.length < 3) return res.status(400).json({ error: 'Pick at least 3 favourite books first' });
  const exclude = req.user.wantToRead.map((i) => e.byIsbn.get(i)).filter((i) => i !== undefined);

  const algo = String(req.query.algo || 'hybrid');
  const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
  const weights = { ...DEFAULT_WEIGHTS };
  for (const k of Object.keys(weights)) if (req.query[`w_${k}`] !== undefined) weights[k] = Math.max(0, Number(req.query[`w_${k}`]) || 0);

  const keys = algo === 'all' ? Object.keys(ALGORITHMS) : [algo];
  if (!keys.every((k) => ALGORITHMS[k])) return res.status(400).json({ error: `Unknown algo "${algo}"` });
  res.json({
    favorites: seeds.map((i) => publicBook(e.books[i])),
    runs: keys.map((k) => recommendProfile(k, seeds, { limit, weights, exclude })),
  });
});

// Onboarding grid
r.get('/books/popular', (req, res) => {
  if (!engine().ready) return res.status(503).json({ error: 'Index is still building' });
  res.json(POPULAR_ISBNS.map(bookByIsbn).filter(Boolean));
});

export default r;
