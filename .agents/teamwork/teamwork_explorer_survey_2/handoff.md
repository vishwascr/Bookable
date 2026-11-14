# Survey Report: Goodreads Parity, User Accounts, Shelves, & Settings (R1 & R2)

## 1. Observation

Direct examination of the Bookable codebase at `/Users/admin/Documents/Bookable` revealed the following exact facts across data models, backend API routes, frontend components, and tests:

### 1.1 Existing Data Models
- **`server/src/models/User.js` (lines 3–12)**:
  ```javascript
  const userSchema = new mongoose.Schema(
    {
      username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
      displayName: { type: String, trim: true, maxlength: 60 },
      passwordHash: { type: String, required: true },
      favorites: { type: [String], default: [] }, // ISBNs picked at onboarding (3–5)
      wantToRead: { type: [String], default: [] }, // ISBNs saved from recommendations
    },
    { timestamps: true, versionKey: false }
  );
  ```
  Observations:
  - User accounts store only two hardcoded arrays of ISBN strings: `favorites` and `wantToRead`.
  - There is NO representation of other reading statuses (`currently_reading`, `read`).
  - There is NO tracking of timestamps for when a book was added, started, or completed.
  - There is NO Review model or review association in the User model.
  - No custom shelf definitions or shelf collections exist.

- **`server/src/models/Book.js` (lines 3–15)**:
  ```javascript
  const bookSchema = new mongoose.Schema(
    {
      isbn: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      author: { type: String, default: '' },
      year: { type: Number, default: null },
      publisher: { type: String, default: '' },
      imageS: String,
      imageM: String,
      imageL: String,
    },
    { versionKey: false }
  );
  ```
  Observations:
  - The catalog stores metadata for 271,359 books imported from `Books.csv`.
  - There are NO rating fields, ratings counts, review counts, or genres/tags in the Book schema.
  - There is NO Review model anywhere in `server/src/models/`.

### 1.2 Authentication & API Endpoints
- **`server/src/auth.js` (lines 8–20)**:
  - JWT token generation using `jwt.sign({ sub: String(user._id), u: user.username }, JWT_SECRET, { expiresIn: '7d' })`.
  - `requireAuth` middleware verifies `Authorization: Bearer <token>` and populates `req.userId`.
- **`server/src/routes/users.js` (lines 24–94)**:
  - `POST /api/auth/signup`: creates user with `bcrypt.hash(password, 10)` after regex validation on username and minimum 6-character password check.
  - `POST /api/auth/login`: checks user by lowercase username and `bcrypt.compare`.
  - `GET /api/me`: returns `user.toPublic()`, populated `favorites`, and populated `wantToRead`.
  - `PUT /api/me/favorites`: validates 3–5 ISBNs and replaces `req.user.favorites`.
  - `POST /api/me/want/:isbn`: appends ISBN to `req.user.wantToRead`.
  - `DELETE /api/me/want/:isbn`: removes ISBN from `req.user.wantToRead`.
  - `GET /api/me/recommend`: runs profile recommendation algorithm using `req.user.favorites` seeds and excluding `req.user.wantToRead`.
  - `GET /api/books/popular`: returns 28 popular curated books for onboarding.
- **Endpoints completely absent in backend**:
  - NO review endpoints (`GET /api/books/:isbn/reviews`, `POST /api/books/:isbn/reviews`, `DELETE /api/reviews/:id`, `GET /api/me/reviews`).
  - NO reading status endpoints (`currently_reading`, `read`).
  - NO settings endpoints for data reset (`POST /api/me/reset-books`, `DELETE /api/me/reviews`).
  - NO custom shelf creation/management endpoints.

### 1.3 Client Application & User Interface
- **`client/src/App.jsx` (lines 28–384)**:
  - Allowed views: `home | search | explore | login | signup | logout | onboarding | foryou | shelves`.
  - There is NO `settings` view or link anywhere in the navigation or view state machine.
  - In `App.jsx:375-376`, `wantSet` and `onToggleWant` are passed to `ResultsRun`, but in `client/src/components/ResultsRun.jsx:8`, the component signature is:
    ```javascript
    export default function ResultsRun({ run, compact, onPick }) { ... }
    ```
    The props `wantSet` and `onToggleWant` are completely ignored by `ResultsRun.jsx`! Users cannot add books to "Want to Read" from single-book recommendations.
