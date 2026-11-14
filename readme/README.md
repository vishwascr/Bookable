# 📚 Bookable — Documentation

Bookable is an **on-device Goodreads alternative** built on **MERN** (MongoDB · Express · React · Node) that recommends books from `Books.csv` (≈271k books, Book-Crossing dataset) using **selectable local algorithms**, **3-book seed + review sentiment recommendations** (zero title-similarity weighting), and an **iOS-inspired 20px rounded UI** with **Dev Mode** diagnostics.

| Doc | Contents |
|---|---|
| [../GAP_ANALYSIS.md](../GAP_ANALYSIS.md) | Goodreads feature-parity audit and implemented overhaul capabilities |
| [../TEST_INFRA.md](../TEST_INFRA.md) | E2E & adversarial test infrastructure |
| [../TEST_READY.md](../TEST_READY.md) | Test runner setup and verification summary |
| [01-requirements.md](01-requirements.md) | Goals, decisions agreed during the design interview, scope |
| [02-phases.md](02-phases.md) | The build phases, deliverables and status |
| [03-architecture.md](03-architecture.md) | System design, data flow, folder layout |
| [04-data.md](04-data.md) | The dataset, cleaning rules, MongoDB schema |
| [05-algorithms.md](05-algorithms.md) | Every algorithm, its maths and trade-offs |
| [06-api.md](06-api.md) | REST endpoints with examples |
| [07-frontend.md](07-frontend.md) | UI components and UX flow |
| [08-setup.md](08-setup.md) | How to install, import and run |
| [09-testing.md](09-testing.md) | Verification performed and how to re-run it |
| [10-future-work.md](10-future-work.md) | Known limitations and next steps |
| [11-accounts-and-personalisation.md](11-accounts-and-personalisation.md) | User accounts, Goodreads onboarding, mascot slot, tagline, logout flow, and personalised recommendations |

## Quick start
```bash
# 1. MongoDB must be running locally (mongod)
cd server && npm install && npm run import && npm start   # API on :5050
cd client && npm install && npm run dev                    # UI on :5173
```
Open http://localhost:5173, search a book, pick an algorithm (or **Compare all**).
