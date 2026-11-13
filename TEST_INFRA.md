# Bookable E2E Test Infrastructure Documentation

## 1. Overview & Architecture

The Bookable End-to-End (E2E) test suite is an automated, requirement-driven verification track that validates all backend and integrated features across the application. The test suite is implemented using **Node.js 24 native capabilities**:
- **Test Runner**: Built-in `node:test` (`describe`, `it`, `run`) with `node:test/reporters` (`spec`).
- **Assertions**: Built-in `node:assert/strict` (`assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`).
- **HTTP Client**: Built-in global `fetch` API (`Headers`, `Request`, `Response`, `AbortSignal.timeout`).
- **Security / Token Generation**: Built-in `node:crypto` HMAC SHA256 for JWT token manipulation and verification.
- **Zero External Dependencies**: Operates with no third-party test runners or libraries, ensuring maximum execution speed and zero dependency conflicts.

---

## 2. Test Execution & CLI Commands

### Standard Execution
From the project root:
```bash
# Execute entire test suite across all 4 suites
npm test

# Direct runner invocation
node tests/run-all.js
```

### Targeted Execution
Filter specific test suites using the `--suite` flag:
```bash
# Run only auth and isolation tests
node tests/run-all.js --suite=auth

# Run only recommendation heuristics tests
node tests/run-all.js --suite=rec

# Run only sentiment analysis tests
node tests/run-all.js --suite=sentiment

# Run only e2e scenarios and workflows
node tests/run-all.js --suite=scenarios
```

### Direct `node --test` Invocations
Individual suites can also be executed directly via Node's native test runner:
```bash
node --test tests/auth-isolation.test.js
node --test tests/recommendation-heuristics.test.js
node --test tests/sentiment-analysis.test.js
node --test tests/e2e-scenarios.test.js
```

---

## 3. Test Suite Organization & File Layout

```
/Users/admin/Documents/Bookable/
├── package.json                         # Root manifest declaring "type": "module" & "npm test"
├── tests/
│   ├── run-all.js                       # Master runner with pre-flight check & summary reporter
│   ├── helpers.js                       # Reusable test helpers (fetch wrapper, auth, seeds, cleanup)
│   ├── auth-isolation.test.js           # Features 1 & 2: User auth, token validation, multi-user isolation (21 tests)
│   ├── recommendation-heuristics.test.js# Features 6, 7 & 10: 3-seed recommendations, title exclusion, custom weights (30 tests)
│   ├── sentiment-analysis.test.js       # Features 8 & 9: Local sentiment analysis & adapted recommendations (20 tests)
│   └── e2e-scenarios.test.js            # Features 3, 4, 5, plus Tier 3 cross-feature & Tier 4 user scenarios (49 tests)
├── TEST_INFRA.md                        # Test infrastructure documentation (this file)
└── TEST_READY.md                        # Test completion signal & coverage matrix
```

---

## 4. Test Tiers & Coverage Thresholds

The suite implements a 4-tier testing hierarchy containing **120 test cases**, satisfying and exceeding all coverage quotas:

| Tier | Category | Quota Threshold | Implemented | Coverage Focus |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage (Happy Path) | $\ge 5$ per feature ($\ge 50$ total) | **50 tests** | Primary workflows for all 10 features in `SCOPE.md` |
| **Tier 2** | Boundary & Corner Cases | $\ge 5$ per feature ($\ge 50$ total) | **52 tests** | Validation limits, malformed inputs, out-of-range ratings, unauthorized requests |
| **Tier 3** | Cross-Feature Combinations | $\ge 10$ tests | **12 tests** | Pairwise interactions between Auth, Shelves, Reviews, Sentiment, and Settings |
| **Tier 4** | Real-World Application Scenarios | $\ge 5$ tests | **6 tests** | Multi-step end-to-end user journeys (discovery, critical reviewer, curation, data deletion) |
| **Total** | Full E2E Test Catalog | **$\ge 115$ tests** | **120 tests** | 100% feature and requirement verification |

---

## 5. Feature Coverage Matrix (10 Features)

| Feature # | Feature Name | Primary Test File | Tier 1 | Tier 2 | Total |
|---|---|---|---|---|---|
| **F1** | User Auth & Session | `auth-isolation.test.js` | 5 | 6 | 11 |
| **F2** | Multi-User Data Isolation | `auth-isolation.test.js` | 5 | 5 | 10 |
| **F3** | Reading Statuses & Shelves | `e2e-scenarios.test.js` | 5 | 5 | 10 |
| **F4** | Reviews & Star Ratings | `e2e-scenarios.test.js` | 5 | 6 | 11 |
| **F5** | Settings Reset & Delete | `e2e-scenarios.test.js` | 5 | 5 | 10 |
| **F6** | 3-Seed Book Recommendations | `recommendation-heuristics.test.js` | 5 | 5 | 10 |
| **F7** | Title Similarity Exclusion ($w_{\text{title}} = 0$) | `recommendation-heuristics.test.js` | 5 | 5 | 10 |
| **F8** | Review Sentiment Analysis | `sentiment-analysis.test.js` | 5 | 5 | 10 |
| **F9** | Sentiment-Adapted Recommendations | `sentiment-analysis.test.js` | 5 | 5 | 10 |
| **F10** | Algorithm Customization | `recommendation-heuristics.test.js` | 5 | 5 | 10 |
| **T3** | Cross-Feature Combinations | `e2e-scenarios.test.js` | — | — | 12 |
| **T4** | Real-World User Scenarios | `e2e-scenarios.test.js` | — | — | 6 |
| **Total**| **All Features Across 4 Tiers** | — | **50** | **52** | **120** |

---

## 6. Test Isolation, Data Integrity & Preflight Diagnostics

1. **Unique User Namespaces**:
   Each test creates its own independent test account using `uniqueUsername()`, generating distinct usernames (e.g., `test_u_m3k2_8fa12`) and separate JWT tokens. No test shares account credentials with another test.

2. **Immutable Catalog & Isolated Reviews**:
   Tests never mutate the 271,359 catalog `Book` records. Catalog queries use verified seed constants defined in `KNOWN_SEEDS`. Review submission tests perform teardown via `DELETE /api/reviews/:id` or isolated users to prevent database state accumulation across runs.

3. **Dynamic Baseline Counting**:
   Tests verifying aggregate count and average rating mutations (such as `T1-REV-05`) use dynamic baseline capture: querying initial `totalReviews` and `averageRating` before posting, asserting exact incremental changes (`initialCount + 1`), strictly verifying HTTP 204 No Content on review deletion, and asserting complete restoration to `initialCount` and `initialAvg`.

4. **Strict HTTP Assertion Hardening**:
   Permissive assertions (such as `[200, 404]`) have been removed in favor of strict, deterministic status code validations (200 OK, 201 Created, 204 No Content, 403 Forbidden) and state payload assertions conforming strictly to `PROJECT.md § Interface Contracts`.

5. **Preflight Server Readiness**:
   `tests/run-all.js` polls `GET /api/health` before running test suites. If the recommender index is still building, it allows polling up to 20 seconds to ensure tests do not fail on transient indexing states.

6. **Sequential Execution**:
   `tests/run-all.js` executes test suites sequentially (`concurrency: 1`) to preserve data isolation and prevent concurrent review mutations against shared seed books.

7. **Exit Codes**:
   - `0`: All tests passed cleanly.
   - `1`: One or more assertions failed or server unreachable.
