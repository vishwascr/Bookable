# Technical Specification and Plan: Universal ReadingStatusButton & Catalog Integration

## 1. Observation

### 1.1 Backend Shelf Endpoints and Contracts
- File: `server/src/routes/users.js`
  - Lines 156–199:
    ```javascript
    // PUT /api/me/shelf/:isbn: Mutually exclusive status transition
    r.put('/me/shelf/:isbn', requireAuth, loadUser, async (req, res, next) => {
      try {
        const isbn = String(req.params.isbn || '').trim();
        const { status } = req.body || {};
        const validStatuses = ['want_to_read', 'currently_reading', 'read', 'none'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Allowed values: want_to_read, currently_reading, read, none' });
        }
        // ...
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
    ```
  - Lines 117–140:
    `GET /api/me/shelves` returns `{ wantToRead, currentlyReading, read, favorites, stats }`.
  - Lines 92–115:
    `GET /api/me` returns `{ user, favorites, wantToRead, currentlyReading, read, stats }`.

- File: `server/src/models/User.js`
  - Lines 8–11:
    ```javascript
    favorites: { type: [String], default: [] }, // ISBNs picked at onboarding (3–5)
    wantToRead: { type: [String], default: [] }, // ISBNs saved from recommendations
    currentlyReading: { type: [String], default: [] }, // ISBNs currently being read
    read: { type: [String], default: [] }, // ISBNs finished reading
    ```

### 1.2 Frontend API Client
- File: `client/src/api.js`
  - Lines 51–60:
    ```javascript
    // User accounts & shelves
    signup: (body) => j('/api/auth/signup', { method: 'POST', body }),
    login: (body) => j('/api/auth/login', { method: 'POST', body }),
    me: () => j('/api/me'),
    setFavorites: (isbns) => j('/api/me/favorites', { method: 'PUT', body: { isbns } }),
    addWant: (isbn) => j(`/api/me/want/${isbn}`, { method: 'POST' }),
    removeWant: (isbn) => j(`/api/me/want/${isbn}`, { method: 'DELETE' }),
    forYou: (algo, weights, limit = 12) =>
      j(`/api/me/recommend?${weightParams(new URLSearchParams({ algo, limit }), weights)}`),
    ```
  - `client/src/api.js` currently lacks methods for `updateShelfStatus`, `getShelves`, `resetBooks`, and review endpoints.

### 1.3 Existing View Components & Propagation Contexts
- File: `client/src/App.jsx`
  - Line 40: `const [me, setMe] = useState(null);`
  - Line 179:
    ```jsx
    <button
      className={view === 'shelves' ? 'active' : ''}
      onClick={() => setView('shelves')}
    >
      My Books{me.wantToRead.length ? ` (${me.wantToRead.length})` : ''}
    </button>
    ```
    (Note: The shelf counter badge only counts `me.wantToRead.length`, omitting `currentlyReading` and `read`.)
  - Lines 132–143: `toggleWant(book, saved)` is an old binary helper calling `addWant` and `removeWant`.
  - Lines 369–380: `ResultsRun` rendered inside `explore` view was being passed `wantSet` and `onToggleWant`, but `ResultsRun.jsx` did not accept them.

- File: `client/src/components/SearchResults.jsx`
  - Lines 96–126: `book-search-card` contains book details and a `select-seed-btn` ("✨ Get Recommendations →"). The whole article has `onClick={() => onSelectSeed(b)}`. No reading shelf button is present.

- File: `client/src/components/ResultsRun.jsx`
  - Lines 19–42: `li.result` has `onClick={() => onPick(r.book)}`. No reading status action is present.

- File: `client/src/components/SeedPanel.jsx`
  - Lines 6–26: Card displays the current seed book's cover, metadata, and TF-IDF title terms. No reading shelf action is present.

