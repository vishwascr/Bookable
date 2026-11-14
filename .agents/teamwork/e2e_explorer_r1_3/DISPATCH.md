## 2026-11-13T18:46:31Z
You are an Explorer designing the 4-tier E2E test case catalog for Bookable.
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/e2e_explorer_r1_3
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read these files first:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/e2e_test_orchestrator/SCOPE.md

Design the concrete test case matrix covering all 4 tiers per the E2E testing principles:
- Tier 1: Feature Coverage (>=5 tests per feature for all 10 features in SCOPE.md, minimum 50 tests).
- Tier 2: Boundary & Corner Cases (>=5 tests per feature, minimum 50 tests).
- Tier 3: Cross-Feature Combinations (pairwise coverage of auth, shelving, reviews, sentiment, reset/delete, minimum 10 tests).
- Tier 4: Real-World Application Scenarios (>=5 realistic multi-step user workflows).
Enumerate the exact test names, inputs, and expected outcomes, mapping each test to its target file:
`auth-isolation.test.js`, `recommendation-heuristics.test.js`, `sentiment-analysis.test.js`, or `e2e-scenarios.test.js`.
Write your findings to `/Users/admin/Documents/Bookable/.agents/teamwork/e2e_explorer_r1_3/handoff.md` and notify me via send_message when done.