- **`client/src/components/SearchResults.jsx` (lines 97–125)**:
  - Each search result card only renders cover, title, author, year, publisher, ISBN, and a single button:
    ```javascript
    <button type="button" className="select-seed-btn" onClick={(e) => { e.stopPropagation(); onSelectSeed(b); }}>
      ✨ Get Recommendations →
    </button>
    ```
  - There is NO "Want to Read" button or reading status control on the Search Results page.
- **`client/src/components/Shelves.jsx` (lines 3–32)**:
  - Only displays two fixed sections: "Favourites" (onboarding seeds) and "Want to Read" (with a "Remove" button).
  - There is no "Currently Reading" shelf, no "Read" shelf, no custom shelves, no rating stars, no review prompts, and no way to transition a book between reading statuses.
- **`client/src/components/SeedPanel.jsx` (lines 3–26)**:
  - Displays seed book metadata and TF-IDF terms, but has NO "Want to Read" button, NO reading status selector, and NO review widget.
- **`client/src/components/AuthPage.jsx` & `LogoutPage.jsx`**:
  - Implements login/signup and dedicated logout screen with mascot and tagline. Functional foundation for auth exists.

### 1.4 Build & Verification Status
- Running `cd client && npm run build`:
  - Build succeeds cleanly in 569ms (`dist/index.html` 0.43 kB, `dist/assets/index-*.js` 265.03 kB).
- Smoke test script (`server/src/scripts/smoke.js`):
  - Validates 36 checks covering index building, search, single recommendations, signup, login, onboarding, profile recommendations, and `/me/want/:isbn`.

---

## 2. Logic Chain

From the observations above, the following logical inferences directly determine the implementation requirements for R1 and R2:

1. **R1 Core UX Gap ("Want to read" & Reading Statuses)**:
   - *Observation*: `wantToRead` is currently implemented solely as a binary array of strings on the `User` model (`User.js:9`), and the UI only renders "+ Want to Read" inside `ForYou.jsx:120`. Search results (`SearchResults.jsx:116`) and single-book recommendations (`ResultsRun.jsx:8`) do not provide any shelf action.
   - *Inference*: To meet R1 ("adding books to personal collections via a 'Want to read' action, updating reading statuses, managing books"), Bookable must introduce:
     - A reusable `ReadingStatusButton` / dropdown available on every book card (Search Results, For You, Single-book recommendations, Book detail/Seed panel).
     - Full three-state reading status semantics: `want_to_read` ("Want to Read"), `currently_reading` ("Currently Reading"), and `read` ("Read").
     - Mutually exclusive transitions: marking a book as `currently_reading` or `read` moves it out of `want_to_read`.

2. **R1 Core UX Gap (Reviews & Ratings for Catalog Books)**:
   - *Observation*: Zero review/rating models, endpoints, or UI components exist in the codebase.
   - *Inference*: To satisfy R1 ("adding reviews to any book in the catalog") and the acceptance criterion ("Users can write and submit reviews and ratings for any book in the catalog"), Bookable must create:
     - A Mongoose `Review` model with `userId`, `username`, `isbn`, `rating` (1–5), `text`, `sentiment` (score, label, keywords), and timestamps.
     - Public endpoint `GET /api/books/:isbn/reviews` returning average rating, rating breakdown, community reviews, and the requesting user's review.
     - Protected endpoint `POST /api/books/:isbn/reviews` allowing any logged-in user to submit or update a review.
     - When marking a book as `read`, or directly on any book card/modal, users must be presented with an interactive 1–5 star rating widget and review submission form.

3. **R2 Multi-User Isolation & Security**:
   - *Observation*: The existing auth uses JWT (`req.userId`), but all user data is confined to `User.favorites` and `User.wantToRead`.
   - *Inference*: To satisfy R2 ("isolated per-user libraries, shelves, and reviews... one user cannot alter or access another user's private library data"):
     - All user-specific records (`UserBook` / shelf items and `Review` records) must strictly reference `userId: req.userId`.
     - Read operations for private shelves must filter strictly by `{ userId: req.userId }`.
     - Write and delete operations on reviews (`DELETE /api/reviews/:id`) must verify `review.userId.equals(req.userId)`. Unauthorized attempts must return 403 or 404 without data alteration.

