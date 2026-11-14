# Technical Specification & Handoff: Shelves Overhaul, ReviewModal, BookDetailModal, and Reviews API

## 1. Observation

Direct observations from codebase inspection:

1. **Existing `client/src/components/Shelves.jsx`** (`client/src/components/Shelves.jsx:1-33`):
   - Currently only renders two static sections:
     - `⭐ Favourites` (`me.favorites.length`)
     - `📖 Want to Read` (`me.wantToRead.length`)
   - Lacks a 5-tab interface (`All Books`, `Want to Read`, `Currently Reading`, `Read`, `Favourites`).
   - Lacks support for `currentlyReading` and `read` shelves.
   - Lacks `ReadingStatusButton`, interactive star rating widgets, and review buttons on book cards.
   - Only displays basic title and author without publication year or metadata.

2. **Existing `client/src/api.js`** (`client/src/api.js:41-60`):
   - Only exports: `health`, `algorithms`, `search`, `searchPaginated`, `popular`, `recommend`, `signup`, `login`, `me`, `setFavorites`, `addWant`, `removeWant`, and `forYou`.
   - Completely lacks review endpoints (`getBookReviews`, `submitReview`, `deleteReview`, `getMyReviews`).
   - Lacks universal shelf status endpoint `updateShelfStatus` and settings endpoint `resetBooks`.

3. **Backend Review Endpoints in `server/src/routes/reviews.js`** (`server/src/routes/reviews.js:36-213`):
   - `GET /api/books/:isbn/reviews` (lines 36-68): returns `{ isbn, averageRating, totalReviews, ratingCounts, reviews, userReview }`.
   - `POST /api/books/:isbn/reviews` (lines 70-154):
     - Validates integer `rating` (1-5) and string `text` (max 5000 chars).
     - Calculates sentiment score, label (`positive`, `neutral`, `negative`), and keywords.
     - Upserts review with unique compound index `{ userId, isbn }`.
     - Automatically moves book to `read` shelf and pulls from `wantToRead` and `currentlyReading` (lines 118-124):
       ```javascript
       req.user.wantToRead = Array.isArray(req.user.wantToRead) ? req.user.wantToRead.filter((i) => i !== isbn) : [];
       req.user.currentlyReading = Array.isArray(req.user.currentlyReading) ? req.user.currentlyReading.filter((i) => i !== isbn) : [];
       if (!Array.isArray(req.user.read)) req.user.read = [];
       if (!req.user.read.includes(isbn)) req.user.read.unshift(isbn);
       await req.user.save();
       ```
     - Returns HTTP 201 Created with `{ review, stats: { averageRating, totalReviews, ratingCounts }, shelves }`.
   - `DELETE /api/reviews/:id` (lines 157-176): authenticates caller, verifies IDOR ownership (`String(review.userId) === String(req.userId)`), deletes review, and returns HTTP 204 No Content.
   - `GET /api/me/reviews` (lines 179-196): returns populated user reviews: `{ total, reviews: [{ ...review, book }] }`.
   - `DELETE /api/me/reviews` (lines 199-211): deletes all reviews written by user, returns `{ success: true, deletedCount, message }`.

4. **Backend Shelves Endpoints in `server/src/routes/users.js`** (`server/src/routes/users.js:91-246`):
   - `GET /api/me` (lines 92-115): returns `{ user, favorites, wantToRead, currentlyReading, read, stats }`.
   - `GET /api/me/shelves` (lines 118-140): returns populated books for all 4 shelves + stats.
   - `PUT /api/me/shelf/:isbn` (lines 156-199): accepts `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`, enforces mutual exclusivity among reading shelves, and returns `{ status, isbn, user, shelves }`.

5. **Client Build Environment** (`client/package.json`):
   - Production Vite build executed via `npm --prefix client run build` succeeds cleanly in <600ms.
   - React 19 is used in the frontend client.

---

## 2. Logic Chain