- File: `client/src/components/ForYou.jsx`
  - Lines 120–122:
    ```jsx
    <button className={`want-btn ${saved ? 'saved' : ''}`} onClick={() => onToggleWant(r.book, saved)}>
      {saved ? '✓ Want to Read' : '+ Want to Read'}
    </button>
    ```
    This is a binary toggle button that does not allow setting "Currently reading", "Read", or viewing shelf dropdown options.

- File: `client/src/components/Shelves.jsx`
  - Lines 26:
    ```jsx
    <button className="link muted" onClick={(e) => { e.stopPropagation(); onToggleWant(b, true); }}>Remove</button>
    ```
    Only supports removal from "Want to Read"; lacks multi-shelf status selection.

---

## 2. Logic Chain

1. **State Consistency & Instant Feedback**:
   - The backend `PUT /api/me/shelf/:isbn` enforces mutual exclusivity among `want_to_read`, `currently_reading`, and `read`.
   - Managing shelf state at the root `App.jsx` level via an optimistic updater ensures that when a user changes a book's status in `SearchResults`, `ResultsRun`, `SeedPanel`, `ForYou`, or `Shelves`:
     - The book's button status updates instantly.
     - The top navigation badge `My Books (X)` updates synchronously.
     - All other cards in the viewport referencing the same ISBN update synchronously.
     - A background or response-based sync confirms the change or rolls back on network error.

2. **Goodreads Parity UX for `ReadingStatusButton`**:
   - When a book is NOT shelved (`status === 'none'`):
     - Main button: `+ Want to Read` (1-click action putting the book on `want_to_read`).
     - Split chevron button: `▾` (opens dropdown with "Want to read", "Currently reading", "Read" without forcing immediate addition).
   - When a book IS shelved (`status !== 'none'`):
     - Displays active status: `"✓ Want to Read ▾"`, `"📖 Currently Reading ▾"`, or `"✓ Read ▾"`.
     - Clicking anywhere on the button or chevron opens the dropdown allowing the user to switch shelves or select `"Remove from shelf"`.
   - Unauthenticated guest users:
     - Attempting to shelf a book must not fail silently or throw unhandled exceptions.
     - Triggering `onRequireAuth` prompts login or redirects to the login view (`setView('login')`).

3. **Event Propagation Safety**:
   - In `SearchResults`, `ResultsRun`, and `Shelves`, clicking a book card triggers navigation (`onSelectSeed`, `onPick`, `onExplore`).
   - Every click event inside `ReadingStatusButton` and its dropdown MUST call `e.stopPropagation()`.

4. **Lookup Efficiency**:
   - Calculating `shelfMap = { [isbn]: status }` via `useMemo` in `App.jsx` turns status resolution for any book card into an $O(1)$ object lookup.

---

## 3. Caveats

1. **Populated vs Unpopulated Shelf Objects**:
   - When `PUT /api/me/shelf/:isbn` responds, it returns string arrays for `shelves.wantToRead`, `shelves.currentlyReading`, and `shelves.read`.
   - In views that render full book cards from `me` (such as `Shelves.jsx`), if a book is moved into a shelf where its full book object hasn't been loaded, background invocation of `refreshMe()` or `api.getShelves()` is necessary to populate the book document details.
