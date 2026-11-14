## 2026-11-13T18:54:18Z
You are the Milestone 2 Implementation Worker for Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY READING:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_1/handoff.md
5. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_2/handoff.md
6. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_3/handoff.md
7. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2/DISPATCH.md

Your exclusive write boundaries:
- `server/src/recommender/metadata.js` (NEW)
- `server/src/recommender/sentiment.js` (NEW)
- `server/src/recommender/algorithms.js`
- `server/src/recommender/engine.js`
- `server/src/routes/api.js`
(and any verification test script you create in `server/src/scripts/` or `tests/`).

Tasks:
1. Implement `server/src/recommender/metadata.js`:
   - 16 literary genres classification and semantic tag extraction based on book metadata.
   - Bayesian rating calculation.
   - Build inverted lookup maps `state.byGenre` and `state.byTag`.
2. Implement `server/src/recommender/sentiment.js`:
   - Pure on-device rule-based sentiment analyzer with literary domain lexicon, intensifiers, diminishers, 3-token lookahead negation, contrastive conjunction shifting.
   - Polarity normalization, star calibration, aspect extraction (pacing, world-building, characters, tone, prose, plot, emotional), and dual-field compatibility (`score`/`polarity`, `label`/`classification`, `aspects`/`aspectTags`, `keywords`).
   - Dynamic recommendation adaptation: positive ("reinforce & expand"), negative ("diverge & contrast"), neutral.
3. Implement `server/src/recommender/algorithms.js`:
   - Implement `computeHeuristicFeatures(cand, seeds, engine)`: author, genre, tag, and rating heuristic scores.
   - STRICT ENFORCEMENT: Title similarity weight MUST be EXCLUDED (w_title = 0). No title TF-IDF cosine comparison in 3-seed heuristics.
   - Implement `scoreCandidate(features, weights)` with customizable weights.
   - Implement `recommendThree(seeds, weights, limit)` with candidate generation and greedy diversity penalty (delta = 0.85) based on bestSeed count.
4. Update `server/src/recommender/engine.js`:
   - Integrate `metadata.js` inside `buildIndex()` so indexed books have inferred genres, tags, and ratings.
   - Maintain `byGenre` and `byTag` index maps.
   - Candidate generation for 3 seeds combining author, genre, and rare tags, deduplicating by work key (dKey) and excluding seeds and seed work-key duplicates.
5. Update `server/src/routes/api.js`:
   - Mount `POST /api/recommend/three`: accepts seeds, weights (w_title = 0 enforced), limit; returns candidates and diagnostics.
   - Mount `POST /api/recommend/sentiment-adapted`: accepts reviewText, targetIsbn, rating; returns sentiment and adapted recommendations.
   - Ensure `GET /api/dev/diagnostics` exposes telemetry confirming titleExcluded: true.
6. Verify your implementation:
   - Run syntax checks (`node --check ...`).
   - Run test scripts verifying title exclusion, 3-seed recommendations, sentiment analysis accuracy, and endpoint responses.
   - Write your complete handoff report to `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2/handoff.md`.
   - Send a message when complete.