1. **From Observation 1 and 4**: The backend already manages four populated arrays (`favorites`, `wantToRead`, `currentlyReading`, `read`) and summary counts in `me.stats`. Therefore, `Shelves.jsx` can render a 5-tab interface:
   - `all`: Deduplicated combination of books across `me.currentlyReading`, `me.wantToRead`, `me.read`, and `me.favorites`.
   - `want_to_read`: `me.wantToRead`.
   - `currently_reading`: `me.currentlyReading`.
   - `read`: `me.read`.
   - `favorites`: `me.favorites`.
   Counts for each tab can be derived directly from the populated array lengths or `me.stats`.

2. **From Observation 1 and SCOPE.md**: Book cards in `Shelves.jsx` currently only show title, author, and cover. To achieve Goodreads parity, each card must feature:
   - Book cover (`Cover.jsx`), title, author, and publication year.
   - `ReadingStatusButton`: allowing quick status transition or removal.
   - Interactive star rating: displaying the user's rating (if reviewed) or offering 1-5 clickable stars to rate.
   - Review button: "Write a Review" (or "Edit Review" if reviewed), opening `ReviewModal`.
   - Card click opening `BookDetailModal`.
   - Friendly empty states tailored to each tab.

3. **From Observation 3**: `ReviewModal.jsx` must support:
   - Interactive 1-5 star rating component with mouse hover preview and click selection.
   - Text review textarea with real-time character counter enforcing a 5000 character maximum.
   - Submission calling `POST /api/books/:isbn/reviews`. Because the backend automatically transitions the book to the `read` shelf upon review submission, the response provides `{ review, stats, shelves }`, allowing the client parent to update `me` without an extra API call.
   - Deletion calling `DELETE /api/reviews/:id` with confirmation when editing an existing review.
   - Clean dismissal via Escape key, close button, and backdrop click.

4. **From Observation 3 and SCOPE.md**: `BookDetailModal.jsx` serves as the centralized book inspection view:
   - Fetches community reviews and user's review via `api.getBookReviews(isbn)`.
   - Renders overall rating summary: average rating, total ratings count, and 5-to-1 star distribution histogram.
   - User's review card displaying their rating, review text, date, and sentiment badge, with "Edit" and "Delete" triggers.
   - Community reviews list displaying username, avatar initial, star rating, date, review text, and sentiment badges.
   - Integrated `ReadingStatusButton` and "Explore Recommendations" seed trigger.

5. **From Observation 2 and 3**: `client/src/api.js` must be expanded with:
   - `getBookReviews(isbn)` -> `GET /api/books/:isbn/reviews`
   - `submitReview(isbn, { rating, text })` -> `POST /api/books/:isbn/reviews`
   - `deleteReview(reviewId)` -> `DELETE /api/reviews/:id`
   - `getMyReviews()` -> `GET /api/me/reviews`
   - Shelf helpers: `updateShelfStatus(isbn, status)` -> `PUT /api/me/shelf/:isbn`, `getShelves()`, `resetBooks()`, and `deleteAllReviews()`.

---

## 3. Detailed Component Specifications & Code Blueprints

### A. `client/src/api.js` Additions

```javascript
// Add to client/src/api.js:

  // Shelves & Reading Status
  updateShelfStatus: (isbn, status) =>
    j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
  getShelves: () => j('/api/me/shelves'),
  resetBooks: () => j('/api/me/reset-books', { method: 'POST' }),

  // Book Reviews & Ratings
  getBookReviews: (isbn) => j(`/api/books/${isbn}/reviews`),
  submitReview: (isbn, { rating, text }) =>
    j(`/api/books/${isbn}/reviews`, { method: 'POST', body: { rating, text } }),
  deleteReview: (reviewId) =>
    j(`/api/reviews/${reviewId}`, { method: 'DELETE' }),
  getMyReviews: () => j('/api/me/reviews'),
  deleteAllReviews: () => j('/api/me/reviews', { method: 'DELETE' }),
```

