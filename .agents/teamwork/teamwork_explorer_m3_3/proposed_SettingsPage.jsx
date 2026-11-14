import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

/**
 * SettingsPage Component
 * 
 * Provides user account overview, personal library reading statistics,
 * and guarded account data management actions:
 * - "Reset My Books": clears all shelved books and favorites while preserving written reviews.
 * - "Delete My Reviews": permanently deletes all user reviews while preserving shelved books.
 * Both destructive actions are protected by clear, explicit confirmation modal dialogs.
 */
export default function SettingsPage({ me, onRefreshMe, onGoHome }) {
  const [reviewCount, setReviewCount] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'reset_books' | 'delete_reviews' | null
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch written reviews count on mount
  const fetchReviewCount = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const res = await api.getMyReviews();
      const count = typeof res?.total === 'number'
        ? res.total
        : Array.isArray(res?.reviews)
        ? res.reviews.length
        : 0;
      setReviewCount(count);
    } catch (err) {
      console.warn('Could not load user reviews count:', err);
      setReviewCount(0);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    fetchReviewCount();
  }, [fetchReviewCount]);

  // Handle escape key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeModal && !isSubmitting) {
        setActiveModal(null);
        setActionError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, isSubmitting]);

  // Reset My Books action execution
  const handleResetBooks = async () => {
    setIsSubmitting(true);
    setActionError('');
    try {
      await api.resetBooks();
      await onRefreshMe();
      setActiveModal(null);
      setActionSuccess('Your personal library and shelf books have been reset.');
      setTimeout(() => setActionSuccess(''), 6000);
    } catch (err) {
      setActionError(err.message || 'Failed to reset library books. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete My Reviews action execution
  const handleDeleteReviews = async () => {
    setIsSubmitting(true);
    setActionError('');
    try {
      const res = await api.deleteAllReviews();
      setReviewCount(0);
      await onRefreshMe();
      setActiveModal(null);
      const deletedMsg = res?.deletedCount !== undefined
        ? `Successfully deleted ${res.deletedCount} review(s).`
        : 'All of your written reviews have been permanently deleted.';
      setActionSuccess(deletedMsg);
      setTimeout(() => setActionSuccess(''), 6000);
    } catch (err) {
      setActionError(err.message || 'Failed to delete reviews. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!me || !me.user) {
    return (
      <div className="settings-page">
        <p className="muted">Please log in to access account settings.</p>
      </div>
    );
  }

  const user = me.user;
  const displayName = user.displayName || user.username;
  const avatarLetter = (displayName || 'U').slice(0, 1).toUpperCase();

  // Format member since date
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active member';

  // Statistics calculation
  const wantToReadCount = Array.isArray(me.wantToRead) ? me.wantToRead.length : (me.stats?.wantToReadCount || 0);
  const currentlyReadingCount = Array.isArray(me.currentlyReading) ? me.currentlyReading.length : (me.stats?.currentlyReadingCount || 0);
  const readCount = Array.isArray(me.read) ? me.read.length : (me.stats?.readCount || 0);
  const favoritesCount = Array.isArray(me.favorites) ? me.favorites.length : (me.stats?.favoritesCount || 0);
  const totalShelved = me.stats?.totalShelved !== undefined
    ? me.stats.totalShelved
    : (wantToReadCount + currentlyReadingCount + readCount);

  return (
    <div className="settings-page">
      {/* Navigation Breadcrumb / Header */}
      <nav className="recommendation-breadcrumbs" aria-label="Settings navigation">
        <button className="breadcrumb-btn" onClick={onGoHome}>
          ← Back to {user.onboarded ? 'For You' : 'Home'}
        </button>
        <span className="breadcrumb-current">
          Account &amp; Library Settings
        </span>
      </nav>

      <div className="settings-header">
        <h2>⚙️ Settings &amp; Preferences</h2>
        <p className="sub">Manage your account profile, review reading metrics, and maintain your personal library.</p>
      </div>

      {/* Global Success Notification */}
      {actionSuccess && (
        <div className="settings-toast-success" role="status" aria-live="polite">
          <span>✓ {actionSuccess}</span>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={() => setActionSuccess('')}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: Account Overview */}
      <section className="settings-card profile-card" aria-labelledby="profile-heading">
        <div className="settings-profile">
          <div className="settings-avatar" aria-hidden="true">
            {avatarLetter}
          </div>
          <div className="settings-info">
            <h3 id="profile-heading">{displayName}</h3>
            <p className="settings-username">@{user.username}</p>
            <p className="settings-joined">📅 Member since {memberSince}</p>
            <div className="settings-badges">
              {user.onboarded ? (
                <span className="status-badge onboarded">✓ Profile Onboarded</span>
              ) : (
                <span className="status-badge pending">Onboarding Incomplete</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Reading & Shelf Statistics */}
      <section className="settings-card stats-card" aria-labelledby="stats-heading">
        <h3 id="stats-heading">📊 Reading &amp; Shelf Statistics</h3>
        <p className="section-desc">Overview of your activity and personal library collections.</p>
        <div className="settings-stats-grid">
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">📚</div>
            <div className="stat-value">{totalShelved}</div>
            <div className="stat-label">Total Shelved</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">🔖</div>
            <div className="stat-value">{wantToReadCount}</div>
            <div className="stat-label">Want to Read</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">📖</div>
            <div className="stat-value">{currentlyReadingCount}</div>
            <div className="stat-label">Currently Reading</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">✅</div>
            <div className="stat-value">{readCount}</div>
            <div className="stat-label">Read</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">⭐</div>
            <div className="stat-value">{favoritesCount}</div>
            <div className="stat-label">Favourites</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon" aria-hidden="true">✍️</div>
            <div className="stat-value">{loadingReviews ? '…' : reviewCount}</div>
            <div className="stat-label">Reviews Written</div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Danger Zone / Account Actions */}
      <section className="settings-card danger-zone" aria-labelledby="danger-heading">
        <h3 id="danger-heading" className="danger-title">
          ⚠️ Library Management &amp; Data Actions
        </h3>
        <p className="section-desc">
          Manage or reset your personal library collections and community contributions.
        </p>

        {/* Action 1: Reset My Books */}
        <div className="danger-item">
          <div className="danger-desc">
            <h4>Reset My Books</h4>
            <p>
              Remove all books from your Want to Read, Currently Reading, and Read shelves, and clear your onboarding favourites.
              <br />
              <strong>Note:</strong> Your written reviews and star ratings will remain completely intact.
            </p>
          </div>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => {
              setActionError('');
              setActiveModal('reset_books');
            }}
          >
            Reset My Books…
          </button>
        </div>

        {/* Action 2: Delete My Reviews */}
        <div className="danger-item">
          <div className="danger-desc">
            <h4>Delete My Reviews</h4>
            <p>
              Permanently delete all star ratings and written reviews you have submitted across the catalog ({reviewCount} total).
              <br />
              <strong>Note:</strong> Your personal shelves and reading lists will remain completely intact.
            </p>
          </div>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => {
              setActionError('');
              setActiveModal('delete_reviews');
            }}
          >
            Delete My Reviews…
          </button>
        </div>
      </section>

      {/* CONFIRMATION MODAL: Reset My Books */}
      {activeModal === 'reset_books' && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setActiveModal(null)}
          role="presentation"
        >
          <div
            className="modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="reset-modal-title">⚠️ Reset All Shelves &amp; Favourites?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setActiveModal(null)}
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to reset your personal library? This action will remove all <strong>{totalShelved}</strong> book(s) from your <strong>Want to Read</strong>, <strong>Currently Reading</strong>, and <strong>Read</strong> shelves, as well as your onboarding favourites.
              </p>

              <div className="modal-reassurance-box">
                <strong>🛡️ Reviews Preserved:</strong> All book reviews and star ratings you have written will remain untouched and active in the catalog.
              </div>

              <div className="modal-alert-box">
                <strong>⚠️ Warning:</strong> This operation cannot be undone. You will need to re-add books manually.
              </div>

              {actionError && (
                <div className="modal-error-alert" role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleResetBooks}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Resetting…' : 'Yes, Reset All Books'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Delete My Reviews */}
      {activeModal === 'delete_reviews' && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setActiveModal(null)}
          role="presentation"
        >
          <div
            className="modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="delete-modal-title">⚠️ Delete All Written Reviews?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setActiveModal(null)}
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete all <strong>{reviewCount}</strong> review(s) and star ratings you have published?
              </p>

              <div className="modal-reassurance-box">
                <strong>🛡️ Shelves Preserved:</strong> All books in your Want to Read, Currently Reading, Read, and Favourites shelves will remain completely intact.
              </div>

              <div className="modal-alert-box">
                <strong>⚠️ Permanent Loss:</strong> This deletion cannot be reversed. Your reviews and ratings will be completely removed from the catalog.
              </div>

              {actionError && (
                <div className="modal-error-alert" role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteReviews}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting…' : 'Yes, Delete All Reviews'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
