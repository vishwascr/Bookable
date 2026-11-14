# Scope: E2E Testing Track

## Status: DONE (Gate PASS)

## Architecture
- Standalone test runner in `tests/run-all.js` (using Node.js 24 built-in `node:test`, `node:assert/strict`, and native `fetch`)
- Test suites in `tests/`:
  - `tests/auth-isolation.test.js`: User auth, token security, and per-user data isolation (21 tests)
  - `tests/recommendation-heuristics.test.js`: 3-seed recommendations, strict title similarity exclusion ($w_{\text{title}} = 0$), and weight customization (30 tests)
  - `tests/sentiment-analysis.test.js`: Local review sentiment analysis and sentiment-adapted recommendations (20 tests)
  - `tests/e2e-scenarios.test.js`: Shelves, reading statuses, reviews, settings reset/delete, Tier 3 pairwise combinations, and Tier 4 user journeys (49 tests)
- Documentation & Artifacts:
  - `TEST_INFRA.md`: Full test architecture, commands, and coverage thresholds
  - `TEST_READY.md`: Completion publication artifact with 10-feature coverage checklist and tier breakdown
  - `package.json`: Root ESM declaration with `"type": "module"` and `"scripts": { "test": "node tests/run-all.js" }`
  - Git Commit: `0e2d75f` ("Harden E2E test assertions and dynamic baseline counting")

## Feature Inventory
| # | Feature | Description | Milestone | Status | Source |
|---|---------|-------------|-----------|--------|--------|
| 1 | User Auth & Session | Registration, login, logout, password hashing, JWT | E2E | DONE | R2, AC2 |
| 2 | Multi-User Data Isolation | Isolated shelves, reading status, reviews, mutation guards | E2E | DONE | R2, AC2 |
| 3 | Reading Statuses & Shelves | 3 exclusive statuses, shelf grouping, shelf transitions | E2E | DONE | R1, R2, AC1 |
| 4 | Reviews & Star Ratings | 1-5 star ratings, review CRUD, community aggregation | E2E | DONE | R1, AC1 |
| 5 | Settings Reset & Delete | POST /api/me/reset-books, DELETE /api/me/reviews | E2E | DONE | R2, AC2 |
| 6 | 3-Seed Book Recommendations | Heuristic scoring (genre, author, tag, rating) from 3 seeds | E2E | DONE | R3, AC3 |
| 7 | Title Similarity Exclusion | Strict w_title = 0, no title TF-IDF similarity | E2E | DONE | R3, AC3 |
| 8 | Review Sentiment Analysis | Local lexicon analysis (score, label, keywords) | E2E | DONE | R3, AC3 |
| 9 | Sentiment-Adapted Recommendations | Recommendations adjusted by review sentiment | E2E | DONE | R3, AC3 |
| 10| Algorithm Customization | Dynamic weight adjustment verification | E2E | DONE | R3, AC3 |

## Test Tiers & Verified Results
| Tier | Description | Quota Threshold | Implemented | Result |
|------|-------------|-----------------|-------------|--------|
| Tier 1 | Feature Coverage (Happy Path) | $\ge 5$ per feature ($\ge 50$) | 50 tests | 50 PASS / 0 FAIL |
| Tier 2 | Boundary & Corner Cases | $\ge 5$ per feature ($\ge 50$) | 52 tests | 52 PASS / 0 FAIL |
| Tier 3 | Cross-Feature Combinations | $\ge 10$ tests | 12 tests | 12 PASS / 0 FAIL |
| Tier 4 | Real-World Application Scenarios | $\ge 5$ tests | 6 tests | 6 PASS / 0 FAIL |
| **Total** | **All 4 Tiers Combined** | **$\ge 115$ tests** | **120 tests** | **120 PASS / 0 FAIL (100%)** |
