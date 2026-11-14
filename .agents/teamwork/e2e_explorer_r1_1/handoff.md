# Handoff Report: E2E Test Runner & Infrastructure Architecture Investigation

**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_explorer_r1_1`  
**Date**: 2026-11-13  
**Role**: Explorer (E2E Test Runner & Infrastructure Architecture)  
**Parent Conversation ID**: `10a6c306-1c88-446c-b310-382d63518784`  

---

## 1. Observation

Direct observations from codebase inspection, runtime environment checks, and dependency audits:

### 1.1 Node.js Runtime & Built-in Capabilities
- Command: `node -v && npm -v`
- Result:
  ```
  v24.11.1
  11.6.2
  ```
- Node 24 natively provides:
  - Built-in test runner module: `node:test` (`describe`, `it`, `test`, `before`, `after`, `beforeEach`, `afterEach`, `run`).
  - Built-in test reporters: `node:test/reporters` (`spec`, `tap`, `dot`).
  - Built-in assertion library: `node:assert/strict` (`assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`, `assert.rejects`).
  - Native global HTTP client: `fetch`, `Headers`, `Request`, `Response`, `AbortSignal.timeout()`.
  - Native ES module execution and top-level `await`.
- Verified via programmatic test:
  ```bash
  node -e "import('node:test').then(t => { console.log('run exists:', typeof t.run); return import('node:test/reporters'); }).then(r => console.log('spec reporter exists:', typeof r.spec))"
  # Output: run exists: function, spec reporter exists: function
  ```

### 1.2 Package & Dependency Landscape
- **Root Directory (`/Users/admin/Documents/Bookable/`)**:
  - Currently has NO root `package.json`.
  - Files present: `Books.csv` (73.3MB), `README.md`, `client/`, `server/`, `readme/`, `.git/`, `.agents/`.
  - Without a `package.json` with `"type": "module"` in root or `tests/`, Node treats `.js` files as CommonJS, resulting in `SyntaxError: Cannot use import statement outside a module` when using ESM `import`.
- **Server Directory (`server/package.json`)**:
  ```json
  {
    "name": "server",
    "version": "1.0.0",
    "main": "index.js",
    "type": "module",
    "dependencies": {
      "bcryptjs": "^3.0.3",
      "cors": "^2.8.6",
      "csv-parse": "^7.0.3",
      "dotenv": "^18.0.8",
      "express": "^5.3.0",
      "jsonwebtoken": "^9.0.3",
      "mongoose": "^9.11.2"
    }
  }
  ```
  - Note: `supertest` is **NOT** installed in `server/`, `client/`, or root.
  - Server scripts present: `"start": "node src/index.js"`, `"dev": "node --watch src/index.js"`, `"smoke": "node src/scripts/smoke.js"`.
- **Client Directory (`client/package.json`)**:
  - React 19 (`^19.3.1`), Vite (`^8.3.4`), `@vitejs/plugin-react` (`^6.1.2`).

### 1.3 Running Server, Database & In-Memory Index State
- Local `mongod` is active on port `27017` (PID 600, version `7.0.26`).
- Express server is already running on port `5050` (PID 1416).
- Direct query to `http://127.0.0.1:5050/api/health` returned:
  ```json
  {
    "ok": true,
    "ready": true,
    "stats": {
      "books": 271359,
      "vocabulary": 66444,
      "authors": 96985,
      "publishers": 16186,
      "buildMs": 10114
    }
  }
  ```
- All 271,359 books are already loaded in memory and indexed.
- Existing smoke test (`cd server && npm run smoke`) executes 36 checks using native `fetch` against `http://localhost:5050/api` in < 2 seconds, with all 36 checks passing cleanly.
- `server/src/recommender/engine.js:26-84` shows that `buildIndex()` scans MongoDB's `Book` collection and builds the TF-IDF vocabulary, inverted index, and author/publisher maps. This initialization takes ~10.1 seconds and consumes ~500MB of RAM.

### 1.4 Environment & Networking Constraints
- Inside the subagent sandboxed terminal session, outbound socket connections (`connect` syscall) to `127.0.0.1` or unix domain sockets trigger `connect EPERM` unless elevated permission (`BypassSandbox: true`) is granted.
- In standard unsandboxed terminal execution, developer shells, and CI environments, loopback TCP connections to `http://127.0.0.1:5050` succeed without restriction.

