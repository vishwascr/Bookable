# Task Assignment: Explorer 3 (API Endpoints, Diagnostics & Integration)

## Identity
- Archetype: teamwork_explorer
- Role: API & Integration Explorer
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
Investigate `server/src/routes/api.js`, `server/src/index.js`, and existing route patterns in `/Users/admin/Documents/Bookable`.
Design the API route specifications and integration plan for M2:
1. `POST /api/recommend/three`:
   - Payload: `{ seeds: [isbn1, isbn2, isbn3], weights: { genre, author, tag, rating }, limit }`
   - Response: `{ candidates: [...], diagnostics: { seedCount, weightsUsed, candidatesEvaluated, queryTimeMs, titleExcluded: true } }`
   - Validation & error handling (missing seeds, invalid weights, non-existent seeds).
2. `POST /api/recommend/sentiment-adapted`:
   - Payload: `{ reviewText, targetIsbn, rating, limit }`
   - Response: `{ sentiment: { score, label, keywords, aspects }, adaptedRecommendations: [...] }`
3. Dev Mode diagnostics contracts & telemetry integration.
4. Test strategy to verify endpoints, title exclusion, and sentiment calculation.

DO NOT write or modify source code. Produce a detailed investigation report and implementation recommendation in your state folder at `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3/handoff.md`.

## Mandatory Reading
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`


## 2026-11-13T18:47:23Z
You are Explorer 3 for Milestone 2 in Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3

MANDATORY READING:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3/DISPATCH.md

Your mission:
Investigate `server/src/routes/api.js`, `server/src/index.js`, and existing route patterns in `/Users/admin/Documents/Bookable`.
Design the API route specifications and integration plan for M2:
1. `POST /api/recommend/three`:
   - Payload: `{ seeds: [isbn1, isbn2, isbn3], weights: { genre, author, tag, rating }, limit }`
   - Response: `{ candidates: [...], diagnostics: { seedCount, weightsUsed, candidatesEvaluated, queryTimeMs, titleExcluded: true } }`
   - Validation & error handling (missing seeds, invalid weights, non-existent seeds).
2. `POST /api/recommend/sentiment-adapted`:
   - Payload: `{ reviewText, targetIsbn, rating, limit }`
   - Response: `{ sentiment: { score, label, keywords, aspects }, adaptedRecommendations: [...] }`
3. Dev Mode diagnostics contracts & telemetry integration.
4. Test strategy to verify endpoints, title exclusion, and sentiment calculation.

DO NOT write or modify source code. Produce a detailed investigation report and implementation recommendation in your state folder at `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3/handoff.md`.
When finished, notify me with send_message including your handoff path.