2. **Review Auto-Transition Synchronization**:
   - As observed in `server/src/routes/reviews.js:118–123`, submitting a review automatically moves the book to the `read` shelf on the server. When the Review Modal (Explorer 2's track) submits a review, calling `handleUpdateShelfStatus` or `refreshMe()` will ensure the `ReadingStatusButton` reflects `"✓ Read"` immediately.
3. **No Caveats on Component Scope**: The 5 catalog targets (`SearchResults`, `ResultsRun`, `SeedPanel`, `ForYou`, `Shelves`) and root contracts are clearly bounded.

---

## 4. Conclusion & Technical Implementation Plan

### 4.1 `client/src/api.js` Additions

```javascript
// Add to api object in client/src/api.js:

// Reading status & shelves (M3)
updateShelfStatus: (isbn, status) => j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
updateReadingStatus: (isbn, status) => j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
getShelves: () => j('/api/me/shelves'),
resetBooks: () => j('/api/me/reset-books', { method: 'POST' }),

// Book reviews & ratings (M3)
getBookReviews: (isbn) => j(`/api/books/${isbn}/reviews`),
submitReview: (isbn, body) => j(`/api/books/${isbn}/reviews`, { method: 'POST', body }),
deleteReview: (reviewId) => j(`/api/reviews/${reviewId}`, { method: 'DELETE' }),
getMyReviews: () => j('/api/me/reviews'),
deleteAllReviews: () => j('/api/me/reviews', { method: 'DELETE' }),
```

---

### 4.2 `client/src/components/ReadingStatusButton.jsx` Specification

```jsx
import { useState, useEffect, useRef } from 'react';
import { api, getToken } from '../api.js';

const STATUS_CONFIG = {
  none: { label: '+ Want to Read', icon: null },
  want_to_read: { label: '✓ Want to Read', icon: '✓' },
  currently_reading: { label: '📖 Currently Reading', icon: '📖' },
  read: { label: '✓ Read', icon: '✓' },
};

export default function ReadingStatusButton({
  isbn,
  book = null,
  status = 'none',
  onStatusChange,
  onRequireAuth,
  size = 'md',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(status || 'none');
  const containerRef = useRef(null);

  useEffect(() => {
    setLocalStatus(status || 'none');
  }, [status]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const executeStatusChange = async (newStatus) => {
    if (!getToken()) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const prev = localStatus;
    setLocalStatus(newStatus);
    setLoading(true);
    setIsOpen(false);

    try {
      if (onStatusChange) {
        await onStatusChange(isbn, newStatus, book);
      } else {
        await api.updateShelfStatus(isbn, newStatus);
      }
    } catch (err) {
      setLocalStatus(prev);
    } finally {
      setLoading(false);
    }
  };

  const handle1Click = (e) => {
    e.stopPropagation();
    executeStatusChange('want_to_read');
  };

  const handleToggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleSelectOption = (e, targetStatus) => {
    e.stopPropagation();
    if (targetStatus === localStatus) {
      setIsOpen(false);
      return;
    }
    executeStatusChange(targetStatus);
  };

  const isShelved = localStatus !== 'none';

  return (
    <div
      className={`reading-status-container ${size} ${className}`}
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    >
      {!isShelved ? (
        <div className="status-btn-group">
          <button
            type="button"
            className="status-btn status-btn-main status-none"
            onClick={handle1Click}
            disabled={loading}
            title="Add to Want to Read"
          >
            {loading ? 'Adding…' : '+ Want to Read'}
          </button>
          <button
            type="button"
            className="status-btn status-btn-dropdown-trigger"
            onClick={handleToggleDropdown}
            disabled={loading}
            title="Choose reading status"
            aria-expanded={isOpen}
          >
            ▾
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`status-btn status-btn-active status-${localStatus}`}
          onClick={handleToggleDropdown}
          disabled={loading}
          title="Change reading shelf"
          aria-expanded={isOpen}
        >
          <span className="status-label">{STATUS_CONFIG[localStatus]?.label || 'Shelved'}</span>
          <span className="dropdown-arrow">▾</span>
        </button>
      )}

      {isOpen && (
        <ul className="reading-status-menu" role="menu">
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'want_to_read' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'want_to_read')}
          >
            <span className="status-item-icon">{localStatus === 'want_to_read' ? '✓' : ''}</span>
            <span className="status-item-text">Want to read</span>
          </li>
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'currently_reading' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'currently_reading')}
          >
            <span className="status-item-icon">{localStatus === 'currently_reading' ? '✓' : ''}</span>
            <span className="status-item-text">Currently reading</span>
          </li>
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'read' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'read')}
          >
            <span className="status-item-icon">{localStatus === 'read' ? '✓' : ''}</span>
            <span className="status-item-text">Read</span>
          </li>
          {isShelved && (
            <>
              <li className="status-menu-divider" role="separator" />
              <li
                role="menuitem"
                className="status-menu-item status-menu-item-remove"
                onClick={(e) => handleSelectOption(e, 'none')}
              >
                <span className="status-item-icon">✕</span>
                <span className="status-item-text">Remove from shelf</span>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
```

---

### 4.3 `client/src/App.jsx` Global State & Wiring Plan

1. **Calculate `shelfMap` and `totalShelved`**:
   ```javascript
   const shelfMap = useMemo(() => {
     if (!me?.user) return {};
     const map = {};
     for (const isbn of me.user.wantToRead || []) map[isbn] = 'want_to_read';
     for (const isbn of me.user.currentlyReading || []) map[isbn] = 'currently_reading';
     for (const isbn of me.user.read || []) map[isbn] = 'read';
     return map;
   }, [me]);

   const totalShelved = me
     ? (me.user.wantToRead?.length || 0) +
       (me.user.currentlyReading?.length || 0) +
       (me.user.read?.length || 0)
     : 0;
   ```

2. **Top Navigation Badge Update**:
   ```jsx
   <button
     className={view === 'shelves' ? 'active' : ''}
     onClick={() => setView('shelves')}
   >
     My Books{totalShelved > 0 ? ` (${totalShelved})` : ''}
   </button>
   ```

3. **`handleUpdateShelfStatus(isbn, newStatus, bookObj)`**:
   ```javascript
   const handleUpdateShelfStatus = useCallback(async (isbn, newStatus, bookObj = null) => {
     if (!getToken() || !me) {
       setView('login');
       return;
     }

     const prevMe = me;
     const cleanIsbn = String(isbn).trim();

     // Optimistic state transition
     setMe((prev) => {
       if (!prev?.user) return prev;
       const u = { ...prev.user };
       const filterOut = (arr) => (arr || []).filter((i) => i !== cleanIsbn);
       
       let nextWant = filterOut(u.wantToRead);
       let nextCurrent = filterOut(u.currentlyReading);
       let nextRead = filterOut(u.read);

       if (newStatus === 'want_to_read') nextWant.unshift(cleanIsbn);
       else if (newStatus === 'currently_reading') nextCurrent.unshift(cleanIsbn);
       else if (newStatus === 'read') nextRead.unshift(cleanIsbn);

       return {
         ...prev,
         user: {
           ...u,
           wantToRead: nextWant,
           currentlyReading: nextCurrent,
           read: nextRead,
         },
         stats: {
           ...prev.stats,
           wantToReadCount: nextWant.length,
           currentlyReadingCount: nextCurrent.length,
           readCount: nextRead.length,
           totalShelved: nextWant.length + nextCurrent.length + nextRead.length,
         },
       };
     });

     try {
       const res = await api.updateShelfStatus(cleanIsbn, newStatus);
       if (res?.shelves) {
         setMe((prev) => {
           if (!prev?.user) return prev;
           return {
             ...prev,
             user: {
               ...prev.user,
               wantToRead: res.shelves.wantToRead,
               currentlyReading: res.shelves.currentlyReading,
               read: res.shelves.read,
             },
             stats: {
               ...prev.stats,
               wantToReadCount: res.shelves.wantToRead.length,
               currentlyReadingCount: res.shelves.currentlyReading.length,
               readCount: res.shelves.read.length,
               totalShelved: res.shelves.wantToRead.length + res.shelves.currentlyReading.length + res.shelves.read.length,
             },
           };
         });
       }
       if (view === 'shelves') {
         refreshMe();
       }
     } catch (err) {
       setMe(prevMe);
       setError(err.message || 'Failed to update shelf');
       throw err;
     }
   }, [me, view, refreshMe]);
   ```

---

### 4.4 Catalog Component Integration Diffs

#### 1. `client/src/components/SearchResults.jsx`
- Add props: `{ query, onSelectSeed, onClearSearch, shelfMap, onUpdateShelf, onRequireAuth }`
- In `book-search-card` actions:
  ```jsx
  <div className="book-card-actions" onClick={(e) => e.stopPropagation()}>
    <ReadingStatusButton
      isbn={b.isbn}
      book={b}
      status={shelfMap?.[b.isbn] || 'none'}
      onStatusChange={onUpdateShelf}
      onRequireAuth={onRequireAuth}
      size="sm"
    />
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
  ```

#### 2. `client/src/components/ResultsRun.jsx`
- Add props: `{ run, compact, onPick, shelfMap, onUpdateShelf, onRequireAuth }`
- Inside each recommendation item:
  ```jsx
  <div className="result-actions" onClick={(e) => e.stopPropagation()}>
    <ReadingStatusButton
      isbn={r.book.isbn}
      book={r.book}
      status={shelfMap?.[r.book.isbn] || 'none'}
      onStatusChange={onUpdateShelf}
      onRequireAuth={onRequireAuth}
      size={compact ? 'sm' : 'md'}
    />
  </div>
  ```

#### 3. `client/src/components/SeedPanel.jsx`
- Add props: `{ seed, shelfMap, onUpdateShelf, onRequireAuth }`
- Inside seed book details:
  ```jsx
  <div className="seed-actions" style={{ marginTop: '12px' }}>
    <ReadingStatusButton
      isbn={book.isbn}
      book={book}
      status={shelfMap?.[book.isbn] || 'none'}
      onStatusChange={onUpdateShelf}
      onRequireAuth={onRequireAuth}
      size="md"
    />
  </div>
  ```

#### 4. `client/src/components/ForYou.jsx`
- Replace old binary `<button className="want-btn">` at lines 120–122 with:
  ```jsx
  <div className="foryou-item-actions" onClick={(e) => e.stopPropagation()}>
    <ReadingStatusButton
      isbn={r.book.isbn}
      book={r.book}
      status={shelfMap?.[r.book.isbn] || 'none'}
      onStatusChange={onUpdateShelf}
      onRequireAuth={onRequireAuth}
      size="sm"
    />
  </div>
  ```

#### 5. `client/src/components/Shelves.jsx`
- Replace `<button className="link muted" onClick={...}>Remove</button>` with `ReadingStatusButton`:
  ```jsx
  <div className="shelf-book-actions" onClick={(e) => e.stopPropagation()}>
    <ReadingStatusButton
      isbn={b.isbn}
      book={b}
      status={shelfMap?.[b.isbn] || 'want_to_read'}
      onStatusChange={onUpdateShelf}
      onRequireAuth={onRequireAuth}
      size="sm"
    />
  </div>
  ```

---

### 4.5 CSS Additions for `client/src/styles.css`

```css
/* ReadingStatusButton Universal Component */
.reading-status-container {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  font-family: inherit;
}

.status-btn-group {
  display: inline-flex;
  border-radius: 99px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.status-btn {
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  background: #ffffff;
  color: var(--ok);
  white-space: nowrap;
}

.status-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Sizes */
.reading-status-container.sm .status-btn {
  font-size: 0.75rem;
  padding: 3px 8px;
}
.reading-status-container.sm .status-btn-dropdown-trigger {
  padding: 3px 6px;
}
.reading-status-container.md .status-btn {
  font-size: 0.85rem;
  padding: 6px 14px;
}
.reading-status-container.md .status-btn-dropdown-trigger {
  padding: 6px 8px;
}
.reading-status-container.lg .status-btn {
  font-size: 0.95rem;
  padding: 8px 18px;
}
.reading-status-container.lg .status-btn-dropdown-trigger {
  padding: 8px 10px;
}

/* Split Button */
.status-btn-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}
.status-btn-dropdown-trigger {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid var(--line);
  color: var(--muted);
}
.status-btn-main:hover,
.status-btn-dropdown-trigger:hover {
  background: #f8faf8;
  border-color: var(--ok);
}

/* Active Status Pill */
.status-btn-active {
  border-radius: 99px;
  gap: 6px;
  background: #edf7f0;
  border-color: var(--ok);
  color: var(--ok);
}
.status-btn-active:hover {
  background: #e2f2e6;
}
.status-btn-active.status-currently_reading {
  background: #eef5fc;
  border-color: var(--accent-2);
  color: var(--accent-2);
}
.status-btn-active.status-currently_reading:hover {
  background: #e1effa;
}
.status-btn-active.status-read {
  background: #f1f8ed;
  border-color: #3b7e28;
  color: #3b7e28;
}
.status-btn-active.status-read:hover {
  background: #e6f3de;
}

.dropdown-arrow {
  font-size: 0.75em;
  opacity: 0.8;
}

/* Dropdown Menu */
.reading-status-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 185px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  margin: 0;
  list-style: none;
  z-index: 100;
  animation: fadeInDown 0.15s ease-out;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 0.88rem;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;
}
.status-menu-item:hover {
  background: #f5f2ed;
}
.status-menu-item.selected {
  font-weight: 600;
  color: var(--ok);
  background: #f0f7f2;
}
.status-item-icon {
  width: 16px;
  text-align: center;
  font-weight: bold;
}
.status-menu-divider {
  height: 1px;
  background: var(--line);
  margin: 4px 0;
}
.status-menu-item-remove {
  color: #c93b27;
}
.status-menu-item-remove:hover {
  background: #fdeee9;
  color: #b02814;
}

/* Card action row alignment */
.book-card-actions,
.result-actions,
.foryou-item-actions,
.shelf-book-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
```

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the automated test runner to ensure no regressions against backend shelf endpoints:
```bash
node tests/run-all.js
```
Specifically verify tests targeting Feature 3 (Reading Statuses & Shelves):
- `T1-SHF-01`: Add book to Want to Read shelf via `PUT /api/me/shelf/:isbn`
- `T1-SHF-02`: Transition book to Currently Reading
- `T1-SHF-03`: Transition book to Read
- `T1-SHF-04`: Remove book from all reading shelves with status none
- `T2-SHF-01`: Reject invalid reading status value
- `T2-SHF-02`: Reject shelving of non-existent catalog ISBN

### 5.2 Build Verification
Ensure the frontend React application compiles cleanly with Vite:
```bash
cd client && npm run build
```

### 5.3 Interactive Verification Checklist
1. **Unshelved State**: In search results (`SearchResults.jsx`), books display split button `[+ Want to Read | ▾]`.
2. **1-Click Want to Read**: Clicking `+ Want to Read` immediately updates the button to `✓ Want to Read ▾`, increments the `My Books (X)` badge in the header, and moves the ISBN into `me.user.wantToRead`.
3. **Dropdown Selection**: Clicking the chevron `▾` reveals "Want to read", "Currently reading", "Read". Selecting "Currently reading" changes button state to `📖 Currently Reading ▾`.
4. **Remove from Shelf**: Selecting "Remove from shelf" reverts the button to `+ Want to Read | ▾` and decrements `My Books (X)`.
5. **No Propagation**: Clicking `+ Want to Read` inside a search card or recommendation result does not open the book details/seed view.
6. **Guest Authentication Guard**: When logged out, clicking `+ Want to Read` redirects or prompts to log in instead of throwing errors.

### 5.4 Invalidation Conditions
- Backend `PUT /api/me/shelf/:isbn` contract changes or rejects valid statuses.
- Card wrapper click events hijack the button's stop-propagation handlers.
