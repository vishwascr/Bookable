# Task Assignment: Explorer 1 (Recommendation Heuristics & Engine)

## Identity
- Archetype: teamwork_explorer
- Role: Recommendation Engine Explorer
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
Investigate `server/src/recommender/algorithms.js`, `server/src/recommender/engine.js`, `server/src/recommender/metadata.js`, and `server/src/models/` in `/Users/admin/Documents/Bookable`.
Map existing recommendation logic, candidate generation, and data structures.
Design the implementation strategy for the 3-seed recommendation heuristic engine:
1. Strict exclusion of title similarity weighting ($w_{\text{title}} = 0$).
2. Scoring based on author, genre, tag, and rating heuristics.
3. Metadata inference and tagging for books (since Books.csv lacks explicit genre/tag fields).
4. Candidate generation via author, genre, and tags instead of title token inverted index alone.
5. Seed diversity re-ranking to avoid single-seed dominance.

DO NOT write or modify source code. Produce a detailed investigation report and implementation recommendation in your state folder at `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1/handoff.md`.

## Mandatory Reading
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`


## 2026-11-13T18:47:10Z
You are Explorer 1 for Milestone 2 in Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1

MANDATORY READING:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1/DISPATCH.md

Your mission:
Investigate `server/src/recommender/algorithms.js`, `server/src/recommender/engine.js`, `server/src/recommender/metadata.js`, and `server/src/models/`.
Map existing recommendation logic, candidate generation, and data structures.
Design the implementation strategy for the 3-seed recommendation heuristic engine:
1. Strict exclusion of title similarity weighting (w_title = 0).
2. Scoring based on author, genre, tag, and rating heuristics.
3. Metadata inference and tagging for books (since Books.csv lacks explicit genre/tag fields).
4. Candidate generation via author, genre, and tags instead of title token inverted index alone.
5. Seed diversity re-ranking to avoid single-seed dominance.

DO NOT write or modify source code. Produce a detailed investigation report and implementation recommendation in your state folder at `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1/handoff.md`.
When finished, notify me with send_message including your handoff path.
