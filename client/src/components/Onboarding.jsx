import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

const MIN = 3;
const MAX = 5;

const STAR_LABELS = {
  0: 'Rate this book (1–5 stars)',
  1: '1 star — Did not like it',
  2: '2 stars — It was OK',
  3: '3 stars — Liked it',
  4: '4 stars — Really liked it',
  5: '5 stars — It was amazing',
};

// Goodreads-style "pick books you love" step + optional sentiment review carousel
export default function Onboarding({ initial = [], onDone, onCancel, editing = false }) {
  const [step, setStep] = useState('picks'); // 'picks' | 'reviews'
  const [popular, setPopular] = useState([]);
  const [picked, setPicked] = useState(initial); // array of book objects
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Reviews step state
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewsByIsbn, setReviewsByIsbn] = useState({}); // { [isbn]: { rating: 5, text: '' } }
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    api.popular().then(setPopular).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(
      () =>
        api
          .searchPaginated(q.trim(), 1, 12)
          .then((r) => setResults(Array.isArray(r) ? r : r?.books || []))
          .catch(() => {}),
      250
    );
    return () => clearTimeout(t);
  }, [q]);

  const isPicked = (b) => picked.some((p) => p.isbn === b.isbn);

  const toggle = (b) => {
    setError('');
    if (isPicked(b)) {
      setPicked(picked.filter((p) => p.isbn !== b.isbn));
    } else if (picked.length >= MAX) {
      setError(`You can pick up to ${MAX} books.`);
    } else {
      setPicked([...picked, b]);
    }
  };

  const handlePicksDone = async (skipReviews = false) => {
    if (picked.length < MIN) {
      setError(`Please select at least ${MIN} books.`);
      return;
    }
    setError('');

    if (editing || skipReviews) {
      setBusy(true);
      try {
        await api.setFavorites(picked.map((b) => b.isbn));
        onDone();
      } catch (e) {
        setError(e.message || 'Failed to save favourites');
      } finally {
        setBusy(false);
      }
    } else {
      // Transition to optional review step
      setReviewIdx(0);
      setStep('reviews');
    }
  };

  const currentBook = picked[reviewIdx] || null;
  const currentReview = currentBook ? reviewsByIsbn[currentBook.isbn] || { rating: 0, text: '' } : { rating: 0, text: '' };

  const handleSetRating = (ratingVal) => {
    if (!currentBook) return;
    setReviewsByIsbn((prev) => ({
      ...prev,
      [currentBook.isbn]: {
        ...(prev[currentBook.isbn] || { text: '' }),
        rating: ratingVal,
      },
    }));
  };

  const handleSetText = (textVal) => {
    if (!currentBook) return;
    setReviewsByIsbn((prev) => ({
      ...prev,
      [currentBook.isbn]: {
        ...(prev[currentBook.isbn] || { rating: 0 }),
        text: textVal,
      },
    }));
  };

  const handleFinishOnboarding = async (skipReviews = false) => {
    setBusy(true);
    setError('');
    try {
      // 1. Save favorite seed books
      await api.setFavorites(picked.map((b) => b.isbn));

      // 2. Submit any reviews the user provided
      if (!skipReviews) {
        for (const book of picked) {
          const rev = reviewsByIsbn[book.isbn];
          if (rev && rev.rating >= 1) {
            try {
              await api.submitReview(book.isbn, {
                rating: rev.rating,
                text: (rev.text || '').trim(),
              });
            } catch (revErr) {
              console.warn(`Review submit failed for ${book.isbn}:`, revErr.message);
            }
          }
        }
      }

      onDone();
    } catch (e) {
      setError(e.message || 'Failed to complete onboarding');
    } finally {
      setBusy(false);
    }
  };

  const grid = q.trim().length >= 2 ? results : popular;

  // STEP 2: OPTIONAL REVIEWS CAROUSEL STEP
  if (step === 'reviews' && picked.length > 0) {
    const totalBooks = picked.length;
    const reviewedCount = Object.values(reviewsByIsbn).filter((r) => r.rating >= 1).length;
    const activeLabel = STAR_LABELS[hoverRating || currentReview.rating] || STAR_LABELS[0];

    return (
      <section className="onboarding onboarding-review-step card">
        <div className="onb-head">
          <div>
            <h2>Review your favourite picks (Optional)</h2>
            <p className="m">
              Rate or share a quick thought on your selected books. Submitting reviews triggers local sentiment analysis to tailor recommendations even further!
            </p>
          </div>
          <div className="onb-progress">
            <span className="m">
              Book {reviewIdx + 1} of {totalBooks} · {reviewedCount} reviewed
            </span>
          </div>
        </div>

        {/* Selected Books Navigation Carousel Bar */}
        <div className="onb-review-carousel-nav">
          <button
            type="button"
            className="carousel-arrow-btn"
            disabled={reviewIdx === 0}
            onClick={() => {
              setReviewIdx((i) => Math.max(0, i - 1));
              setHoverRating(0);
            }}
            aria-label="Previous book"
          >
            ← Previous
          </button>

          <div className="onb-review-chips">
            {picked.map((b, idx) => {
              const hasReview = (reviewsByIsbn[b.isbn]?.rating || 0) >= 1;
              return (
                <button
                  key={b.isbn}
                  type="button"
                  className={`onb-chip-selector ${idx === reviewIdx ? 'active' : ''} ${hasReview ? 'reviewed' : ''}`}
                  onClick={() => {
                    setReviewIdx(idx);
                    setHoverRating(0);
                  }}
                  title={b.title}
                >
                  <Cover src={b.imageS || b.imageM} size="xs" />
                  <span className="chip-book-title">{b.title}</span>
                  {hasReview && <span className="chip-check">✓</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="carousel-arrow-btn"
            disabled={reviewIdx === totalBooks - 1}
            onClick={() => {
              setReviewIdx((i) => Math.min(totalBooks - 1, i + 1));
              setHoverRating(0);
            }}
            aria-label="Next book"
          >
            Next →
          </button>
        </div>

        {/* Current Active Book Review Card */}
        {currentBook && (
          <div className="onb-review-card card">
            <div className="onb-review-book-info">
              <Cover src={currentBook.imageM || currentBook.imageL} size="md" title={currentBook.title} />
              <div className="book-text-meta">
                <h3 className="book-title">{currentBook.title}</h3>
                <div className="book-author">by {currentBook.author || 'Unknown'} · {currentBook.year || 'n/a'}</div>
              </div>
            </div>

            <div className="onb-star-picker-section">
              <label className="onb-field-label">Your Rating (1–5 Stars):</label>
              <div
                className="star-picker"
                role="radiogroup"
                aria-label="Star rating"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= (hoverRating || currentReview.rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${filled ? 'filled' : 'empty'}`}
                      role="radio"
                      aria-checked={currentReview.rating === star}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => handleSetRating(star)}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              <div className="rating-helper-text">{activeLabel}</div>
            </div>

            <div className="onb-textarea-section">
              <label htmlFor="onb-review-text" className="onb-field-label">
                What did you love or think about this book? (Optional, triggers sentiment analysis)
              </label>
              <textarea
                id="onb-review-text"
                rows={4}
                maxLength={2000}
                placeholder="E.g., Breathtaking world-building with unforgettable characters, fast-paced and poignant..."
                value={currentReview.text}
                onChange={(e) => handleSetText(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {/* Actions Bar */}
        <div className="onb-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStep('picks')}
            disabled={busy}
          >
            ← Back to Book Picks
          </button>
          <div className="onb-right-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleFinishOnboarding(true)}
              disabled={busy}
              title="Proceed to recommendations without submitting reviews"
            >
              Skip to Recommendations
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleFinishOnboarding(false)}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Show my recommendations →'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // STEP 1: PICK 3-5 BOOKS STEP
  return (
    <section className="onboarding card">
      <div className="onb-head">
        <div>
          <h2>{editing ? 'Edit your favourite books' : 'Pick 3–5 books you love'}</h2>
          <p className="m">
            Your picks become the “seeds” every recommendation algorithm uses to understand your taste.
          </p>
        </div>
        <div className="onb-progress">
          <div className="dots">
            {Array.from({ length: MAX }, (_, i) => (
              <span key={i} className={i < picked.length ? 'on' : ''} />
            ))}
          </div>
          <span className="m">
            {picked.length} / {MAX} selected{' '}
            {picked.length < MIN && `· ${MIN - picked.length} more to go`}
          </span>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="picked-row">
          {picked.map((b) => (
            <button
              key={b.isbn}
              type="button"
              className="picked-chip"
              onClick={() => toggle(b)}
              title="Remove"
            >
              <Cover src={b.imageM} size="xs" title={b.title} />
              <span>{b.title}</span>
              <span className="x">✕</span>
            </button>
          ))}
        </div>
      )}

      <input
        className="onb-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for a book or author you love…"
      />
      <h4 className="onb-sub">
        {q.trim().length >= 2 ? `Results for “${q.trim()}”` : 'Popular on Bookable'}
      </h4>

      <div className="onb-grid">
        {grid.map((b) => (
          <button
            key={b.isbn}
            type="button"
            className={`onb-book ${isPicked(b) ? 'sel' : ''}`}
            onClick={() => toggle(b)}
          >
            <div className="onb-cover">
              <Cover src={b.imageM} size="lg" title={b.title} />
              {isPicked(b) && <span className="check">✓</span>}
            </div>
            <div className="t">{b.title}</div>
            <div className="m">{b.author}</div>
          </button>
        ))}
        {grid.length === 0 && <div className="m">No books found.</div>}
      </div>

      {error && <div className="error">{error}</div>}
      <div className="onb-actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={picked.length < MIN || busy}
          onClick={() => handlePicksDone(false)}
        >
          {busy
            ? 'Saving…'
            : picked.length < MIN
            ? `Pick ${MIN - picked.length} more`
            : editing
            ? 'Save favourites'
            : 'Continue: Add Reviews (Optional) →'}
        </button>
      </div>
    </section>
  );
}