4. **R2 Settings Page (Reset Books & Delete Reviews)**:
   - *Observation*: There is currently no Settings view in `App.jsx` and no backend route to reset library data or delete user reviews.
   - *Inference*: To satisfy R2 ("Provide a settings page with options allowing users to reset their books and delete their reviews"):
     - Backend must implement:
       - `POST /api/me/reset-books`: clears user's shelves (`wantToRead`, `currentlyReading`, `read`, custom shelves, and favorites) without affecting their written reviews.
       - `DELETE /api/me/reviews`: permanently removes all reviews where `userId === req.userId` without wiping their shelves.
     - Frontend must add a `SettingsPage.jsx` component accessible from the top navigation bar with:
       - Account summary (username, display name, account age, counts of books shelved and reviews written).
       - Distinct "Reset My Books" and "Delete All Reviews" actions protected by explicit confirmation modals to prevent accidental execution.

---

## 3. Comprehensive Goodreads vs Bookable Gap Analysis

The table below documents Bookable's capabilities compared to an on-device Goodreads alternative, detailing current limitations and required parity features:

| UX Dimension | Goodreads Standard | Bookable Current State | Gap Severity | Implemented Parity Specification |
|---|---|---|---|---|
| **Catalog Search & Discovery** | Full-text search by title/author/ISBN; instant autocomplete; search results page with book covers, author, publication date, rating stars, and one-click shelf action. | Full-text search with live autocomplete and 24-book paginated grid (`SearchResults.jsx`). No reading action buttons; no ratings shown. | **Moderate** | Add `ReadingStatusButton` and average rating stars to every search result card in `SearchResults.jsx`. Keep fast MongoDB text indexing and pagination. |
| **"Want to Read" Action** | Prominent green button on every book across the platform; single click adds to Want to Read; dropdown allows picking other statuses. | Only exists on `ForYou.jsx:120`. Ignored on `ResultsRun.jsx:8`. Missing on `SearchResults.jsx` and `SeedPanel.jsx`. | **Critical** | Implement universal `<ReadingStatusButton book={book} />` component with 1-click Want to Read and dropdown for status changes, integrated across Search, For You, ResultsRun, SeedPanel, and Shelves. |
| **Reading Status Management** | 3 standard exclusive shelves: "Want to read", "Currently reading", "Read". Date tracking (started, finished). | Only flat `wantToRead` array. No "Currently reading" or "Read" shelf. No timestamps or status transitions. | **Critical** | Implement three reading statuses: `want_to_read`, `currently_reading`, `read`. Moving to `currently_reading` or `read` automatically removes from `want_to_read`. |
| **Ratings & Star System** | 1 to 5 star rating system. Interactive star hover/click. Shows book average rating and rating distributions (1–5 stars). | Completely absent. No rating field on Book or User models; no rating UI. | **Critical** | Create 1–5 star rating component. Store ratings in `Review` collection. Aggregate average rating and histogram per book on `GET /api/books/:isbn/reviews`. |
| **Book Reviews** | Users can write and edit full text reviews. Community reviews shown on book detail page. | Completely absent. No review schema, no review endpoints, no review UI. | **Critical** | Implement `Review` model (`userId`, `username`, `isbn`, `rating`, `text`, `sentiment`). Provide review submission modal, catalog book review stream, and user's review list. |
| **Personal Shelves ("My Books")** | Dedicated shelves view with tabs for All, Read, Currently Reading, Want to Read, and custom shelves. Sort and filter options. | Barebones `Shelves.jsx` showing only "Favourites" and "Want to Read". No other shelves, no custom shelves, no sorting. | **Critical** | Overhaul `Shelves.jsx` with tabs: **All Books**, **Want to Read**, **Currently Reading**, **Read**, **Favourites**, and custom shelves. Include status switchers, rating display, and book removal. |
| **Book Detail Page** | Full book page with cover, metadata, description, user's shelf status, rating widget, user review form, community reviews, and similar books. | No dedicated book detail page. Clicking a book goes directly to recommendation engine (`SeedPanel` + `ResultsRun`). | **Major** | Expand book explorer/modal to display full book metadata, reading status dropdown, rating/review widget, existing community reviews, and recommendations. |
| **User Authentication** | User registration, login, logout, session persistence. | Functional JWT auth (`/api/auth/signup`, `/api/auth/login`, `AuthPage.jsx`, `LogoutPage.jsx`). | **Minor** | Keep existing robust JWT auth and mascot/tagline styling. Connect user session to library and reviews. |
| **Per-User Isolation** | Complete data privacy: one user cannot view or mutate another user's private library or reviews. | `wantToRead` and `favorites` isolated on `User` doc. No review or library collection isolation exists yet. | **Moderate** | Enforce strict `req.userId` filtering on all library queries and mutations. Enforce ownership verification on review edits/deletions. |
| **Settings & Account Management** | Dedicated settings page to manage profile, reset library books, delete reviews. | Completely missing. No settings view in `App.jsx`, no settings routes in backend. | **Critical** | Add `SettingsPage.jsx` with account info, "Reset Books" action (`POST /api/me/reset-books`), and "Delete Reviews" action (`DELETE /api/me/reviews`) with confirmation modals. |

