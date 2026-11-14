# 📚 Bookable — Documentation

Bookable is an **on-device Goodreads alternative** built on **MERN** (MongoDB · Express · React · Node) that recommends books from `Books.csv` (≈271k books, Book-Crossing dataset) using **selectable local algorithms**, **3-book seed + review sentiment recommendations** (with zero title-similarity weighting), and an **iOS-inspired 20px rounded UI** with **Dev Mode** diagnostics.

| Doc | Contents |
|---|---|
| [GAP_ANALYSIS.md](GAP_ANALYSIS.md) | Goodreads feature-parity audit and implemented overhaul capabilities |
| [TEST_INFRA.md](TEST_INFRA.md) | 4-tier E2E & adversarial test infrastructure |
| [TEST_READY.md](TEST_READY.md) | Test runner setup and verification summary |
| [readme/01-requirements.md](readme/01-requirements.md) | Goals, decisions agreed during the design interview, scope |
| [readme/02-phases.md](readme/02-phases.md) | The build phases, deliverables and status |
| [readme/03-architecture.md](readme/03-architecture.md) | System design, data flow, folder layout |
| [readme/04-data.md](readme/04-data.md) | The dataset, cleaning rules, MongoDB schema |
| [readme/05-algorithms.md](readme/05-algorithms.md) | Every algorithm, its maths and trade-offs |
| [readme/06-api.md](readme/06-api.md) | REST endpoints with examples |
| [readme/07-frontend.md](readme/07-frontend.md) | UI components and UX flow |
| [readme/08-setup.md](readme/08-setup.md) | How to install, import and run |
| [readme/09-testing.md](readme/09-testing.md) | Verification performed and how to re-run it |
| [readme/10-future-work.md](readme/10-future-work.md) | Known limitations and next steps |
| [readme/11-accounts-and-personalisation.md](readme/11-accounts-and-personalisation.md) | User accounts, Goodreads onboarding, mascot, tagline, logout flow, and personalised recommendations |

## Quick start
```bash
# 1. MongoDB must be running locally (mongod)
cd server && npm install && npm run import && npm start   # API on :5050
cd client && npm install && npm run dev                    # UI on :5173
```
Open http://localhost:5173, search a book, pick an algorithm (or **Compare all**).
