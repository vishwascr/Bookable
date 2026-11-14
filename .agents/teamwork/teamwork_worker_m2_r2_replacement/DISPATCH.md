# Task Assignment: Worker Round 2 Replacement (Milestone 2 Remediation & Final Verification)

## Identity
- Archetype: teamwork_worker
- Role: Milestone 2 Remediation & Verification Worker
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2_r2_replacement
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
The previous remediation worker completed parts of `metadata.js`, `engine.js`, and `sentiment.js` before encountering a quota pause.
Your task is to verify and finish all remaining Milestone 2 remediation items:

1. **`server/src/recommender/sentiment.js`**:
   - Ensure `export { analyzeReviewSentiment, analyzeReviewSentiment as analyzeSentiment };` is present so `server/src/routes/reviews.js` uses the real sentiment engine.
   - Verify `merit: 2.5` is in `LITERARY_LEXICON`.
   - Verify 3-token lookback window correctly handles double negations ("not without merit", "not without genius" -> positive score).
   - Verify aspect regexes use word boundary anchoring `(?<![a-z0-9-])${term}(?![a-z0-9-])` and negative lookahead for `slow(?![\s-]+burn)`.
2. **`server/src/recommender/metadata.js` & `server/src/recommender/algorithms.js`**:
   - Verify title tokens are NEVER extracted or used in `inferTags(book)`.
   - Verify null/undefined safety in `inferGenres`, `inferTags`, `computeBaselineRating`, `scoreCandidate`, and `computeHeuristicFeatures`.
3. **`server/src/recommender/engine.js`**:
   - Verify `sampleStride` is used for candidate generation.
4. **`server/src/routes/reviews.js`**:
   - Verify it imports and calls `analyzeSentiment` from `sentiment.js`.
5. **Update Verification Test Scripts**:
   - Review proposed files from Explorer 3: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/proposed_test-m2.js` and `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/proposed_challenge-sentiment.js`.
   - Ensure `server/src/scripts/test-m2.js` Test 2 passes candidates dynamically through `inferTags` (no hardcoded tags) and asserts that title similarity has 0 effect.
   - Ensure `server/src/scripts/challenge-sentiment.js` runs all 21 tests with 100% pass (double negations, aspect separation, star calibration, throughput).
   - Ensure `server/src/scripts/test-api-m2.js` verifies `reviews.js` integration.
6. **Execute Verification**:
   - Run `node --check` across all modified files.
   - Run `node server/src/scripts/test-m2.js`.
   - Run `node server/src/scripts/challenge-recommender.js`.
   - Run `node server/src/scripts/challenge-sentiment.js`.
   - Run `node server/src/scripts/test-api-m2.js`.
   All must pass with 0 errors.

Write your handoff report to `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2_r2_replacement/handoff.md` and notify with `send_message`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Reading:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/GATE_STATUS.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_2/handoff.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/handoff.md`


## 2026-11-13T19:58:02Z
Context: Git Commit Requirement from User
Content: User instruction: "commit after every substep is completed. Please ensure changes are committed to git (excluding `.agents/` and temporary test artifacts) after every completed substep/milestone. If `git commit` hits a sandbox permission error inside your workers, report each completed substep/milestone immediately with the files to commit so we can escalate to the user/parent agent."
Action: When finishing your remediation and verification steps, commit the code changes to git (or report if sandbox prevents git commits) and record the git commit hash in your handoff report.