---

## 4. Technical Specifications for Implementation

### 4.1 Data Architecture

#### A. Review Model (`server/src/models/Review.js`)
```javascript
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, default: '' },
    isbn: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '', trim: true, maxlength: 5000 },
    // Populated by sentiment engine upon submission (bridges to R3)
    sentiment: {
      score: { type: Number, default: 0 }, // -1.0 to 1.0
      label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
      keywords: { type: [String], default: [] },
    },
  },
  { timestamps: true, versionKey: false }
);

// One review per user per book
reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true });
reviewSchema.index({ isbn: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
```

#### B. Reading Status & Shelf Item Representation
To maintain clean backward compatibility with existing tests and `smoke.js` while supporting full reading statuses, update `server/src/models/User.js`:
```javascript
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
    displayName: { type: String, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    favorites: { type: [String], default: [] },           // ISBNs picked at onboarding (3–5)
    wantToRead: { type: [String], default: [] },          // ISBNs in "Want to Read" shelf
    currentlyReading: { type: [String], default: [] },    // ISBNs in "Currently Reading" shelf
    read: { type: [String], default: [] },                // ISBNs in "Read" shelf
    customShelves: {
      type: Map,
      of: [String],                                       // shelfName -> [ISBNs]
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);
```
*Benefits*:
- Fully backwards compatible with existing `User.wantToRead` queries in `users.js` and `smoke.js`.
- Atomic status transitions using Mongoose array operations: moving an ISBN to `currentlyReading` pulls it from `wantToRead` and `read` in a single document update.
- Resetting books is an instantaneous single document update:
  `User.findByIdAndUpdate(req.userId, { wantToRead: [], currentlyReading: [], read: [], customShelves: {}, favorites: [] })`.

### 4.2 Backend API Specifications

#### Reading Statuses & Shelves (`server/src/routes/users.js`)
1. **`GET /api/me`**:
   - Headers: `Authorization: Bearer <token>`
   - Returns:
     ```json
     {
       "user": { "id": "...", "username": "reader42", "displayName": "Jane", "onboarded": true, "createdAt": "..." },
       "favorites": [ ...bookObjects ],
       "wantToRead": [ ...bookObjects ],
       "currentlyReading": [ ...bookObjects ],
       "read": [ ...bookObjects ],
       "customShelves": { "Favorites": [ ...bookObjects ] },
       "stats": {
         "totalBooks": 12,
         "wantToRead": 5,
         "currentlyReading": 2,
         "read": 5,
         "reviewsCount": 4
       }
     }
     ```
2. **`POST /api/me/status/:isbn`**:
   - Headers: `Authorization: Bearer <token>`
   - Body: `{ status: "want_to_read" | "currently_reading" | "read" | "none" }`
   - Semantics:
     - If `want_to_read`: adds to `wantToRead`, removes from `currentlyReading` and `read`.
     - If `currently_reading`: adds to `currentlyReading`, removes from `wantToRead` and `read`.
     - If `read`: adds to `read`, removes from `wantToRead` and `currentlyReading`.
     - If `none`: removes from `wantToRead`, `currentlyReading`, and `read`.
   - Returns: `{ user: PublicUser, status: string }`
