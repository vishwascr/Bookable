import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';
import ReadingStatusButton from './ReadingStatusButton.jsx';

export default function Shelves({
  me,
  onExplore = null,
  onSelectBook = null,
  onOpenReview = null,
  onStatusChange = null,
  onShelfChange = null,
  onEditFavorites = null,
  onToggleWant = null,
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [userReviewsMap, setUserReviewsMap] = useState(new Map());

  const handleShelfUpdate = onStatusChange || onShelfChange;

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

  const handleCardClick = (b) => {
    if (onSelectBook) {
      onSelectBook(b);
    } else if (onExplore) {
      onExplore(b);
    }
  };

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
          {onEditFavorites && (
            <button type="button" className="btn-secondary sm" onClick={onEditFavorites}>
              ✎ Edit Favourites
            </button>
          )}
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
              {empty.action && empty.action.handler && (
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
                onClick={() => handleCardClick(b)}
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
                      handleCardClick(b);
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
                      isbn={b.isbn}
                      me={me}
                      onStatusChange={handleShelfUpdate}
                      size="sm"
                    />
                  </div>

                  {/* Interactive Star Rating */}
                  <div
                    className="card-rating-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="shelf-star-picker"
                      title={userRating ? `Your rating: ${userRating}/5` : 'Rate this book'}
                    >
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
