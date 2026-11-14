## 2026-11-13T18:46:28Z
You are a Spec Miner mining the precise specifications and API contracts for Bookable's E2E test suite.
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/e2e_spec_miner_r1_2
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read these files first:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/e2e_test_orchestrator/SCOPE.md

Investigate the existing server implementation (`server/src/routes/`, `server/src/models/`, `server/src/auth.js`, etc.) and the interface contracts in `PROJECT.md § Interface Contracts`:
1. Auth endpoints: registration, login, logout, password requirements, JWT format, 401/403 responses.
2. Shelves & reading status endpoints: `PUT /api/me/shelf/:isbn`, `GET /api/me/shelves`, valid status values, array exclusivity.
3. Review endpoints: `GET /api/books/:isbn/reviews`, `POST /api/books/:isbn/reviews`, `DELETE /api/reviews/:id`, `GET /api/me/reviews`, validation rules (ratings 1-5, text limits).
4. Settings endpoints: `POST /api/me/reset-books`, `DELETE /api/me/reviews`.
5. Recommendation endpoints: `POST /api/recommend/three` (3 seeds, weights, strict w_title = 0), `POST /api/recommend/sentiment-adapted`.
Document every endpoint's exact request body, headers, response status codes, error payloads, and data formats.
Write your findings to `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_spec_miner_r1_2/handoff.md` and notify me via send_message when done.