3. **`POST /api/me/want/:isbn` & `DELETE /api/me/want/:isbn`**:
   - Retained and internally wired to call the reading status transition logic for 100% backward compatibility with `smoke.js`.

#### Reviews & Ratings (`server/src/routes/api.js` or `routes/reviews.js`)
1. **`GET /api/books/:isbn/reviews`**:
   - Public endpoint (with optional Bearer token).
   - Calculates:
     - `averageRating`: average of all ratings for this ISBN (rounded to 1 decimal).
     - `totalReviews`: total count of reviews for this ISBN.
     - `ratingDistribution`: `{ 1: count, 2: count, 3: count, 4: count, 5: count }`.
     - `reviews`: list of review objects (with `username`, `displayName`, `rating`, `text`, `sentiment`, `createdAt`), sorted newest first.
     - `userReview`: the authenticated user's review if logged in, or `null`.
2. **`POST /api/books/:isbn/reviews`**:
   - Headers: `Authorization: Bearer <token>`
   - Body: `{ rating: Number (1-5), text: String }`
   - Logic:
     - Upserts `Review` for `{ userId: req.userId, isbn: req.params.isbn }`.
     - Triggers local sentiment analysis on `text` (positive/neutral/negative and score).
     - If the book is not already marked as `read`, adds it to user's `read` shelf.
     - Returns `{ review: savedReview, stats: { averageRating, totalReviews } }`.
3. **`DELETE /api/reviews/:id`**:
   - Headers: `Authorization: Bearer <token>`
   - Deletes review where `_id === req.params.id AND userId === req.userId`. Returns 404/403 if unauthorized.
4. **`GET /api/me/reviews`**:
   - Headers: `Authorization: Bearer <token>`
   - Returns all reviews written by current user, populated with book titles and covers.

#### Settings & Data Management (R2)
1. **`POST /api/me/reset-books`**:
   - Headers: `Authorization: Bearer <token>`
   - Logic:
     - Clears user's `wantToRead = []`, `currentlyReading = []`, `read = []`, `customShelves = {}`, and `favorites = []`.
     - Leaves user account and reviews completely intact.
     - Returns `{ success: true, message: 'All books and shelves have been reset.' }`.
2. **`DELETE /api/me/reviews`**:
   - Headers: `Authorization: Bearer <token>`
   - Logic:
     - Executes `Review.deleteMany({ userId: req.userId })`.
     - Leaves user account and shelved books completely intact.
     - Returns `{ success: true, deletedCount: N, message: 'All reviews have been deleted.' }`.

---

### 4.3 Frontend Component Architecture

1. **`client/src/components/ReadingStatusButton.jsx`**:
   - Reusable component for displaying current reading status and changing it.
   - Props: `book`, `status` (`'want_to_read' | 'currently_reading' | 'read' | null`), `onStatusChange`.
   - Behavior:
     - When not shelved: Displays green "+ Want to Read" button with chevron dropdown arrow.
     - Clicking the main button immediately sets status to `want_to_read`.
     - Clicking the chevron opens a dropdown menu:
       - "Want to Read"
       - "Currently Reading"
       - "Read"
       - Divider
       - "Remove from My Books" (if shelved)
     - When shelved: Displays active status (e.g. "✓ Want to Read", "📖 Currently Reading", "✓ Read") with dropdown indicator.
2. **`client/src/components/ReviewModal.jsx` & `StarRating.jsx`**:
   - `StarRating`: Renders 5 interactive stars with hover effects, click to set rating (1 to 5).
   - `ReviewModal`: Dialog allowing user to rate the book, type text review, view live character count, submit, or delete review.
3. **`client/src/components/Shelves.jsx` Overhaul**:
   - Tabs at top:
     - **All Books** (`total`)
     - **Want to Read** (`wantToRead.length`)
     - **Currently Reading** (`currentlyReading.length`)
     - **Read** (`read.length`)
     - **Favourites** (`favorites.length`)
   - Inside shelf cards/rows:
     - Book cover (`Cover.jsx`), title, author, year, publisher.
     - ReadingStatusButton to switch status or remove.
     - Star rating widget.
     - "Review" button that opens `ReviewModal`.
