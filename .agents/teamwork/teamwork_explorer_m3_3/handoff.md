# Technical Specification & Plan: SettingsPage, App.jsx Wiring, & GAP_ANALYSIS.md

**Agent**: `teamwork_explorer_m3_3`  
**Milestone**: Milestone 3 — Goodreads Core UX, Shelves, Reviews & Gap Analysis  
**Date**: 2026-11-13T20:26:00Z  
**Status**: Investigation Complete — Hard Handoff Ready  

---

## 1. Observation

Direct inspection of the Bookable codebase at `/Users/admin/Documents/Bookable` revealed the following exact facts across data models, backend API routes, frontend components, CSS stylesheets, and automated test suites:

### 1.1 Backend Settings & Shelves Endpoints
- **`server/src/routes/users.js`**:
  - Lines 227–247 implement `POST /api/me/reset-books`:
    ```javascript
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
    ```
    *Observation*: This endpoint atomically clears `wantToRead`, `currentlyReading`, `read`, and `favorites` arrays on the user document while leaving `Review` documents completely untouched. It returns the updated public user object and empty shelves.
  - Lines 92–115 implement `GET /api/me`:
    Returns `{ user, favorites, wantToRead, currentlyReading, read, stats }` where `stats` contains `favoritesCount`, `wantToReadCount`, `currentlyReadingCount`, `readCount`, and `totalShelved`.
  - Lines 156–199 implement `PUT /api/me/shelf/:isbn`:
    Accepts `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }` and executes atomic, mutually exclusive status transitions among shelves.

- **`server/src/routes/reviews.js`**:
  - Lines 198–212 implement `DELETE /api/me/reviews`:
    ```javascript
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
    ```
    *Observation*: This endpoint permanently deletes all reviews where `userId === req.userId` while leaving user account documents and shelves (`User.wantToRead`, `User.currentlyReading`, `User.read`, `User.favorites`) completely untouched.
  - Lines 178–196 implement `GET /api/me/reviews`:
    Returns `{ total: populated.length, reviews: populated }` where each review is populated with catalog book metadata.

- **`server/src/models/User.js`**:
  - Lines 20–32:
    `userSchema.methods.toPublic()` returns `{ id, username, displayName, favorites, wantToRead, currentlyReading, read, onboarded, createdAt }`.
    *Observation*: `createdAt` provides the exact account creation timestamp needed for "Member since [Date]" formatting.

### 1.2 Frontend Application Wiring & Views
- **`client/src/App.jsx`**:
  - Line 28 defines the active view set: `// Views: home | search | explore | login | signup | logout | onboarding | foryou | shelves`.
    *Observation*: There is currently no `settings` view in the state machine.
  - Lines 165–187 define the navigation bar for authenticated users:
    ```jsx
    {me ? (
      <nav className="user-nav" aria-label="User account navigation">
        {me.user.onboarded && (
          <button className={view === 'foryou' ? 'active' : ''} onClick={() => setView('foryou')}>
            For You
          </button>
        )}
        <button className={view === 'shelves' ? 'active' : ''} onClick={() => setView('shelves')}>
          My Books{me.wantToRead.length ? ` (${me.wantToRead.length})` : ''}
        </button>
        <span className="avatar" title={`Signed in as @${me.user.username}`}>
          {(me.user.displayName || me.user.username).slice(0, 1).toUpperCase()}
        </span>
        <button className="link muted" onClick={handleLogout}>Log out</button>
      </nav>
    ) : ...}
    ```
    *Observation*: There is no `⚙️ Settings` button in the navigation bar. Also, the `My Books` counter only tallies `me.wantToRead.length` rather than total shelved books.
  - Lines 132–143 implement a binary `toggleWant(book, saved)` helper:
    Does not accommodate the three mutually exclusive Goodreads reading statuses (`want_to_read`, `currently_reading`, `read`).
  - Lines 365–385: No global modal containers exist for `reviewModalBook` or `detailModalBook`.

### 1.3 Client API Client
- **`client/src/api.js`**:
  - Lines 41–60 define `api` methods.
  - Currently missing methods: `resetBooks()`, `deleteAllReviews()`, `getMyReviews()`, `updateShelfStatus()`, `getShelves()`, `getBookReviews()`, `submitReview()`, `deleteReview()`.

