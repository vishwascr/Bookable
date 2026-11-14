# Task Assignment: Challenger 1 (Heuristics & Title Exclusion Empirical Challenger)

## Identity
- Archetype: teamwork_challenger
- Role: Recommendation Heuristics Challenger
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_challenger_m2_1
- Parent Conversation ID: 5b5e5d28-614b-498e-b981-66f748495970

## Task Description
Empirically challenge and stress-test the Milestone 2 3-Book Recommendation Engine implementation in `server/src/recommender/algorithms.js`, `server/src/recommender/engine.js`, and `server/src/recommender/metadata.js`.

Write and execute an adversarial empirical challenge test script (e.g. `server/src/scripts/challenge-recommender.js` or in your state folder):
1. **Title Exclusion Invariance**:
   - Generate synthetic pairs of candidate books with identical authors, genres, tags, and ratings, but wildly different titles (e.g. one titled "Harry Potter" vs one titled "Advanced Organic Chemistry").
   - Compute `computeHeuristicFeatures` and `scoreCandidate` across diverse weight combinations.
   - Assert with strict equality that the score delta is exactly 0.00000 across all pairs.
   - Test passing explicit `w_title` or `weights.title`: verify that the recommendation engine completely ignores it and $w_{\text{title}} = 0$.
2. **Diversity Penalty Verification**:
   - Run 3-seed recommendations where 1 seed has 20+ books in the catalog.
   - Measure the distribution of recommended books across seeds; assert that diversity penalty prevents total dominance.
3. **Seed Exclusion & Self-Recommendation Prevention**:
   - Verify that none of the 3 seed books or their work-key duplicates appear in the recommended output.
4. **Boundary & Stress**:
   - Test with identical 3 seeds, test with orthogonal seeds (different genres and authors).
   - Test query latency under 100 consecutive queries (benchmark ms per query).

Report your empirical findings, test code, run results, and final verdict (**APPROVE** or **REQUEST_CHANGES**) in `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_challenger_m2_1/handoff.md`. Notify with `send_message`.

## Mandatory Reading:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2/handoff.md`


## 2026-11-13T19:06:16Z
[Message] timestamp=2026-11-13T19:06:16Z sender=5b5e5d28-614b-498e-b981-66f748495970 priority=MESSAGE_PRIORITY_HIGH
You are Challenger 1 for Milestone 2 in Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_challenger_m2_1

MANDATORY READING:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m2/handoff.md
5. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_challenger_m2_1/DISPATCH.md

Empirically challenge and stress-test the 3-book recommendation engine:
Write and execute an adversarial empirical challenge test script (e.g. `server/src/scripts/challenge-recommender.js` or in your state folder):
1. Invariance check: prove that title similarity has 0.00000 effect on scoring. Test candidate pairs with identical metadata and differing titles. Test passing w_title.
2. Diversity penalty verification: test single-seed author domination resistance.
3. Seed exclusion: ensure seeds and seed editions never appear in recommendations.
4. Latency under stress benchmark.

Write your report with verdict (APPROVE or REQUEST_CHANGES) to `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_challenger_m2_1/handoff.md` and notify with send_message.