---

## 2. Logic Chain

From these direct observations, we derive the structural and architectural design for the E2E test suite:

### 2.1 Test Runner Design (`tests/run-all.js`) & Dependency Architecture
1. **Runner Framework Choice**:
   - *Observation*: Node version is `24.11.1`. `node:test` and `node:assert/strict` are native built-ins with comprehensive test runner, filtering, lifecycle hooks (`before`, `after`, `beforeEach`, `afterEach`), subtests, and reporters (`spec`, `tap`, `dot`).
   - *Logic*: Introducing third-party test frameworks (such as Jest, Mocha, or Vitest) would require installing tens of megabytes of `node_modules` into the project root, creating dependency conflicts with React 19 / Vite / Express 5, and introducing compilation overhead. `node:test` requires **zero external dependencies**, executes with native V8 speed, and has native ESM support.
   - *Decision*: Build the test runner using Node's built-in `node:test` and `node:assert/strict`.

2. **HTTP Client: Native `fetch` vs `supertest`**:
   - *Observation*: `supertest` is not installed anywhere in the project. `globalThis.fetch` is built into Node 24 and already validated by `server/src/scripts/smoke.js`. `supertest` relies on spinning up ephemeral HTTP listeners on random ports, which introduces socket binding overhead and fails under restricted socket sandboxing.
   - *Logic*: Native `fetch` tests the actual API contract across the wire exactly as a real frontend browser client (or Goodreads app) experiences it. It requires no extra packages and executes HTTP requests with microsecond latency against the running Express API.
   - *Decision*: Use native `fetch` (wrapped in a clean utility `tests/helpers.js`) for all HTTP operations across all test suites.

3. **ESM Enablement & Root Package Configuration**:
   - *Observation*: The root directory lacks a `package.json`. Files named `tests/*.js` will fail to parse `import` statements under Node unless configured as ESM.
   - *Logic*: Placing a root `package.json` with `"type": "module"` and `"scripts": { "test": "node tests/run-all.js" }` establishes standard npm convention (`npm test` runnable from workspace root), ensures all `.js` files in `tests/` are parsed as ESM, and does not alter the isolated `server/` or `client/` package namespaces.
   - *Decision*: Provide a clean root `package.json` declaring `"type": "module"` and `"scripts": { "test": "node tests/run-all.js" }`.

### 2.2 Test Execution Model, Server Lifecycle & Isolation
1. **Targeting Running Server vs Ephemeral Server**:
   - *Observation*: `buildIndex()` in `server/src/recommender/engine.js` takes ~10.1 seconds to load and index 271,359 books into memory. If every test file spawned an ephemeral Express instance, running four test suites would take 40+ seconds and duplicate 2GB of memory allocations.
   - *Logic*: The primary server is designed to run continuously during local development (`cd server && npm start` or `npm dev`). Running tests against the active server at `API_URL` (defaulting to `http://127.0.0.1:5050/api`) allows the entire 120-test catalog to execute in 2–5 seconds rather than 40+ seconds.
   - *Decision*: Default target is `http://127.0.0.1:5050/api` (overridable via `process.env.API_URL`).
   - *Preflight Health Check*: The test runner (`tests/run-all.js`) and test helper (`tests/helpers.js`) must execute a preflight `GET /api/health`:
     - If `/api/health` returns `{ ok: true, ready: true }`, start the tests immediately.
     - If `/api/health` returns `{ ready: false }`, poll with a 500ms delay for up to 15 seconds until indexing finishes.
     - If the connection fails (ECONNREFUSED), print a clear diagnostic instructing the developer to start the server or launch it automatically via child_process if configured.

