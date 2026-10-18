# 01 · Requirements & Design Decisions

## Goal
Build a book recommendation web app around `Books.csv` that offers **multiple recommendation
algorithms**, lets the user **select an algorithm**, and **shows how the algorithm produced its
results**. Supports both public book exploration and **personalized multi-book recommendations**
via user accounts and Goodreads-inspired onboarding.

## Design interview outcomes (grill-me)
| # | Question | Decision |
|---|---|---|
| 1 | The CSV has only metadata (ISBN, title, author, year, publisher, cover URLs) — no ratings. Which algorithms? | **Metadata-only**: TF-IDF title similarity, Same Author, Same Publisher & Era, Era + Theme, and a Weighted Hybrid — each with a score breakdown. |
| 2 | Stack & scope | **Vite + React** frontend, **Express** API, **local MongoDB**, plain CSS. |
| 3 | Core UX | Search a book (via live autocomplete or **hitting Return for a dedicated paginated search results page**) → select a seed book → pick an algorithm **or compare all side-by-side** → results with a **per-result score breakdown**, a **"How it works"** explainer, and seamless breadcrumbs to navigate back. |
| 4 | User accounts & auth | **Real accounts**: username + password (bcrypt) stored in MongoDB, JWT stored in `localStorage`, login/signup forms with the brand tagline and reserved mascot slot. |
| 5 | Tagline & Mascot space | Display the brand tagline: **“Bookable - Where wisdom meets technology”** on auth pages and preserve a designated, responsive **Mascot Slot** for an upcoming character asset. |
| 6 | Logout flow | Dedicated **Logout Page** with session termination confirmation and a primary button returning directly to the login page. |
| 7 | Goodreads-style onboarding | After signup, user picks 3–5 favorite books from a curated popular grid or search. Picks become the user's **Favorites** shelf (editable later). |
| 8 | Multi-book recommendation aggregation | **Profile aggregation**: runs each algorithm for every favorite, averages scores per candidate, applies greedy diversity re-ranking, and displays **“Because you liked…”** tags + per-seed contribution bars. |
| 9 | Shelves & logged-in experience | Logged-in users land on **For You**; single-book exploration and search remain accessible to all. Includes a **Want to Read** shelf with one-click toggles. |

## Functional requirements
- **FR1** Import all rows of `Books.csv` into MongoDB (idempotent re-import).
- **FR2** Full-text search by title/author with:
  - Debounced autocomplete dropdown for instant seed selection.
  - **Dedicated Search Results page** when hitting Return or clicking Search, with responsive card grid, covers, metadata, and pagination controls (24 books/page).
- **FR3** Five algorithms, selectable from the UI.
- **FR4** "Compare all" mode runs every algorithm on the same seed.
- **FR5** Each result shows its final score and the four underlying features (title, author, publisher, year).
- **FR6** Each algorithm has a plain-language explanation and formula.
- **FR7** Hybrid weights adjustable live with sliders.
- **FR8** Clicking a result makes it the new seed (exploration) or navigate back to search results via breadcrumbs.
- **FR9** User authentication: register, login, session validation via JWT, bcrypt password hashing.
- **FR10** Brand tagline: **“Bookable - Where wisdom meets technology”** displayed prominently on auth and logout views.
- **FR11** Mascot slot: dedicated, styled container (`.mascot-slot`) reserved on login and logout screens.
- **FR12** Logout experience: dedicated logout screen confirming session termination with a direct button back to login.
- **FR13** Goodreads-style onboarding: pick 3–5 favorite books before viewing personalized recommendations.
- **FR14** Profile recommendations: multi-seed aggregation over favorites with diversity re-ranking and explanation breakdown.
- **FR15** User shelves: Favorites (seeds) and Want to Read list with toggle buttons.

## Non-functional requirements
- Recommendation latency < 50 ms (achieved: ~1–10 ms single seed, ~10–35 ms multi-seed profile).
- No external services/keys required.
- Editions/translations of the same work are collapsed so results are diverse.

## Out of scope
Collaborative filtering / user-user similarity across the 271k books (requires external interaction matrix / `Ratings.csv` from Book-Crossing) — see [10-future-work.md](10-future-work.md).