4. **`client/src/components/SettingsPage.jsx`**:
   - Accessible via "Settings" link in top navigation.
   - Section 1: Profile information (avatar, username, display name, member since).
   - Section 2: Library Statistics (books on shelves, books read, reviews submitted).
   - Section 3: Danger Zone:
     - **Reset Books**: Button triggers a confirmation dialog ("Are you sure you want to remove all books from your shelves? This cannot be undone."). On confirmation, calls `POST /api/me/reset-books`, updates `me` state, and shows success toast.
     - **Delete Reviews**: Button triggers a confirmation dialog ("Are you sure you want to delete all your reviews? This will delete N reviews permanently."). On confirmation, calls `DELETE /api/me/reviews`, updates state, and shows success toast.
5. **Integration Points in `App.jsx`**:
   - Add `'settings'` to view state machine: `view === 'settings' && <SettingsPage me={me} onRefresh={refreshMe} onGoHome={goHome} />`.
   - Add `<button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button>` to logged-in navigation.
   - Wire `ReadingStatusButton` into:
     - `SearchResults.jsx`: on each book card.
     - `SeedPanel.jsx`: for the currently explored seed book.
     - `ResultsRun.jsx`: on each recommended book item.
     - `ForYou.jsx`: replacing the one-off toggle button.

---

## 5. Caveats

1. **Book Catalog Ratings**: `Books.csv` does not contain historical Goodreads ratings or genres in its raw schema. All ratings and reviews in Bookable will originate from registered users on the system (on-device / local database), which computes real-time catalog averages as reviews are written.
2. **Recommendation Engine Interdependence (R3)**: While R1/R2 defines the Review data model and API endpoints, the sentiment analysis calculation upon review submission connects directly with R3 (Explorer 3's domain). The Review model schema specified here includes `{ sentiment: { score, label, keywords } }` to ensure complete compatibility.
3. **Existing Smoke Test Continuity**: The existing `server/src/scripts/smoke.js` relies on `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn`. The proposed architecture preserves these endpoints as direct wrappers around the new status management logic, guaranteeing that zero regression occurs.

---

## 6. Conclusion

- **Goodreads Core Parity (R1)** requires:
  1. Universal `ReadingStatusButton` providing 1-click "Want to Read" and full reading statuses (`want_to_read`, `currently_reading`, `read`) across Search Results, Seed Panel, Recommendation Runs, For You, and Shelves.
  2. Complete `Review` model and API endpoints (`GET/POST /api/books/:isbn/reviews`, `DELETE /api/reviews/:id`) enabling 1–5 star ratings and written reviews for any catalog book.
  3. Overhauled `Shelves.jsx` supporting tabbed views (All Books, Want to Read, Currently Reading, Read, Favourites), sorting, rating display, and shelf management.
- **Multi-User Accounts, Shelves & Settings (R2)** requires:
  1. Strict per-user isolation: all shelf items, reading statuses, and reviews strictly scoped to `req.userId` derived from verified JWT tokens.
  2. Dedicated `SettingsPage.jsx` component and backend endpoints:
     - `POST /api/me/reset-books` to reset all user shelves and onboarding favorites.
     - `DELETE /api/me/reviews` to permanently delete all user reviews with confirmation modals.
  3. Clean navigation integration in `App.jsx` exposing Settings to all authenticated users.

---

## 7. Verification Method

To independently verify the findings and test the future implementation:

1. **Inspect Existing Files**:
   - `server/src/models/User.js`: verify lack of `currentlyReading`, `read`, or review schemas.
   - `server/src/routes/users.js`: verify absence of review, status, and reset endpoints.
   - `client/src/App.jsx` & `client/src/components/Shelves.jsx`: verify absence of settings view and limited shelf support.
   - `client/src/components/SearchResults.jsx`: verify absence of "Want to Read" action.
2. **Execute Existing Verification Commands**:
   - Client build verification:
     ```bash
     cd /Users/admin/Documents/Bookable/client && npm run build
     ```
     *Expectation*: Compiles with 0 errors via Vite.
   - Server smoke test (requires running mongod & API server):
     ```bash
     cd /Users/admin/Documents/Bookable/server && npm run smoke
     ```
     *Expectation*: 36/36 checks pass.
3. **Invalidation Conditions**:
   - If `User.js` already contains multi-shelf status fields or if `Review.js` exists, this finding is invalidated (verified absent).
   - If `App.jsx` already contains a Settings view, this finding is invalidated (verified absent).