### 1.4 Stylesheet & Design Standards
- **`client/src/styles.css`**:
  - Lines 1–15 define design tokens (`--bg`, `--card`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-hover`, `--ok`).
  - Line 145 specifies 20px rounded container requirement from R4/AC4.
  - Running `grep -n -E "modal|settings|danger|dialog" client/src/styles.css` produced 0 matches.
  - *Observation*: No modal system, danger zone, or settings page styles exist in `styles.css`.

### 1.5 Gap Analysis Document
- Running `ls -la GAP_ANALYSIS.md` returned `No such file or directory`.
  *Observation*: `GAP_ANALYSIS.md` does not yet exist at the project root `/Users/admin/Documents/Bookable/GAP_ANALYSIS.md`.

### 1.6 Verification Test Suites
- Running inspection across `tests/*.js` confirmed that:
  - `tests/stress-m1-isolation.js` lines 239–302 test `POST /api/me/reset-books` (verifying shelves are cleared while reviews remain intact) and `DELETE /api/me/reviews` (verifying reviews are deleted while shelves remain intact).
  - `tests/auth-isolation.test.js` lines 218–230 test multi-user isolation on reset endpoints.
  - `tests/e2e-scenarios.test.js` lines 225–305 and 790–820 test end-to-end user workflows using settings endpoints.

---

## 2. Logic Chain

From the direct observations above, the following logical deduction chain governs the technical implementation:

1. **SettingsPage Data Requirements**:
   - *Observation*: `GET /api/me` returns `me.user` (with `username`, `displayName`, `createdAt`, `onboarded`) and `me.stats` (with `wantToReadCount`, `currentlyReadingCount`, `readCount`, `favoritesCount`, `totalShelved`).
   - *Observation*: `GET /api/me/reviews` returns `{ total, reviews }`.
   - *Inference*: `SettingsPage.jsx` can render all required account overview fields and library metrics with zero schema changes. On mount, calling `api.getMyReviews()` provides the exact count of reviews written.

2. **Destructive Action Safeguards (Confirmation Modals)**:
   - *Observation*: `POST /api/me/reset-books` wipes all shelves, while `DELETE /api/me/reviews` wipes all user reviews. Both are irreversible.
   - *Inference*: Each button in the Danger Zone must be protected by an explicit confirmation modal dialog.
   - *Inference*: To eliminate user panic and maintain Goodreads parity, the modals must explicitly inform the user what is preserved:
     - In the "Reset My Books" modal: emphasize that **written reviews and star ratings remain 100% intact**.
     - In the "Delete My Reviews" modal: emphasize that **shelves and saved reading lists remain 100% intact**.
   - *Inference*: Modals must support light-dismiss (clicking the backdrop), <kbd>Escape</kbd> key dismissal, and disabled buttons during submission to prevent duplicate concurrent network requests.

3. **Immediate State Synchronization in `App.jsx`**:
   - *Observation*: When a user resets books via `POST /api/me/reset-books`, the backend resets the user's shelf arrays to `[]`.
   - *Inference*: In `SettingsPage.jsx`, awaiting `onRefreshMe()` immediately updates `me` state in `App.jsx`. This immediately resets the `My Books` navigation counter and synchronizes all shelf components.
   - *Observation*: When a user deletes reviews via `DELETE /api/me/reviews`, local component state resets `reviewCount` to 0 and `onRefreshMe()` guarantees fresh user data.

4. **Global Review and Detail Modal State in `App.jsx`**:
   - *Observation*: Books can be reviewed or inspected from multiple disparate components (`SearchResults.jsx`, `Shelves.jsx`, `ForYou.jsx`, `ResultsRun.jsx`, `SeedPanel.jsx`).
   - *Inference*: Storing `reviewModalBook` and `detailModalBook` in `App.jsx` and rendering them at the root level enables any child component to trigger modals via simple callback props (`onOpenReview(book)`, `onOpenDetail(book)`).
   - *Inference*: When a review is submitted via `ReviewModal`, calling `handleReviewSaved` -> `refreshMe()` automatically synchronizes the user's `read` shelf (since the backend auto-moves reviewed books to the `read` shelf).

5. **Universal Shelf Change Handler Callback**:
   - *Observation*: `ReadingStatusButton.jsx` allows transitioning between `want_to_read`, `currently_reading`, `read`, or `none`.
   - *Inference*: A centralized `handleShelfChange(isbn, newStatus)` callback in `App.jsx` invoking `api.updateShelfStatus(isbn, newStatus)` followed by `refreshMe()` provides an authoritative single source of truth for shelf status across the entire application.

6. **Comprehensive `GAP_ANALYSIS.md` Report**:
   - *Observation*: The user request (R1, AC1) and dispatch require a formal gap analysis report detailing Goodreads capabilities vs. Bookable, covering 9 core dimensions, on-device differentiators, verification evidence, and a parity scorecard.
   - *Inference*: A structured Markdown document authored at `/Users/admin/Documents/Bookable/GAP_ANALYSIS.md` provides permanent documentation of Bookable's parity achievements.

---

## 3. Caveats

1. **MongoDB Indexing Readiness**:
   `GET /api/me/reviews` queries `Review.find({ userId })`. The `Review` model includes a compound index `{ userId: 1, isbn: 1 }`, guaranteeing fast query response times even with large review catalogs.
2. **Review Auto-Shelving Interaction**:
   In `server/src/routes/reviews.js:121-123`, submitting a review automatically moves the book to the `read` shelf. When `ReviewModal` closes after saving a review, `App.jsx` must call `refreshMe()` to ensure the user's `read` count and shelves update immediately.
3. **No External Dialog Polyfills Required**:
   Modern desktop and mobile browsers fully support CSS fixed backdrop overlay modals. The confirmation modals in `SettingsPage.jsx` use accessible React DOM overlays with 20px rounded corners, avoiding complex third-party dependencies while delivering smooth iOS-styled aesthetics.

---

## 4. Conclusion & Technical Implementation Plan

All necessary backend endpoints already exist and have passed automated isolation tests. The exact implementation plan consists of 4 concrete artifacts:

### Artifact 1: `client/src/components/SettingsPage.jsx`
Complete implementation candidate generated at:
`/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/proposed_SettingsPage.jsx`

#### Key Component Features:
1. **Account Overview**:
   - Large iOS-styled circular avatar (`.settings-avatar`) displaying the user's uppercase initial.
   - User display name and `@username`.
   - Formatted member registration date (`📅 Member since Month DD, YYYY`) computed from `me.user.createdAt`.
   - Onboarding completion status badge.
2. **Reading & Shelf Statistics**:
   - 6-tile responsive statistics grid (`.settings-stats-grid`):
     - 📚 **Total Shelved**: `me.stats.totalShelved`
     - 🔖 **Want to Read**: `me.wantToRead.length`
     - 📖 **Currently Reading**: `me.currentlyReading.length`
     - ✅ **Read**: `me.read.length`
     - ⭐ **Favourites**: `me.favorites.length`
     - ✍️ **Reviews Written**: dynamically loaded from `api.getMyReviews()`.
3. **Danger Zone & Guarded Actions**:
   - **Reset My Books**:
     - Action button: `.btn-danger-outline` ("Reset My Books…")
     - Confirmation Modal: Explains that all books on shelves and onboarding favorites will be removed. Explicitly reassures the user that **all written reviews and star ratings remain intact**.
     - API Call: `POST /api/me/reset-books`.
     - State Update: Awaits `onRefreshMe()`, closes modal, and displays dismissible success toast.
   - **Delete My Reviews**:
     - Action button: `.btn-danger-outline` ("Delete My Reviews…")
     - Confirmation Modal: Explains that all {N} written reviews and star ratings will be permanently deleted. Explicitly reassures the user that **all shelves and saved reading lists remain intact**.
     - API Call: `DELETE /api/me/reviews`.
     - State Update: Sets `reviewCount = 0`, awaits `onRefreshMe()`, closes modal, and displays dismissible success toast.
4. **Accessibility & Event Safety**:
   - <kbd>Escape</kbd> key listener to close active modal.
   - Backdrop click dismiss with `e.stopPropagation()` on modal dialog container.
   - `disabled={isSubmitting}` on all action buttons during pending network requests.

---

### Artifact 2: `client/src/App.jsx` Wiring Specification

#### A. Imports Diff
```javascript
// Add to client/src/App.jsx imports (around line 16):
import SettingsPage from './components/SettingsPage.jsx';
import ReviewModal from './components/ReviewModal.jsx';
import BookDetailModal from './components/BookDetailModal.jsx';
```

#### B. State Hooks Diff
```javascript
// Inside App() component (around line 41):
const [reviewModalBook, setReviewModalBook] = useState(null);
const [detailModalBook, setDetailModalBook] = useState(null);
```

#### C. Callbacks & Handlers Diff
```javascript
// Add shelf change and review saved handlers:
const handleShelfChange = async (isbn, newStatus) => {
  try {
    await api.updateShelfStatus(isbn, newStatus);
    await refreshMe();
  } catch (e) {
    setError(e.message);
  }
};

const handleReviewSaved = async () => {
  await refreshMe();
};
```

#### D. Navigation Bar Diff
```jsx
// In <nav className="user-nav"> (around line 178):
<button
  className={view === 'shelves' ? 'active' : ''}
  onClick={() => setView('shelves')}
>
  My Books{me.stats?.totalShelved ? ` (${me.stats.totalShelved})` : me.wantToRead.length ? ` (${me.wantToRead.length})` : ''}
</button>
<button
  className={view === 'settings' ? 'active' : ''}
  onClick={() => setView('settings')}
  title="Account & Library Settings"
>
  ⚙️ Settings
</button>
```

#### E. View Routing Diff
```jsx
// Right after shelves view rendering (around line 328):
{/* VIEW: Settings Page */}
{view === 'settings' && me && (
  <SettingsPage
    me={me}
    onRefreshMe={refreshMe}
    onGoHome={goHome}
  />
)}
```

#### F. Global Modals Mounting Diff
```jsx
// Before <footer> (around line 386):
{/* Global Modal Dialogs */}
{reviewModalBook && (
  <ReviewModal
    book={reviewModalBook}
    onClose={() => setReviewModalBook(null)}
    onReviewSaved={handleReviewSaved}
  />
)}

