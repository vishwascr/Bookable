import { Router } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Book from '../models/Book.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { engine } from '../recommender/engine.js';
import { getBookByIsbn } from './users.js';

const r = Router();

const loadUser = async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.user = await User.findById(req.userId);
    if (!req.user) return res.status(401).json({ error: 'Account not found' });
    next();
  } catch (e) { next(e); }
};

// Fallback rule-based sentiment calculation until M2 engine is linked
function computeSentiment(rating, text = '') {
  const score = Number(((rating - 3) / 2).toFixed(2)); // 1 -> -1.0, 3 -> 0, 5 -> 1.0
  const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const words = String(text).toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  return {
    score,
    label,
    keywords: words.slice(0, 5),
  };
}

// GET /api/books/:isbn/reviews: Public ratings & reviews with optional authentication
r.get('/books/:isbn/reviews', optionalAuth, async (req, res, next) => {
  try {
    const isbn = String(req.params.isbn || '').trim();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    const reviews = await Review.find({ isbn }).sort({ createdAt: -1 }).lean();
    const totalReviews = reviews.length;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const rev of reviews) {
      const star = Math.round(rev.rating);
      if (ratingDistribution[star] !== undefined) ratingDistribution[star]++;
      sum += rev.rating;
    }

    const averageRating = totalReviews > 0 ? +(sum / totalReviews).toFixed(1) : 0;
    const userReview = req.userId
      ? reviews.find((rev) => String(rev.userId) === String(req.userId)) || null
      : null;

    res.json({
      isbn,
      averageRating,
      totalReviews,
      ratingCounts: ratingDistribution,
      ratingDistribution,
      reviews,
      userReview,
    });
  } catch (e) { next(e); }
});

// POST /api/books/:isbn/reviews: Submit or update a 1-5 star review, auto-shelve to 'read'
r.post('/books/:isbn/reviews', requireAuth, loadUser, async (req, res, next) => {
  try {
    const { rating, text: rawText } = req.body || {};
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    if (rawText !== undefined && typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Review text must be a string' });
    }

    const text = (rawText || '').trim();
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Review text cannot exceed 5000 characters' });
    }

    const isbn = String(req.params.isbn || '').trim();
    const exists = (engine().ready && engine().byIsbn.has(isbn)) || (await Book.exists({ isbn }));
    if (!exists) return res.status(404).json({ error: 'Book not found' });

    // Try using M2 sentiment engine if available, otherwise use local heuristic
    let sentiment = computeSentiment(rating, text);
    try {
      const sentimentModule = await import('../recommender/sentiment.js');
      const sentimentFn = sentimentModule.analyzeReviewSentiment || sentimentModule.analyzeSentiment;
      if (typeof sentimentFn === 'function') {
        sentiment = sentimentFn(text, rating);
      }
    } catch {}

    // Upsert review
    const review = await Review.findOneAndUpdate(
      { userId: req.user._id, isbn },
      {
        $set: {
          userId: req.user._id,
          username: req.user.username,
          displayName: req.user.displayName || req.user.username,
          isbn,
          rating,
          text,
          sentiment,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Auto-transition to 'read' shelf; pull from 'wantToRead' and 'currentlyReading'
    req.user.wantToRead = Array.isArray(req.user.wantToRead) ? req.user.wantToRead.filter((i) => i !== isbn) : [];
    req.user.currentlyReading = Array.isArray(req.user.currentlyReading) ? req.user.currentlyReading.filter((i) => i !== isbn) : [];
    if (!Array.isArray(req.user.read)) req.user.read = [];
    if (!req.user.read.includes(isbn)) req.user.read.unshift(isbn);
    await req.user.save();

    // Compute updated stats
    const allReviews = await Review.find({ isbn }).lean();
    const totalReviews = allReviews.length;
    const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = totalReviews > 0 ? +(sum / totalReviews).toFixed(1) : 0;
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allReviews) {
      const star = Math.round(r.rating);
      if (ratingCounts[star] !== undefined) ratingCounts[star]++;
    }

    const shelves = {
      favorites: req.user.favorites,
      wantToRead: req.user.wantToRead,
      currentlyReading: req.user.currentlyReading,
      read: req.user.read,
    };

    res.status(201).json({
      review,
      stats: {
        averageRating,
        totalReviews,
        ratingCounts,
        ratingDistribution: ratingCounts,
      },
      shelves,
    });
  } catch (e) { next(e); }
});

// DELETE /api/reviews/:id: Authenticated deletion with strict IDOR ownership check
r.delete('/reviews/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (String(review.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'You do not have permission to delete this review' });
    }

    await Review.findByIdAndDelete(id);
    res.status(204).end();
  } catch (e) { next(e); }
});

// GET /api/me/reviews: Authenticated user's reviews populated with book catalog details
r.get('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Invalid user session' });
    }
    const reviews = await Review.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    const populated = await Promise.all(
      reviews.map(async (rev) => ({
        ...rev,
        book: await getBookByIsbn(rev.isbn),
      }))
    );
    res.json({
      total: populated.length,
      reviews: populated,
    });
  } catch (e) { next(e); }
});

// DELETE /api/me/reviews: Settings endpoint - delete all reviews written by user without resetting shelves
r.delete('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Invalid user session' });
    }
    const result = await Review.deleteMany({ userId: req.userId });
    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: `Successfully deleted ${result.deletedCount || 0} review(s)`,
    });
  } catch (e) { next(e); }
});

export default r;
