## 2026-11-13T18:33:52Z
Transform Bookable into a polished, iOS-styled on-device alternative to Goodreads ready for web publishing and multi-user access, featuring customizable 3-book and review sentiment recommendations, personal shelves, dev mode diagnostics, and account management.

Working directory: /Users/admin/Documents/Bookable
Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic.

## Requirements

### R1. Goodreads Core UX and Gap Closure
Audit and overhaul Bookable to deliver an intuitive Goodreads-like experience for standard users, including adding books to personal collections via a "Want to read" action, updating reading statuses, managing books, and adding reviews to any book in the catalog. Document findings and implemented parity features in a gap analysis report.

### R2. Multi-User Accounts, Shelves, and Settings
Implement user registration, authentication (log in / log out), and isolated per-user libraries, shelves, and reviews. Provide a settings page with options allowing users to reset their books and delete their reviews.

### R3. Recommendation Engine and Review Sentiment Analysis
Implement a local recommendation engine that generates suggestions from three selected seed books using metadata heuristics (genres, authors, tags, and ratings) without title similarity weighting. Submitting a book review must trigger local sentiment analysis that adapts and expands recommendations based on review sentiment. Include a toggle at the top of the interface to customize recommendation algorithm parameters.

### R4. Dev Mode and iOS-Inspired Interface
Apply an iOS-like visual design across the application featuring 20px rounded corners for cards, modals, and primary containers. Provide a "Dev mode" toggle that reveals under-the-hood diagnostics (sentiment analysis outputs, algorithm metrics, and internal state) to developers and power users while keeping standard Goodreads browsing clean.

### R5. Local Server Reliability and Production Readiness
Ensure the backend API and frontend client run reliably locally, pass automated tests covering authentication, recommendation calculations, and review sentiment handling, and prepare the project for production web publishing.

## Acceptance Criteria

### Goodreads Experience & Gap Analysis
- [ ] A gap analysis document is created detailing Bookable's capabilities compared to an on-device Goodreads alternative and listing all implemented parity features.
- [ ] Users can browse books and add any book to their collection via a "Want to read" action.
- [ ] Users can write and submit reviews and ratings for any book in the catalog.

### Multi-User Support & Settings
- [ ] Users can register, log in, and log out with reading history, shelves, and reviews isolated per account.
- [ ] A settings page provides functional controls to reset books and delete user reviews.
- [ ] Private user data is protected so one user cannot alter or access another user's private library data.

### Recommendation & Sentiment Engine
- [ ] Selecting three books produces tailored recommendations using author, genre, tag, and rating heuristics, with title similarity weight excluded.
- [ ] A toggle at the top allows users to customize recommendation algorithm weights and parameters.
- [ ] Submitting a review executes local sentiment analysis and recommends additional books reflecting the sentiment of the review.

### UI Styling & Dev Mode
- [ ] Application cards, modals, and key interactive containers use an iOS-inspired design with 20px rounded corners.
- [ ] A "Dev mode" toggle is available in the interface; when disabled, under-the-hood technical details and raw sentiment scores remain hidden, and when enabled, the sentiment analysis output and algorithm internals are visible.

### Server & Verification
- [ ] Automated tests verify account authentication, data isolation, recommendation logic (without title weighting), and review sentiment processing.
- [ ] All existing and new automated tests pass without errors.
- [ ] The production web build succeeds and local servers run without fatal crashes.


## 2026-11-13T19:52:22Z
The quota cooldown window has passed. Please check the current state of your active milestones/workers and resume the Teamwork run from where it paused.


## 2026-11-13T19:57:05Z
New user instruction received and recorded:
"commit after every substep is completed"

Please ensure changes are committed to git (excluding `.agents/` and temporary test artifacts) after every completed substep/milestone. If `git commit` hits a sandbox permission error inside your workers, report each completed substep/milestone immediately with the files to commit so we can escalate to the user/parent agent.


## 2026-11-13T20:14:22Z
Milestone 2 has been committed on main as `8b73a58` (`feat(recommender): implement 3-book heuristic engine and local sentiment analyzer`). Proceed with next milestones/substeps.


## 2026-11-13T20:51:16Z
Milestone 3 has been committed on main as `b0522c1` (`feat(goodreads): implement reading statuses, tabbed shelves, review modals, settings, and gap analysis`). Proceed with Milestone 4.


## 2026-11-14T01:32:20Z
Liveness check: Please check the status of Milestone 4 Sub-Orchestrator and active Explorers, and update progress.


## 2026-11-14T01:35:26Z
New user requirement received:
1. Onboarding ("Pick 3–5 books you love"):
   - After picking 3–5 books, add an optional step asking for reviews of those selected books for sentiment analysis.
   - Include left/right arrows to toggle between the selected books, with a star rating and optional review text for each book.
2. Public Reviews:
   - Reviews shared by a user must be public and appear for other users viewing that book (e.g., in the BookDetailModal / community reviews stream).

Please incorporate this into the active frontend work (Milestone 4 / UI components), verify end-to-end, and prepare the files for git commit once the gate passes.
