import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Book from '../models/Book.js';
import { signToken, requireAuth } from '../auth.js';
import { engine } from '../recommender/engine.js';
import { ALGORITHMS, DEFAULT_WEIGHTS, recommendProfile, publicBook } from '../recommender/algorithms.js';
import { decode } from '../recommender/text.js';

const r = Router();

// Curated, well-known titles from Books.csv for the onboarding "pick books you love" grid.
export const POPULAR_ISBNS = [
  '059035342X', '0345339681', '0385504209', '0446310786', '0451524934', '055321215X',
  '0316769487', '0618129022', '0316666343', '185326041X', '0441172660', '0446605239',
  '0385416342', '0345370775', '0142001740', '0151008116', '0451523415', '0671461494',
  '0451526341', '0330332775', '0062502174', '0345337662', '0743424425', '0440211727',
  '0312195516', '0375400117', '0060809833', '0439136350',
];

export const bookByIsbn = (isbn) => {
  const i = engine().byIsbn.get(isbn);
  return i === undefined ? null : publicBook(engine().books[i]);
};

// Robust asynchronous book resolver with database fallback
export const getBookByIsbn = async (isbn) => {
  if (!isbn) return null;
  const cleanIsbn = String(isbn).trim();
  if (engine().ready && engine().byIsbn.has(cleanIsbn)) {
    const i = engine().byIsbn.get(cleanIsbn);
    return publicBook(engine().books[i]);
  }
  const doc = await Book.findOne({ isbn: cleanIsbn }).lean();
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    ...rest,
    title: decode(doc.title),
    author: decode(doc.author),
    publisher: decode(doc.publisher),
  };
};

export const populateBooks = async (isbns) => {
  if (!Array.isArray(isbns) || isbns.length === 0) return [];
  const list = await Promise.all(isbns.map(getBookByIsbn));
  return list.filter(Boolean);
};

// ---------- auth ----------
r.post('/auth/signup', async (req, res, next) => {
  try {
    const { username: rawUser, password: rawPass, displayName: rawDisplay } = req.body || {};
    const username = String(rawUser || '').trim().toLowerCase();
    const password = String(rawPass || '');
    const displayName = String(rawDisplay || '').trim();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, _ . -' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (displayName.length > 60) return res.status(400).json({ error: 'Display name cannot exceed 60 characters' });
    if (await User.exists({ username })) return res.status(409).json({ error: 'That username is taken' });
    const user = await User.create({ username, displayName, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That username is taken' });
    if (e.name === 'ValidationError') return res.status(400).json({ error: e.message });
    next(e);
  }
});

r.post('/auth/login', async (req, res, next) => {
  try {
    const { username: rawUser, password: rawPass } = req.body || {};
    const username = String(rawUser || '').trim().toLowerCase();
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(String(rawPass || ''), user.passwordHash)))
      return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

// ---------- current user ----------
export const loadUser = async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};

// GET /api/me: User profile + populated shelves + summary stats (100% backward compatible)
r.get('/me', requireAuth, loadUser, async (req, res, next) => {
  try {
    const [favorites, wantToRead, currentlyReading, read] = await Promise.all([
      populateBooks(req.user.favorites),
      populateBooks(req.user.wantToRead),
      populateBooks(req.user.currentlyReading),
      populateBooks(req.user.read),
    ]);
    res.json({
      user: req.user.toPublic(),
      favorites,
      wantToRead,
      currentlyReading,
      read,
      stats: {
        favoritesCount: req.user.favorites.length,
        wantToReadCount: req.user.wantToRead.length,
        currentlyReadingCount: req.user.currentlyReading.length,
        readCount: req.user.read.length,
        totalShelved: req.user.wantToRead.length + req.user.currentlyReading.length + req.user.read.length,
      },
    });
  } catch (e) { next(e); }
});

// GET /api/me/shelves: Populated books partitioned across all shelves
r.get('/me/shelves', requireAuth, loadUser, async (req, res, next) => {
  try {
    const [wantToRead, currentlyReading, read, favorites] = await Promise.all([
      populateBooks(req.user.wantToRead),
      populateBooks(req.user.currentlyReading),
      populateBooks(req.user.read),
      populateBooks(req.user.favorites),
    ]);
    res.json({
      wantToRead,
      currentlyReading,
      read,
      favorites,
      stats: {
        wantToReadCount: req.user.wantToRead.length,
        currentlyReadingCount: req.user.currentlyReading.length,
        readCount: req.user.read.length,
        favoritesCount: req.user.favorites.length,
        totalShelved: req.user.wantToRead.length + req.user.currentlyReading.length + req.user.read.length,
      },
    });
  } catch (e) { next(e); }
});

// PUT /api/me/favorites: Replace favourites (onboarding + editing). 3–5 valid ISBNs.
r.put('/me/favorites', requireAuth, loadUser, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.isbns)) return res.status(400).json({ error: 'isbns must be an array' });
    const isbns = [...new Set(req.body.isbns.map(String))];
    if (isbns.length < 3 || isbns.length > 5) return res.status(400).json({ error: 'Pick between 3 and 5 books' });
    const unknown = isbns.filter((i) => !engine().byIsbn.has(i));
    if (unknown.length) return res.status(400).json({ error: `Unknown ISBN(s): ${unknown.join(', ')}` });
    req.user.favorites = isbns;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

// PUT /api/me/shelf/:isbn: Mutually exclusive status transition
r.put('/me/shelf/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    const { status } = req.body || {};
    const validStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' });
    }

    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    // Mutually exclusive transitions among reading status shelves
    req.user.wantToRead = Array.isArray(req.user.wantToRead) ? req.user.wantToRead.filter((i) => i !== isbn) : [];
    req.user.currentlyReading = Array.isArray(req.user.currentlyReading) ? req.user.currentlyReading.filter((i) => i !== isbn) : [];
    req.user.read = Array.isArray(req.user.read) ? req.user.read.filter((i) => i !== isbn) : [];

    if (status === 'want_to_read') {
      req.user.wantToRead.unshift(isbn);
    } else if (status === 'currently_reading') {
      req.user.currentlyReading.unshift(isbn);
    } else if (status === 'read') {
      req.user.read.unshift(isbn);
    }
    // 'none' remains pulled from all three

    await req.user.save();

    const shelves = {
      favorites: req.user.favorites,
      wantToRead: req.user.wantToRead,
      currentlyReading: req.user.currentlyReading,
      read: req.user.read,
    };

    res.json({
      status,
      isbn,
      user: req.user.toPublic(),
      shelves,
      ...shelves,
    });
  } catch (e) { next(e); }
});

