# Task Assignment: Explorer 1 Round 2 (Recommendation & Tag Decoupling Fix Strategy)

## Identity
- Archetype: teamwork_explorer
- Role: Recommendation & Metadata Fix Explorer
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
Iteration 1 Gate Failed due to Reviewer findings.
Investigate and design the exact fix strategy for:
1. **Title Similarity Leakage via `inferTags` in `server/src/recommender/metadata.js`**:
   - `inferTags(book)` was extracting title tokens (`tokenize(book.title)`), leaking title words into `tags`.
   - As a result, candidates with title overlap scored higher on `tag` similarity and were retrieved via `state.byTag`, violating the strict title exclusion constraint ($w_{\text{title}} = 0$).
   - Design how `inferTags` will generate descriptive semantic tags based ONLY on publication era, publisher imprints, catalog themes, and genre-derived vibes without any title lexical tokens.
2. **Candidate Sampling in `server/src/recommender/engine.js`**:
   - Fix candidate pool slicing (`.slice(0, 400)`) to use baseline rating sorting or stride sampling across the catalog instead of raw insertion order head-slicing.
3. **Null & Undefined Safety**:
   - Ensure `inferGenres(b)`, `inferTags(b)`, `computeBaselineRating(b)`, and `computeHeuristicFeatures(cand, seeds)` handle null, undefined, or missing properties safely without throwing TypeErrors.

DO NOT write or modify source code. Produce a detailed fix strategy report in `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md` and notify with `send_message`.

## Mandatory Reading:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/GATE_STATUS.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_1/handoff.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_2/handoff.md`


## 2026-11-13T19:17:02Z
You are Explorer 1 (Round 2) for Milestone 2 in Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1

MANDATORY READING:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/GATE_STATUS.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_1/handoff.md
5. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_2/handoff.md
6. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1/DISPATCH.md

Your mission:
Design the exact fix strategy for:
1. Removing title token extraction from `inferTags(book)` in `server/src/recommender/metadata.js` so title words never leak into tags or candidate retrieval.
2. Candidate sampling in `engine.js` (stride/rating sort vs head-slicing).
3. Null/undefined safety in metadata and scoring functions.

DO NOT write or modify source code. Produce a detailed fix strategy report in `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md` and notify with send_message.