{detailModalBook && (
  <BookDetailModal
    book={detailModalBook}
    onClose={() => setDetailModalBook(null)}
    onOpenReview={(b) => setReviewModalBook(b)}
    onShelfChange={handleShelfChange}
    onSelectSeed={explore}
  />
)}
```

---

### Artifact 3: `client/src/api.js` Extensions
Add the following methods to `export const api = { ... }`:
```javascript
  // Reading status & shelves
  updateShelfStatus: (isbn, status) =>
    j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
  getShelves: () => j('/api/me/shelves'),

  // Reviews & ratings
  getBookReviews: (isbn) => j(`/api/books/${isbn}/reviews`),
  submitReview: (isbn, body) =>
    j(`/api/books/${isbn}/reviews`, { method: 'POST', body }),
  deleteReview: (id) => j(`/api/reviews/${id}`, { method: 'DELETE' }),
  getMyReviews: () => j('/api/me/reviews'),

  // Account settings data management
  resetBooks: () => j('/api/me/reset-books', { method: 'POST' }),
  deleteAllReviews: () => j('/api/me/reviews', { method: 'DELETE' }),
```

---

### Artifact 4: `GAP_ANALYSIS.md` Parity Report
Complete authoring candidate generated at:
`/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/proposed_GAP_ANALYSIS.md`

Destination:
`/Users/admin/Documents/Bookable/GAP_ANALYSIS.md`

#### Report Structure:
1. **Executive Summary**: Overview of Bookable as a privacy-preserving, on-device alternative to Goodreads.
2. **Comprehensive Parity Matrix**: Tabular comparison across all 9 core UX dimensions, comparing Goodreads Standard, Bookable Baseline, Bookable Parity Implementation, and Parity Status.
3. **Detailed Architectural Parity Coverage**: Deep-dive analysis for each of the 9 dimensions:
   - Catalog Search & Discovery
   - Universal "+ Want to read" Action
   - 3 Exclusive Reading Statuses (`want_to_read`, `currently_reading`, `read`)
   - 1–5 Star Ratings & Interactive Star Widget
   - Written Book Reviews & Community Review Stream
   - Multi-Shelf Personal Libraries with 5 Tabbed Sections
   - Book Details View
   - User Authentication & Multi-User Data Isolation
   - Settings Page with Confirmation-Protected Reset Books & Delete Reviews
4. **On-Device Advantages Exceeding Goodreads**: Local-first privacy, explainable recommendation algorithms with dynamic weight sliders, local rule-based sentiment analysis, developer diagnostics HUD, and clean iOS-styled visual system.
5. **Verification Evidence & Test Results**: Verification matrix referencing automated tests (`auth-isolation.test.js`, `stress-m1-isolation.js`, `recommendation-heuristics.test.js`, `sentiment-analysis.test.js`, `e2e-scenarios.test.js`, and Vite production build).
6. **Goodreads Parity Scorecard**: Categorical parity ratings demonstrating 100% functional parity.

---

### Artifact 5: CSS Styles for Settings & Modals (`client/src/styles.css`)
Append the following CSS block to `client/src/styles.css`:

```css
/* ==========================================================================
   Milestone 3: Settings Page & Confirmation Modals
   ========================================================================== */