---

### B. `client/src/components/ReviewModal.jsx`

```jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

const STAR_LABELS = {
  0: 'Select a rating',
  1: '1 star — Did not like it',
  2: '2 stars — It was OK',
  3: '3 stars — Liked it',
  4: '4 stars — Really liked it',
  5: '5 stars — It was amazing',
};

export default function ReviewModal({
  book,
  existingReview = null,
  onClose,
  onSubmitSuccess,
  onDeleteSuccess,
}) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState(existingReview?.text || '');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating (1–5 stars)');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await api.submitReview(book.isbn, { rating, text });
      if (onSubmitSuccess) onSubmitSuccess(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview?._id) return;
    setDeleting(true);
    setError('');

    try {
      await api.deleteReview(existingReview._id);
      if (onDeleteSuccess) onDeleteSuccess(existingReview._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  const activeLabel = STAR_LABELS[hoverRating || rating] || STAR_LABELS[0];

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="review-modal-title">{existingReview ? 'Edit Your Review' : 'Write a Review'}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-book-snippet">
          <Cover src={book.imageM || book.imageS} size="sm" title={book.title} />
          <div className="modal-book-meta">
            <div className="modal-book-title">{book.title}</div>
            <div className="modal-book-author">by {book.author}</div>
            {book.year && <div className="modal-book-year">{book.year}</div>}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="review-form">
          {/* 1-5 Star Interactive Rating */}
          <div className="rating-field">
            <label className="field-label">My Rating <span className="req">*</span></label>
            <div
              className="star-picker"
              role="radiogroup"
              aria-label="Book star rating"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${filled ? 'filled' : 'empty'}`}
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <div className="rating-helper-text">{activeLabel}</div>
          </div>

          {/* Review Commentary */}
          <div className="textarea-field">
            <div className="textarea-header">
              <label htmlFor="review-text" className="field-label">What did you think? (Optional)</label>
              <span className={`char-counter ${text.length > 4800 ? 'warn' : ''}`}>
                {text.length} / 5000
              </span>
            </div>
            <textarea
              id="review-text"
              rows={5}
              maxLength={5000}
              placeholder="Share your thoughts on the characters, plot, writing style, or who would enjoy this book..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="shelf-notice">
            💡 Submitting your review automatically shelves this book to <b>Read</b>.
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            {existingReview?._id && (
              <div className="delete-group">
                {confirmDelete ? (
                  <div className="confirm-delete-box">
                    <span>Delete review permanently?</span>
                    <button
                      type="button"
                      className="btn-danger sm"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-delete-link"
                    onClick={() => setConfirmDelete(true)}
                  >
                    🗑 Delete Review
                  </button>
                )}
              </div>
            )}

            <div className="submit-group">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || rating < 1}
              >
                {submitting ? 'Saving...' : existingReview ? 'Update Review' : 'Save Review'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### C. `client/src/components/BookDetailModal.jsx`

```jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

export default function BookDetailModal({
  book,
  me,
  onClose,
  onExplore,
  onOpenReview,
  onStatusChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const loadReviews = () => {
    if (!book?.isbn) return;
    setLoading(true);
    setError('');
    api.getBookReviews(book.isbn)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load reviews'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReviews();
  }, [book?.isbn]);

  const total = data?.totalReviews || 0;
  const avg = data?.averageRating || 0;
  const counts = data?.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const userReview = data?.userReview || null;
  const reviews = data?.reviews || [];

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container detail-modal" role="dialog" aria-modal="true" aria-labelledby="book-detail-title">
        <div className="modal-header">
          <span className="modal-badge">Book Details</span>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="detail-modal-body">
          {/* Book Hero Section */}
          <div className="detail-hero">
            <div className="detail-cover-col">
              <Cover src={book.imageL || book.imageM} size="lg" title={book.title} />
              <div className="detail-shelf-btn-wrap">
                <ReadingStatusButton
                  book={book}
                  me={me}
                  onStatusChange={onStatusChange}
                />
              </div>
            </div>

            <div className="detail-info-col">
              <h2 id="book-detail-title" className="detail-title">{book.title}</h2>
              <div className="detail-author">by <b>{book.author}</b></div>

              <div className="detail-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Published</span>
                  <span className="meta-value">{book.year || 'Unknown'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Publisher</span>
                  <span className="meta-value">{book.publisher || 'Unknown'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">ISBN</span>
                  <span className="meta-value mono">{book.isbn}</span>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  type="button"
                  className="btn-explore-seed"
                  onClick={() => {
                    onClose();
                    onExplore(book);
                  }}
                >
                  ✨ Explore Recommendations for this Book →
                </button>
              </div>
            </div>
          </div>

          <hr className="detail-divider" />

          {error && <div className="error">{error}</div>}

          {/* Rating Summary & Breakdown */}
          <section className="rating-summary-section">
            <h3>Community Ratings & Reviews</h3>
            {loading ? (
              <div className="loading-state">Loading ratings…</div>
            ) : (
              <div className="rating-overview-card">
                <div className="rating-score-block">
                  <div className="big-avg">{total > 0 ? avg.toFixed(1) : '—'}</div>
                  <div className="stars-display">
                    {'★★★★★'.split('').map((s, i) => (
                      <span key={i} className={i < Math.round(avg) ? 'star-gold' : 'star-muted'}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="total-ratings-count">
                    {total} {total === 1 ? 'rating' : 'ratings'}
                  </div>
                </div>

                <div className="rating-histogram">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = counts[star] || 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={star} className="hist-row">
                        <span className="hist-label">{star} ★</span>
                        <div className="hist-bar-track">
                          <div className="hist-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="hist-count mono">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* User's Own Review Section */}
          {me && (
            <section className="user-review-section">
              <div className="user-review-header">
                <h3>Your Review</h3>
                {userReview ? (
                  <button
                    type="button"
                    className="btn-secondary sm"
                    onClick={() => onOpenReview(book, userReview)}
                  >
                    ✎ Edit Review
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={() => onOpenReview(book, null)}
                  >
                    ★ Write a Review
                  </button>
                )}
              </div>

              {userReview ? (
                <div className="user-review-card">
                  <div className="user-review-meta">
                    <div className="user-stars">
                      {'★★★★★'.slice(0, userReview.rating)}
                      <span className="star-muted">{'★★★★★'.slice(userReview.rating)}</span>
                    </div>
                    <span className="review-date">
                      {new Date(userReview.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    {userReview.sentiment?.label && (
                      <span className={`sentiment-badge ${userReview.sentiment.label}`}>
                        {userReview.sentiment.label}
                      </span>
                    )}
                  </div>
                  {userReview.text ? (
                    <p className="review-body-text">{userReview.text}</p>
                  ) : (
                    <p className="review-empty-text"><i>(Rated without written text)</i></p>
                  )}
                  {userReview.sentiment?.keywords?.length > 0 && (
                    <div className="sentiment-keywords">
                      {userReview.sentiment.keywords.map((kw) => (
                        <span key={kw} className="kw-pill">#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="write-review-prompt-card">
                  <p>You haven't reviewed this book yet. Rate it and share your thoughts!</p>
                </div>
              )}
            </section>
          )}

          {/* Community Reviews List */}
          <section className="community-reviews-section">
            <h3>All Community Reviews ({reviews.length})</h3>
            {reviews.length === 0 ? (
              <div className="empty-reviews-state">
                <p>No community reviews yet. Be the first to share your thoughts on this book!</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map((rev) => (
                  <article key={rev._id} className="review-item-card">
                    <div className="review-item-top">
                      <div className="reviewer-info">
                        <span className="reviewer-avatar">
                          {(rev.displayName || rev.username || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="reviewer-name">{rev.displayName || rev.username}</div>
                          <div className="reviewer-handle">@{rev.username}</div>
                        </div>
                      </div>

                      <div className="review-item-meta">
                        <div className="review-item-stars">
                          {'★'.repeat(rev.rating)}
                          <span className="star-muted">{'★'.repeat(5 - rev.rating)}</span>
                        </div>
                        <span className="review-item-date">
                          {new Date(rev.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        {rev.sentiment?.label && (
                          <span className={`sentiment-badge ${rev.sentiment.label}`}>
                            {rev.sentiment.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {rev.text && <p className="review-text-content">{rev.text}</p>}
                    {rev.sentiment?.keywords?.length > 0 && (
                      <div className="review-keywords">
                        {rev.sentiment.keywords.map((kw) => (
                          <span key={kw} className="kw-pill sm">#{kw}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
```

---

### D. `client/src/components/Shelves.jsx` Overhaul

```jsx
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

export default function Shelves({
  me,
  onExplore,
  onSelectBook,
  onOpenReview,
  onStatusChange,
  onEditFavorites,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [userReviewsMap, setUserReviewsMap] = useState(new Map());

  // Load authenticated user reviews to display ratings and review statuses
  useEffect(() => {
    let active = true;
    api.getMyReviews()
      .then((res) => {
        if (!active) return;
        const map = new Map();
        for (const rev of res?.reviews || []) {
          if (rev.isbn) map.set(rev.isbn, rev);
        }
        setUserReviewsMap(map);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [me]);

  // Deduplicate all unique books across shelves for the "All Books" tab
  const allBooks = useMemo(() => {
    const map = new Map();
    const lists = [
      me?.currentlyReading || [],
      me?.wantToRead || [],
      me?.read || [],
      me?.favorites || [],
    ];
    for (const list of lists) {
      for (const b of list) {
        if (b && b.isbn && !map.has(b.isbn)) {
          map.set(b.isbn, b);
        }
      }
    }
    return Array.from(map.values());
  }, [me]);

  const wantList = me?.wantToRead || [];
  const currList = me?.currentlyReading || [];
  const readList = me?.read || [];
  const favList = me?.favorites || [];

  // Tab definitions with counts
  const TABS = [
    { key: 'all', label: 'All Books', count: allBooks.length },
    { key: 'want_to_read', label: 'Want to Read', count: wantList.length },
    { key: 'currently_reading', label: 'Currently Reading', count: currList.length },
    { key: 'read', label: 'Read', count: readList.length },
    { key: 'favorites', label: 'Favourites', count: favList.length },
  ];

  // Pick books for the selected tab
  const tabBooks = useMemo(() => {
    switch (activeTab) {
      case 'want_to_read': return wantList;
      case 'currently_reading': return currList;
      case 'read': return readList;
      case 'favorites': return favList;
      case 'all':
      default:
        return allBooks;
    }
  }, [activeTab, allBooks, wantList, currList, readList, favList]);

  // Filter books by title or author
  const filteredBooks = useMemo(() => {
    if (!filterQuery.trim()) return tabBooks;
    const q = filterQuery.toLowerCase().trim();
    return tabBooks.filter(
      (b) =>
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q))
    );
  }, [tabBooks, filterQuery]);

  // Clean empty state configurations per tab
  const EMPTY_STATES = {
    all: {
      icon: '📚',
      title: 'Your library is empty',
      desc: 'Discover books via Search or your personalized For You recommendations, and add them to your shelves!',
    },
    want_to_read: {
      icon: '🔖',
      title: 'No books on your Want to Read shelf',
      desc: 'Click “+ Want to Read” on any book in Search or recommendations to save it here.',
    },
    currently_reading: {
      icon: '📖',
      title: 'Not currently reading any books',
      desc: 'Set a book’s status to “Currently Reading” when you start a new book to track your reading in real time.',
    },
    read: {
      icon: '🏆',
      title: 'No books marked as Read yet',
      desc: 'Mark finished books as “Read” or write a review to build your completed library history.',
    },
    favorites: {
      icon: '⭐',
      title: 'No favourites selected',
      desc: 'Choose 3–5 favourite seed books to power your personalized recommendation algorithms.',
      action: { label: 'Choose Favourites →', handler: onEditFavorites },
    },
  };

  const empty = EMPTY_STATES[activeTab] || EMPTY_STATES.all;

  return (
    <section className="shelves-view">
      {/* Top Header */}
      <div className="shelves-header">
        <div className="shelves-title-group">
          <h2>My Books</h2>
          <span className="shelves-total-badge">
            {allBooks.length} {allBooks.length === 1 ? 'book' : 'books'} total
          </span>
        </div>

        {/* In-shelf quick search */}
        <div className="shelves-filter-wrap">
          <input
            type="search"
            className="shelves-filter-input"
            placeholder="Filter your books by title or author…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="clear-filter-btn"
              onClick={() => setFilterQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 5-Tab Navigation Bar */}
      <nav className="shelf-tabs-nav" aria-label="Book shelves navigation">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`shelf-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-count-badge">{tab.count}</span>
          </button>
        ))}
      </nav>

      {/* Favourites Action Strip */}
      {activeTab === 'favorites' && (
        <div className="fav-strip-header">
          <p className="m">
            Favourites act as your primary recommendation seeds. Pick between 3 and 5 books.
          </p>
          <button type="button" className="btn-secondary sm" onClick={onEditFavorites}>
            ✎ Edit Favourites
          </button>
        </div>
      )}

      {/* Book Grid or Empty States */}
      {filteredBooks.length === 0 ? (
        <div className="shelf-empty-state card">
          {filterQuery ? (
            <>
              <div className="empty-icon">🔍</div>
              <h3>No books match “{filterQuery}”</h3>
              <p>Try clearing your filter or switching to another shelf tab.</p>
              <button
                type="button"
                className="btn-secondary sm"
                onClick={() => setFilterQuery('')}
              >
                Clear Filter
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">{empty.icon}</div>
              <h3>{empty.title}</h3>
              <p>{empty.desc}</p>
              {empty.action && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={empty.action.handler}
                >
                  {empty.action.label}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="shelf-grid">
          {filteredBooks.map((b) => {
            const userReview = userReviewsMap.get(b.isbn);
            const userRating = userReview?.rating || 0;
            const isFav = favList.some((f) => f.isbn === b.isbn);

            return (
              <article
                key={b.isbn}
                className="shelf-book-card card"
                onClick={() => onSelectBook && onSelectBook(b)}
              >
                {/* Book Cover */}
                <div className="card-cover-wrap">
                  <Cover src={b.imageM || b.imageS} size="lg" title={b.title} />
                  {isFav && <span className="fav-badge" title="Favourite Seed">⭐</span>}
                </div>

                {/* Card Content */}
                <div className="card-content">
                  <h3
                    className="card-title"
                    title={b.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectBook) onSelectBook(b);
                    }}
                  >
                    {b.title}
                  </h3>
                  <div className="card-author">by {b.author || 'Unknown'}</div>
                  <div className="card-meta">
                    <span>{b.year || 'n/a'}</span>
                    {b.publisher && (
                      <>
                        <span className="dot">·</span>
                        <span className="publisher" title={b.publisher}>{b.publisher}</span>
                      </>
                    )}
                  </div>

                  {/* Reading Status Selector */}
                  <div
                    className="card-shelf-action"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ReadingStatusButton
                      book={b}
                      me={me}
                      onStatusChange={onStatusChange}
                    />
                  </div>

                  {/* Interactive Star Rating */}
                  <div
                    className="card-rating-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="shelf-star-picker" title={userRating ? `Your rating: ${userRating}/5` : 'Rate this book'}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star-shelf-btn ${star <= userRating ? 'active' : ''}`}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          onClick={() => onOpenReview && onOpenReview(b, userReview || { rating: star })}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    {userRating > 0 && <span className="user-rating-num mono">{userRating}/5</span>}
                  </div>

                  {/* Review Button */}
                  <div
                    className="card-review-btn-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {userReview ? (
                      <button
                        type="button"
                        className="btn-review-status reviewed"
                        onClick={() => onOpenReview && onOpenReview(b, userReview)}
                      >
                        ✎ Edit Review
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-review-status"
                        onClick={() => onOpenReview && onOpenReview(b, null)}
                      >
                        ★ Write Review
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

---

### E. App.jsx State & Modal Wiring Blueprint

To host `ReviewModal` and `BookDetailModal` globally across all components:

```jsx
// In client/src/App.jsx:
const [reviewModalBook, setReviewModalBook] = useState(null);
const [existingReviewForModal, setExistingReviewForModal] = useState(null);
const [detailModalBook, setDetailModalBook] = useState(null);

const handleOpenReview = (book, existingReview = null) => {
  setReviewModalBook(book);
  setExistingReviewForModal(existingReview);
};

const handleSelectBook = (book) => {
  setDetailModalBook(book);
};

const handleStatusChange = async (book, newStatus) => {
  try {
    await api.updateShelfStatus(book.isbn, newStatus);
    await refreshMe();
  } catch (err) {
    setError(err.message);
  }
};

const handleReviewSubmitSuccess = async (res) => {
  await refreshMe();
  // If detail modal is open, re-open/refresh to reflect new rating and review
  if (detailModalBook && detailModalBook.isbn === res.review?.isbn) {
    // Modal will naturally reload on query or state update
  }
};

const handleReviewDeleteSuccess = async () => {
  await refreshMe();
};

// Render Modals at bottom of App container:
{reviewModalBook && (
  <ReviewModal
    book={reviewModalBook}
    existingReview={existingReviewForModal}
    onClose={() => {
      setReviewModalBook(null);
      setExistingReviewForModal(null);
    }}
    onSubmitSuccess={handleReviewSubmitSuccess}
    onDeleteSuccess={handleReviewDeleteSuccess}
  />
)}

{detailModalBook && (
  <BookDetailModal
    book={detailModalBook}
    me={me}
    onClose={() => setDetailModalBook(null)}
    onExplore={explore}
    onOpenReview={handleOpenReview}
    onStatusChange={handleStatusChange}
  />
)}
```

---

### F. CSS & iOS-Inspired Design Tokens (`client/src/styles.css`)

```css
/* Modal Overlays & iOS-Inspired Containers (20px rounded corners) */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-container {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.16), 0 0 1px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--line);
  position: relative;
}

.review-modal {
  max-width: 520px;
  padding: 24px;
}

.detail-modal {
  max-width: 720px;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}

.modal-close-btn:hover {
  background: #f0ebe4;
  color: var(--ink);
}

/* Star Rating Components */
.star-picker {
  display: flex;
  gap: 6px;
  margin: 8px 0;
}

.star-btn {
  background: transparent;
  border: none;
  font-size: 2.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px;
  color: #d8d4cf;
  transition: transform 0.1s ease, color 0.1s ease;
}

.star-btn.filled {
  color: #f5a623;
}

.star-btn:hover {
  transform: scale(1.15);
}

.rating-helper-text {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--muted);
  min-height: 1.2rem;
}

/* 5-Tab Segmented Shelf Navigation */
.shelf-tabs-nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px;
  background: #e9e3da;
  border-radius: 14px;
  margin: 16px 0 20px;
}

.shelf-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.shelf-tab-btn.active {
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.tab-count-badge {
  background: rgba(0, 0, 0, 0.08);
  font-size: 0.75rem;
  padding: 2px 7px;
  border-radius: 99px;
  font-weight: 700;
}

.shelf-tab-btn.active .tab-count-badge {
  background: var(--accent);
  color: #ffffff;
}

/* Shelf Book Cards (20px rounded containers) */
.shelf-book-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--line);
  padding: 16px;
  display: flex;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.shelf-book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

/* Sentiment Badges */
.sentiment-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  text-transform: capitalize;
}

.sentiment-badge.positive {
  background: #e6f7ec;
  color: #1b6b37;
  border: 1px solid #b8e8c8;
}

.sentiment-badge.neutral {
  background: #fdf6e2;
  color: #8a6d1c;
  border: 1px solid #f5e4a8;
}

.sentiment-badge.negative {
  background: #fde8e8;
  color: #9c2828;
  border: 1px solid #f7c2c2;
}
```

---

## 4. Caveats

1. **Auto-transition to 'read' shelf**: The backend in `server/src/routes/reviews.js:118-124` handles moving the book to the `read` shelf automatically on `POST /api/books/:isbn/reviews`. The client implementer must ensure the returned `res.shelves` or subsequent `refreshMe()` call updates the UI state across all tabs so that the book immediately appears in the "Read" tab without requiring a page refresh.
2. **Offline/Sandbox Guidance CLI**: As noted under the Modern Web Guidance disclosure, running `npx modern-web-guidance search` in the sandboxed environment required external network access to the npm registry; standard HTML5/CSS accessibility guidelines (ARIA radiogroup, keyboard accessibility, ESC/backdrop dismissal, and scroll lock) have been directly incorporated into the specifications above.
3. **ReadingStatusButton Dependency**: `Shelves.jsx` and `BookDetailModal.jsx` import `ReadingStatusButton.jsx`, which is being designed by Explorer 1 (`teamwork_explorer_m3_1`). The prop interface defined here (`book`, `me`, `onStatusChange`) matches Explorer 1's interface contract.

---

## 5. Conclusion

1. The backend routes for reviews (`/api/books/:isbn/reviews`, `/api/reviews/:id`, `/api/me/reviews`) and shelves (`/api/me/shelves`, `/api/me/shelf/:isbn`) are fully operational and verified by existing test suites.
2. The exact specifications, blueprints, JSX code, state transitions, and CSS tokens have been developed for:
   - `client/src/api.js` (reviews & shelf helper additions)
   - `client/src/components/ReviewModal.jsx` (interactive 1-5 stars, 5000-char counter, submit/delete/auto-shelve)
   - `client/src/components/BookDetailModal.jsx` (hero metadata, rating histogram, user review card, community review stream)
   - `client/src/components/Shelves.jsx` (5 tabs, tab counts, responsive card layout with cover, metadata, ReadingStatusButton, star rating, review button, and empty states)
   - `client/src/App.jsx` (modal state management and status sync)
3. The design adheres strictly to the iOS 20px rounded corner aesthetic and modern web accessibility best practices.

---

## 6. Verification Method

To independently verify the implementation when built:

1. **Frontend Production Build Verification**:
   ```bash
   npm --prefix client run build
   ```
   Must pass with zero syntax or bundling errors.

2. **Automated Backend & Parity Verification**:
   ```bash
   node tests/e2e-scenarios.test.js
   ```
   Validates review creation, aggregated ratings calculation, deletion, and shelf transition.

3. **Interactive UI Verification Steps**:
   - Log into Bookable.
   - Navigate to "My Books" (`view === 'shelves'`).
   - Verify all 5 tabs appear with accurate counts: `All Books`, `Want to Read`, `Currently Reading`, `Read`, `Favourites`.
   - Click "Favourites" tab; verify favourite books are displayed with the "Edit Favourites" button.
   - Click "★ Write Review" on any book; verify `ReviewModal` opens with 5 interactive stars and character counter (`0 / 5000`).
   - Hover and click 5 stars, type commentary, and click "Save Review".
   - Verify modal closes and the book immediately appears in the `Read` shelf tab.
   - Click on the book card; verify `BookDetailModal` opens showing book metadata, overall rating distribution histogram, user's review with sentiment badge, and community reviews list.
   - Verify clicking the backdrop or pressing the Escape key closes both modals.