// POST /api/me/want/:isbn: Preserved for backward compatibility with smoke tests
r.post('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    req.user.currentlyReading = req.user.currentlyReading.filter((i) => i !== isbn);
    req.user.read = req.user.read.filter((i) => i !== isbn);
    if (!req.user.wantToRead.includes(isbn)) req.user.wantToRead.unshift(isbn);

    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

// DELETE /api/me/want/:isbn: Preserved for backward compatibility
r.delete('/me/want/:isbn', requireAuth, loadUser, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    req.user.wantToRead = req.user.wantToRead.filter((i) => i !== isbn);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (e) { next(e); }
});

// POST /api/me/reset-books: Reset user's personal shelves and favorites without deleting reviews
r.post('/me/reset-books', requireAuth, loadUser, async (req, res, next) => {
  try {
    req.user.wantToRead = [];
    req.user.currentlyReading = [];
    req.user.read = [];
    req.user.favorites = [];
    await req.user.save();
    res.json({
      success: true,
      message: 'All books and shelves have been reset',
      user: req.user.toPublic(),
      shelves: {
        favorites: [],
        wantToRead: [],
        currentlyReading: [],
        read: [],
      },
    });
  } catch (e) { next(e); }
});

// Personalised recommendations from the user's favourites.
// GET /api/me/recommend?algo=hybrid|tfidf|author|publisher|year|all&limit=&w_*=
r.get('/me/recommend', requireAuth, loadUser, (req, res, next) => {
  try {
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
    if (!keys.every((k) => Object.hasOwn(ALGORITHMS, k))) return res.status(400).json({ error: `Unknown algo "${algo}"` });
    res.json({
      favorites: seeds.map((i) => publicBook(e.books[i])),
      runs: keys.map((k) => recommendProfile(k, seeds, { limit, weights, exclude })),
    });
  } catch (e) {
    next(e);
  }
});

// Onboarding grid
r.get('/books/popular', (req, res) => {
  if (!engine().ready) return res.status(503).json({ error: 'Index is still building' });
  res.json(POPULAR_ISBNS.map(bookByIsbn).filter(Boolean));
});

export default r;