2. **Data Isolation & Teardown Between Test Runs**:
   - *Observation*: Bookable stores users and reviews in MongoDB. The `Book` collection is static and read-only. Tests will register users, modify shelves, post reviews, and alter settings.
   - *Logic*: To prevent tests from interfering with each other, corrupting user data, or failing on re-run:
     1. **Unique Test User Namespacing**: Every test suite or test case generates unique usernames with a prefix and high-entropy timestamp/random string:
        ```javascript
        export const uniqueUsername = (prefix = 'test') =>
          `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 30);
        ```
     2. **Autonomous Account Lifecycles**: Each test creates its own authenticated user account, receives a distinct JWT token, performs its operations, and never relies on state from another test.
     3. **API-Driven Teardown**: After test execution, suites can invoke `POST /api/me/reset-books` and `DELETE /api/me/reviews` using `tests/helpers.js`'s `cleanupUser(token)`.
     4. **Immutability of Book Catalog**: Tests never mutate `Book` documents. The 271,359 catalog books remain unaltered.

### 2.3 Directory and File Structure of `tests/`
The test infrastructure must be structured as follows:

```
/Users/admin/Documents/Bookable/
├── package.json                         [Root package.json with "type": "module" & "test" script]
├── tests/
│   ├── run-all.js                       [CLI master test runner coordinating all suites]
│   ├── helpers.js                       [Shared HTTP helper, auth generator, assertions, seeds]
│   ├── auth-isolation.test.js           [Features 1 & 2: Auth, JWT, multi-user isolation]
│   ├── recommendation-heuristics.test.js[Features 6, 7 & 10: 3-seed recommendations, title exclusion, weights]
│   ├── sentiment-analysis.test.js       [Features 8 & 9: Local sentiment analysis & adaptation]
│   └── e2e-scenarios.test.js            [Features 3, 4, 5, Tier 3 cross-feature & Tier 4 user journeys]
├── TEST_INFRA.md                        [Infrastructure guide, runner options, coverage thresholds]
└── TEST_READY.md                        [Test track sign-off signal & tier matrix]
```

#### Detailed File Specifications:

1. **`tests/helpers.js`**:
   - `API_BASE`: `process.env.API_URL || 'http://127.0.0.1:5050/api'`
   - `request(method, path, body, token)`: Wrapper around `fetch` with JSON header injection, `Authorization: Bearer ${token}`, automatic JSON response parsing, and standard timeout (`AbortSignal.timeout(5000)`). Returns `{ status, ok, headers, body }`.
   - `createTestUser(prefix)`: Registers a new user, returns `{ username, password, token, user }`.
   - `checkServerReady()`: Verifies `GET /api/health` is ready before running suites.
   - `cleanupUser(token)`: Calls `POST /api/me/reset-books` and `DELETE /api/me/reviews`.
   - `KNOWN_SEEDS`: Dictionary of verified ISBNs from Books.csv for deterministic testing:
     - Fantasy: `'0439136350'` (Harry Potter - Prisoner of Azkaban), `'0345339681'` (The Hobbit)
     - Sci-Fi: `'0441172660'` (Dune), `'0671461494'` (Star Trek)
     - Classics/Literature: `'0451524934'` (1984), `'0316769487'` (Catcher in the Rye)
     - History/Non-Fiction: `'0060973129'` (Decision in Normandy)

2. **`tests/run-all.js`**:
   - Coordinates the 4 test suite files:
     ```javascript
     const SUITES = [
       'tests/auth-isolation.test.js',
       'tests/recommendation-heuristics.test.js',
       'tests/sentiment-analysis.test.js',
       'tests/e2e-scenarios.test.js',
     ];
     ```
   - Pre-flight server readiness check.
   - Executes suites via `node:test`'s programmatic `run({ files: SUITES })` piped through `new spec()`.
   - Collects test counts by tier:
     - Tier 1 (Feature Coverage): $\ge 50$ tests
     - Tier 2 (Boundary & Corner Cases): $\ge 50$ tests
     - Tier 3 (Cross-Feature Combinations): $\ge 10$ tests
     - Tier 4 (Real-World Application Scenarios): $\ge 5$ tests
   - Displays a summary table upon completion and exits with code 0 on all pass, code 1 on any failure.
   - Supports CLI flags: `--suite=<name>` to run a single test suite, `--verbose` for detailed request payloads.

3. **`tests/auth-isolation.test.js`**:
   - Focus: Features 1 & 2.
   - Tier 1: Signup, Login, Password hashing verification, Token auth, Protected `/me`.
   - Tier 2: Boundary cases: Short passwords (<6 chars), invalid username characters, duplicate usernames (409), wrong passwords (401), missing token (401), forged/invalid JWT token (401).
   - Tier 3: Multi-user isolation: User A cannot read or mutate User B's shelf; User A's token cannot delete User B's reviews (`DELETE /api/reviews/:id`); User A's book reset leaves User B's library unaffected.
   - Tier 4: User lifecycle: Signup -> Onboarding -> Token persistence -> Re-login -> Profile consistency.

4. **`tests/recommendation-heuristics.test.js`**:
   - Focus: Features 6, 7 & 10.
   - Endpoint: `POST /api/recommend/three`.
   - Tier 1: 3-seed recommendations return candidates with metadata scoring (author, genre, tag, rating); candidate limit honored; seed books excluded; duplicate editions collapsed; diagnostics object present.
   - Tier 2: Boundary cases:
     - Seeds < 3 returns 400.
     - Seeds > 3 returns 400 or truncates gracefully.
     - Duplicate seed ISBNs in request (`['0439136350', '0439136350', '0345339681']`) handled/deduped.
     - Non-existent ISBNs yield 400/404.
     - **Strict Title Exclusion**: Setting weights with zero or varying title weight verifies that candidates are selected purely based on author, genre, tag, and rating; no title TF-IDF cosine similarity bonus is awarded ($w_{\text{title}} = 0$).
     - Extreme custom weights: all zeroes, negative weights normalized, custom sliders verified.
   - Tier 3: Comparative ranking: Author-dominant weights vs Genre-dominant weights produce distinct top candidates.
   - Tier 4: Multi-genre seed selection (Fantasy + Sci-Fi + Classic) yields coherent, explainable cross-genre suggestions.

5. **`tests/sentiment-analysis.test.js`**:
   - Focus: Features 8 & 9.
   - Endpoints: `POST /api/books/:isbn/reviews`, `POST /api/recommend/sentiment-adapted`.
   - Tier 1: Lexicon polarity scoring:
     - Glowing review text ("masterpiece", "brilliant", "loved it") -> `label: 'positive'`, `score > 0.3`, positive keywords extracted.
     - Scathing review text ("terrible", "boring", "awful", "waste of time") -> `label: 'negative'`, `score < -0.3`, negative keywords extracted.
     - Neutral review text -> `label: 'neutral'`.
     - Sentiment-adapted recommendations return adapted book lists.
   - Tier 2: Boundary cases:
     - Empty review string `""` -> fallback to star rating or neutral.
     - Maximum review text length (5000 characters).
     - Contradictory text vs rating (5 stars with negative text, 1 star with positive text).
     - Non-alphanumeric text, emoji, punctuation.
     - Unknown target ISBN -> 404.
   - Tier 3: Review persistence: Submitted review stores sentiment score and keywords, returned in `GET /api/books/:isbn/reviews`.
   - Tier 4: End-to-end feedback loop: User rates a book with positive sentiment -> subsequent recommendation requests reflect positive sentiment adaptation.

6. **`tests/e2e-scenarios.test.js`**:
   - Focus: Features 3, 4, 5, plus Tiers 3 & 4.
   - Endpoints: `PUT /api/me/shelf/:isbn`, `GET /api/me/shelves`, `POST/GET/DELETE /api/books/:isbn/reviews`, `POST /api/me/reset-books`, `DELETE /api/me/reviews`.
   - Tier 1: Exclusive 3-shelf transitions (`want_to_read` -> `currently_reading` -> `read`); setting `read` removes book from `want_to_read` and `currently_reading`; `GET /api/me/shelves` groups books correctly; review CRUD and community rating aggregation.
   - Tier 2: Boundary cases: Invalid shelf status -> 400; ratings outside 1–5 (0, 6) -> 400; deleting non-existent review -> 404; idempotent reset when shelves are empty; idempotent review deletion when user has no reviews.
   - Tier 3: Cross-feature combinations:
     - Reset books (`POST /api/me/reset-books`) empties shelves but preserves user reviews.
     - Delete reviews (`DELETE /api/me/reviews`) removes reviews but preserves shelves.
     - Review submission updates book average rating and rating breakdown.
   - Tier 4: Full user journeys:
     - Journey 1: New reader registration -> explore catalog -> shelf books -> reading status transition -> write 5-star review -> verify community aggregate.
     - Journey 2: Multi-user book club: Reader A and Reader B rate same book differently -> check average rating -> verify data isolation.
     - Journey 3: Heavy user bookshelf reorganization, diagnostics inspection, and settings reset.

---

## 3. Caveats

1. **Subagent Sandbox Socket Restriction**:
   - Direct TCP socket creation from within the restricted subagent sandbox fails with `connect EPERM`. Tests running inside this sandboxed tool execution session require `BypassSandbox: true`. Outside the sandbox (in standard user terminals, CI runners, or background processes), TCP loopback connects without restriction.
2. **Pre-requisite Server & Database**:
   - The test suite requires `mongod` to be running on `127.0.0.1:27017` and the Express server on `127.0.0.1:5050`. If the server is offline, running `cd server && npm start` is required before launching the test suite, unless `tests/run-all.js` is enhanced with child process auto-spawning.
3. **Pending Milestone Implementations**:
   - Endpoints such as `POST /api/recommend/three`, `POST /api/recommend/sentiment-adapted`, `PUT /api/me/shelf/:isbn`, `POST /api/me/reset-books`, and `DELETE /api/me/reviews` are defined in the interface contract (`PROJECT.md`) and are scheduled for implementation in Milestones M1 and M2. Tests written in the E2E track are requirement-driven and will fail until M1 and M2 implement these endpoints (as designed per TDD).

---

## 4. Conclusion

1. **Test Runner Framework**:
   Use Node's built-in `node:test` and `node:assert/strict` with native global `fetch`. Zero additional npm dependencies are required. This ensures zero-friction installation, maximum speed, and clean alignment with Node 24 ESM.
2. **Execution Strategy**:
   Run tests against the running Express API at `http://127.0.0.1:5050/api` (configurable via `process.env.API_URL`). Pre-flight verification in `tests/run-all.js` checks `GET /api/health` for `ready: true`, eliminating the 10-second re-indexing overhead per suite.