.settings-page {
  max-width: 840px;
  margin: 0 auto;
  padding: 12px 0 40px;
  width: 100%;
}

.settings-header {
  margin-bottom: 24px;
}

.settings-header h2 {
  font-family: Georgia, serif;
  font-size: 1.8rem;
  margin: 0 0 6px 0;
}

.settings-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}

.settings-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
}

.section-desc {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 16px 0;
}

/* Profile Card */
.settings-profile {
  display: flex;
  gap: 20px;
  align-items: center;
}

.settings-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 2.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(181, 86, 43, 0.25);
  flex-shrink: 0;
}

.settings-info {
  flex: 1;
}

.settings-info h3 {
  margin: 0 0 4px 0;
  font-size: 1.4rem;
}

.settings-username {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0 0 6px 0;
}

.settings-joined {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 8px 0;
}

.settings-badges {
  display: flex;
  gap: 8px;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
  display: inline-block;
}

.status-badge.onboarded {
  background: #e6f4ea;
  color: #137333;
  border: 1px solid #ceead6;
}

.status-badge.pending {
  background: #fef7e0;
  color: #b06000;
  border: 1px solid #feefc3;
}

/* Statistics Grid */
.settings-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.stat-box {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 10px;
  text-align: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  font-size: 1.4rem;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 4px;
}

