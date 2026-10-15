import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Cover from './Cover.jsx';

const PAGE_SIZE = 24;

export default function SearchResults({ query, onSelectSeed, onClearSearch }) {
  const [data, setData] = useState({ books: [], total: 0, page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // When query changes, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!query || query.trim().length < 2) return;
    setLoading(true);
    setError('');

    api.searchPaginated(query.trim(), page, PAGE_SIZE)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load search results');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [query, page]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > data.totalPages || newPage === page) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="search-results-page">
      <div className="search-results-header">
        <div className="search-results-title-group">
          <h2>Search Results for “<span className="query-highlight">{query}</span>”</h2>
          {!loading && (
            <span className="results-badge">
              {data.total.toLocaleString()} {data.total === 1 ? 'book' : 'books'} found
            </span>
          )}
        </div>
        {onClearSearch && (
          <button className="btn-secondary" onClick={onClearSearch}>
            ✕ Clear Search
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="search-loading">
          <div className="spinner" />
          <p>Searching through 271,000+ books…</p>
        </div>
      )}

      {!loading && data.books.length === 0 && (
        <div className="search-empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No matching books found</h3>
          <p>We couldn't find any books matching “<b>{query}</b>”.</p>
          <div className="search-tips">
            <b>Search suggestions:</b>
            <ul>
              <li>Check your spelling or try broader keywords.</li>
              <li>Search by author name (e.g. <i>“Tolkien”</i>, <i>“Stephen King”</i>, <i>“Rowling”</i>).</li>
              <li>Search by book titles (e.g. <i>“Gatsby”</i>, <i>“Dune”</i>, <i>“Pride”</i>).</li>
            </ul>
          </div>
        </div>
      )}

      {!loading && data.books.length > 0 && (
        <>
          <div className="search-results-grid">
            {data.books.map((b) => (
              <article key={b.isbn} className="book-search-card" onClick={() => onSelectSeed(b)}>
                <Cover src={b.imageM} size="md" title={b.title} />
                <div className="book-card-body">
                  <h3 className="book-card-title" title={b.title}>
                    {b.title}
                  </h3>
                  <div className="book-card-author">{b.author || 'Unknown Author'}</div>
                  <div className="book-card-meta">
                    <span>{b.year ? b.year : 'Year n/a'}</span>
                    {b.publisher && (
                      <>
                        <span className="dot">·</span>
                        <span className="publisher" title={b.publisher}>{b.publisher}</span>
                      </>
                    )}
                  </div>
                  <div className="book-card-isbn mono">ISBN {b.isbn}</div>
                  <button
                    type="button"
                    className="select-seed-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSeed(b);
                    }}
                  >
                    ✨ Get Recommendations →
                  </button>
                </div>
              </article>
            ))}
          </div>

          {data.totalPages > 1 && (
            <nav className="pagination-bar" aria-label="Search results pagination">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                ← Previous
              </button>
              <span className="page-indicator">
                Page <b>{page}</b> of <b>{data.totalPages}</b>
              </span>
              <button
                className="pagination-btn"
                disabled={page >= data.totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
