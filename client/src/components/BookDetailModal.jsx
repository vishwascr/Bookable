import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

export default function BookDetailModal({
  book,
  me = null,
  onClose,
  onExplore = null,
  onSelectSeed = null,
  onOpenReview = null,
  onStatusChange = null,
  onShelfChange = null,
  devMode = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleShelfUpdate = onStatusChange || onShelfChange;
  const handleExploreAction = onExplore || onSelectSeed;

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
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-container detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-detail-title"
      >
        <div className="modal-header">
          <span className="modal-badge">Book Details</span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="detail-modal-body">
          {/* Book Hero Section */}
          <div className="detail-hero">
            <div className="detail-cover-col">
              <Cover src={book.imageL || book.imageM} size="lg" title={book.title} />
              <div className="detail-shelf-btn-wrap">
                <ReadingStatusButton
                  book={book}
                  isbn={book.isbn}
                  me={me}
                  onStatusChange={handleShelfUpdate}
                  size="md"
                />
              </div>
            </div>

            <div className="detail-info-col">
              <h2 id="book-detail-title" className="detail-title">{book.title}</h2>
              <div className="detail-author">by <b>{book.author || 'Unknown'}</b></div>

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

              {handleExploreAction && (
                <div className="detail-actions">
                  <button
                    type="button"
                    className="btn-explore-seed"
                    onClick={() => {
                      onClose();
                      handleExploreAction(book);
                    }}
                  >
                    ✨ Explore Recommendations for this Book →
                  </button>
                </div>
              )}
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
                    {['1', '2', '3', '4', '5'].map((starNum, i) => (
                      <span key={starNum} className={i < Math.round(avg) ? 'star-gold' : 'star-muted'}>
                        ★
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
                    onClick={() => onOpenReview && onOpenReview(book, userReview)}
                  >
                    ✎ Edit Review
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={() => onOpenReview && onOpenReview(book, null)}
                  >
                    ★ Write a Review
                  </button>
                )}
              </div>

              {userReview ? (
                <div className="user-review-card">
                  <div className="user-review-meta">
                    <div className="user-stars">
                      {'★'.repeat(userReview.rating)}
                      <span className="star-muted">{'★'.repeat(Math.max(0, 5 - userReview.rating))}</span>
                    </div>
                    <span className="review-date">
                      {new Date(userReview.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {devMode && userReview.sentiment?.label && (
                      <span className={`sentiment-badge ${userReview.sentiment.label}`}>
                        {userReview.sentiment.label}
                      </span>
                    )}
                  </div>
                  {devMode && userReview.sentiment && (
                    <div className="dev-review-diagnostic-badge">
                      <span className="dev-diag-polarity">
                        Polarity: {(userReview.sentiment.polarity ?? userReview.sentiment.score ?? 0) > 0 ? '+' : ''}
                        {Number(userReview.sentiment.polarity ?? userReview.sentiment.score ?? 0).toFixed(3)}
                      </span>
                      <span className="dev-diag-class">
                        Classification: {userReview.sentiment.classification || userReview.sentiment.label}
                      </span>
                    </div>
                  )}
                  {userReview.text ? (
                    <p className="review-body-text">{userReview.text}</p>
                  ) : (
                    <p className="review-empty-text"><i>(Rated without written text)</i></p>
                  )}
                  {devMode && userReview.sentiment?.keywords?.length > 0 && (
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
                          <span className="star-muted">{'★'.repeat(Math.max(0, 5 - rev.rating))}</span>
                        </div>
                        <span className="review-item-date">
                          {new Date(rev.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {devMode && rev.sentiment?.label && (
                          <span className={`sentiment-badge ${rev.sentiment.label}`}>
                            {rev.sentiment.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {devMode && rev.sentiment && (
                      <div className="dev-review-diagnostic-badge">
                        <span className="dev-diag-polarity">
                          Polarity: {(rev.sentiment.polarity ?? rev.sentiment.score ?? 0) > 0 ? '+' : ''}
                          {Number(rev.sentiment.polarity ?? rev.sentiment.score ?? 0).toFixed(3)}
                        </span>
                        <span className="dev-diag-class">
                          Classification: {rev.sentiment.classification || rev.sentiment.label}
                        </span>
                      </div>
                    )}

                    {rev.text && <p className="review-text-content">{rev.text}</p>}
                    {devMode && rev.sentiment?.keywords?.length > 0 && (
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
