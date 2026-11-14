# Explorer 1 Survey Report: Codebase & Architecture

## Observation
- Root Directory: Node/Express backend (`server/`) + React 19 / Vite frontend (`client/`), `Books.csv` (73.3MB Book-Crossing dataset), `readme/` docs (01 to 11).
- Backend (`server/`):
  - Node.js ESM (`"type": "module"`).
  - Dependencies: express 5.3.0, mongoose 9.11.2, jsonwebtoken 9.0.3, bcryptjs 3.0.3, csv-parse 7.0.3, dotenv 18.0.8, cors 2.8.6.
  - MongoDB connection via Mongoose (`MONGO_URI=mongodb://127.0.0.1:27017/bookable`, `PORT=5050`).
  - Models: `Book.js`, `User.js`.
  - Routes: `api.js`, `users.js`.
  - Recommender: `algorithms.js`, `engine.js`, `text.js`.
  - Scripts: `import.js`, `smoke.js`.
- Frontend (`client/`):
  - React 19, Vite 8.3.4, port 5173, reverse proxy `/api` to `http://localhost:5050`.
  - Components: `AuthPage.jsx`, `Shelves.jsx`, `SearchBar.jsx`, `SearchResults.jsx`, `SeedPanel.jsx`, `AlgorithmPicker.jsx`, `WeightSliders.jsx`, `ResultsRun.jsx`, `ForYou.jsx`, `HowItWorks.jsx`, `LogoutPage.jsx`, `Cover.jsx`, `Mascot.jsx`.
  - CSS: `client/src/styles.css`.
- Testing:
  - No automated test runner configured in package.json (currently only `smoke.js`).
  - Need automated test runner (e.g. node:test or vitest) covering auth, data isolation, recommendation logic, review sentiment.

## Logic Chain & Key Gaps
- R1: Need Goodreads core UX: "Want to read" status action, reading statuses (Want to read, Currently reading, Read), book management, ratings & reviews for any book in catalog, plus a comprehensive Gap Analysis report document.
- R2: Multi-user auth & isolation: Register, login, logout, isolated shelves/libraries/reviews, Settings page with book reset and review deletion.
- R3: 3-book recommendation engine: heuristic weights for author, genre, tags, ratings; EXCLUDE title similarity weighting. Toggle to customize weights. Review submission triggers local sentiment analysis that adapts recommendations.
- R4: iOS design with 20px rounded corners on cards, modals, interactive containers. Dev mode toggle showing sentiment analysis outputs and algorithm diagnostics.
- R5: Automated test suites, local server reliability, production build verification.