3. **Isolation & Teardown**:
   Enforce multi-user isolation by generating unique, timestamped test usernames (`test_user_<timestamp>_<rand>`) for every test case. Use API endpoints (`POST /api/me/reset-books` and `DELETE /api/me/reviews`) for post-test cleanup without ever modifying the static 271k book dataset.
4. **File Architecture**:
   - Provide a root `package.json` with `"type": "module"` and `"scripts": { "test": "node tests/run-all.js" }`.
   - Organize test suites into `tests/helpers.js`, `tests/run-all.js`, `tests/auth-isolation.test.js`, `tests/recommendation-heuristics.test.js`, `tests/sentiment-analysis.test.js`, and `tests/e2e-scenarios.test.js`.
   - Publish `TEST_INFRA.md` and `TEST_READY.md` upon completion of the test suite.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Node.js Version & Built-in Modules**:
   ```bash
   node -v
   # Must be >= 20, observed v24.11.1
   node -e "import { describe, it } from 'node:test'; import assert from 'node:assert/strict'; console.log('node:test & node:assert ready');"
   ```

2. **Verify Server Health & In-Memory Index**:
   ```bash
   curl -s http://127.0.0.1:5050/api/health
   # Expected output: {"ok":true,"ready":true,"stats":{"books":271359,...}}
   ```

3. **Verify Existing Smoke Test Pass**:
   ```bash
   cd server && npm run smoke
   # Expected output: All checks passed (36/36)
   ```

4. **Verify Test Runner Execution (once implemented)**:
   ```bash
   # From project root:
   node tests/run-all.js
   # Or via npm script:
   npm test
   # Or run individual test suite:
   node --test tests/auth-isolation.test.js
   ```

5. **Invalidation Conditions**:
   - If Node.js is downgraded below v18 (lacking `node:test` or native `fetch`).
   - If the Express server port changes without updating `API_URL` or `.env`.
   - If `Books.csv` or MongoDB database is wiped or modified during test execution.