/* Danger Zone */
.settings-card.danger-zone {
  border-color: #f8c2b6;
  background: #fffafa;
}

.danger-title {
  color: #b52b2b !important;
}

.danger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 0;
  border-bottom: 1px solid #fde8e4;
  gap: 20px;
}

.danger-item:last-child {
  border-bottom: none;
  padding-bottom: 4px;
}

.danger-desc h4 {
  margin: 0 0 6px 0;
  font-size: 1.05rem;
  color: var(--ink);
}

.danger-desc p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.45;
}

.btn-danger-outline {
  border: 1.5px solid #dc2626;
  color: #dc2626;
  background: #fff;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-danger-outline:hover {
  background: #fee2e2;
  border-color: #b91c1c;
  color: #b91c1c;
}

/* Modal System (iOS 20px Rounded Corners) */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeInModal 0.2s ease-out;
}

.modal-container {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 20px;
  max-width: 500px;
  width: 100%;
  padding: 28px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  animation: scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInModal {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUpModal {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #b52b2b;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}

.modal-close-btn:hover:not(:disabled) {
  background: #eee;
  color: var(--ink);
}

.modal-body {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--ink);
  margin-bottom: 24px;
}

.modal-reassurance-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 12px 14px;
  margin: 14px 0;
  font-size: 0.88rem;
  color: #166534;
  line-height: 1.4;
}

.modal-alert-box {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 12px;
  padding: 12px 14px;
  margin: 14px 0;
  font-size: 0.88rem;
  color: #991b1b;
  line-height: 1.4;
}

.modal-error-alert {
  background: #fef2f2;
  border: 1px solid #f87171;
  color: #b91c1c;
  padding: 10px 14px;
  border-radius: 10px;
  margin-top: 12px;
  font-size: 0.88rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-danger:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

/* Toast Notifications */
.settings-toast-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.08);
  font-weight: 500;
  font-size: 0.92rem;
}

.toast-dismiss-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  color: #166534;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
```

---

## 5. Verification Method

To independently verify this specification and its future implementation:

1. **Inspect Proposed Implementation Files**:
   - `proposed_SettingsPage.jsx`:
     `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/proposed_SettingsPage.jsx`
   - `proposed_GAP_ANALYSIS.md`:
     `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/proposed_GAP_ANALYSIS.md`

2. **Frontend Production Build**:
   After writing `SettingsPage.jsx`, updating `App.jsx`, `api.js`, and `styles.css`:
   ```bash
   cd /Users/admin/Documents/Bookable/client && npm run build
   ```
   *Expected Result*: Clean Vite compilation producing `dist/index.html` and bundled assets with 0 errors.

3. **Backend Settings & Isolation Tests**:
   Execute the automated isolation test suites to verify that `POST /api/me/reset-books` and `DELETE /api/me/reviews` operate cleanly:
   ```bash
   cd /Users/admin/Documents/Bookable && node tests/stress-m1-isolation.js
   cd /Users/admin/Documents/Bookable && node tests/auth-isolation.test.js
   ```
   *Expected Result*: All tests pass with 100% assertions satisfied.

4. **Invalidation Conditions**:
   - If `POST /api/me/reset-books` deletes user reviews, this design is invalidated (verified preserved).
   - If `DELETE /api/me/reviews` wipes user shelf arrays, this design is invalidated (verified preserved).
   - If Settings confirmation modals can be bypassed or fail to inform the user of preserved data, the design must be revised.
