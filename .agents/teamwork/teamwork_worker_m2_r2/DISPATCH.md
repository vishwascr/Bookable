# Task Assignment: Worker Round 2 (Milestone 2 Remediation)

## Identity
- Archetype: teamwork_worker
- Role: Milestone 2 Remediation Worker
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2_r2
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
Implement the fixes designed by Round 2 Explorers to resolve all issues identified in Iteration 1:

1. **`server/src/recommender/metadata.js`**:
   - Completely remove title token extraction from `inferTags(book)`.
   - Implement `GENRE_VIBE_MAP` generating thematic vibe tags based on inferred genres, publication era, publisher imprint, and catalog rules. Never tokenize or inspect titles in `inferTags`.
   - Add null/undefined safety across `inferGenres`, `inferTags`, `computeBaselineRating`, and `getCatalogRating`.
2. **`server/src/recommender/engine.js`**:
   - Replace insertion-order head-slicing (`.slice(0, 400)` and `.slice(0, 150)`) in `getThreeSeedCandidates` with uniform stride sampling helper `sampleStride(arr, limit)`.
   - Add null safety when building work maps.
3. **`server/src/recommender/sentiment.js`**:
   - Export `analyzeSentiment` alias: `export { analyzeReviewSentiment, analyzeReviewSentiment as analyzeSentiment }`.
   - Add `merit: 2.5` to `LITERARY_LEXICON`.
   - Refactor the 3-token lookback window in `analyzeReviewSentiment`: handle consecutive negators ("not without") with litotes multiplier (+0.65) so double negations score positive, while single negators ("not good") score negative.
   - Anchor aspect regexes with word boundaries and negative lookahead for `slow(?![\s-]+burn)`, preventing "slow-burn" from triggering "slow-dragging" and "explores"/"upsetting" from triggering "world-building".
4. **`server/src/recommender/algorithms.js`**:
   - Ensure null/undefined safety in `scoreCandidate` and `computeHeuristicFeatures`.
5. **Update Verification Test Scripts**:
   - Update `server/src/scripts/test-m2.js`: Test 2 must pass candidates dynamically through `inferTags` (no hardcoded tags) and assert that title similarity has 0 effect on candidate tags, features, and scores.
   - Update `server/src/scripts/challenge-sentiment.js`: ensure all 21 tests pass 100%, including double negation and aspect tests.
   - Update `server/src/scripts/test-api-m2.js`: verify `reviews.js` uses `analyzeSentiment`.
6. **Execute Verification**:
   - Run `node --check` on all modified files.
   - Run `node server/src/scripts/test-m2.js`.
   - Run `node server/src/scripts/challenge-recommender.js`.
   - Run `node server/src/scripts/challenge-sentiment.js`.
   - Run `node server/src/scripts/test-api-m2.js`.
   - All tests must pass with 0 errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Reading:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/GATE_STATUS.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_2/handoff.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/handoff.md`
