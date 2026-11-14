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
  onSubmitSuccess = null,
  onDeleteSuccess = null,
  onReviewSaved = null,
  onSentimentAnalyzed = null,
  devMode = false,
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
      if (e.key === 'Escape' && !submitting && !deleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, submitting, deleting]);

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
      if (res?.review?.sentiment && onSentimentAnalyzed) {
        onSentimentAnalyzed({
          ...res.review.sentiment,
          bookTitle: book.title,
          author: book.author,
          rating,
          text,
          timestamp: new Date().toISOString(),
        });
      }
      if (onSubmitSuccess) onSubmitSuccess(res);
      if (onReviewSaved) onReviewSaved(res);
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
      if (onReviewSaved) onReviewSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  const activeLabel = STAR_LABELS[hoverRating || rating] || STAR_LABELS[0];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !deleting) onClose();
      }}
    >
      <div
        className="modal-container review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="review-modal-title">
              {existingReview?._id ? 'Edit Your Review' : 'Write a Review'}
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={submitting || deleting}
          >
            ✕
          </button>
        </div>

        <div className="modal-book-snippet">
          <Cover src={book.imageM || book.imageS} size="sm" title={book.title} />
          <div className="modal-book-meta">
            <div className="modal-book-title">{book.title}</div>
            <div className="modal-book-author">by {book.author || 'Unknown'}</div>
            {book.year && <div className="modal-book-year">{book.year}</div>}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="review-form">
          {/* 1-5 Star Interactive Rating */}
          <div className="rating-field">
            <label className="field-label">
              My Rating <span className="req">*</span>
            </label>
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
              <label htmlFor="review-text" className="field-label">
                What did you think? (Optional)
              </label>
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
            {existingReview?._id ? (
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
                      disabled={deleting}
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
            ) : <div />}

            <div className="submit-group">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || deleting || rating < 1}
              >
                {submitting ? 'Saving...' : existingReview?._id ? 'Update Review' : 'Save Review'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
