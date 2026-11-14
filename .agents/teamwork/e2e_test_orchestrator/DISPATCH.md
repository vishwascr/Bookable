# Task Assignment: E2E Testing Track Orchestrator

## 🔒 My Identity
- Archetype: orchestrator (self)
- Roles: orchestrator, successor
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/e2e_test_orchestrator
- Parent Conversation ID: 54805123-e26b-42d5-8dac-b0d9c2d12bdd (Top-level Project Orchestrator)

## Mission & Track Scope
You are the **E2E Testing Orchestrator** running the independent, requirement-driven E2E Testing Track in parallel with implementation.
Your scope:
1. Design E2E test infrastructure, standalone test runner, and test framework (e.g. Node.js built-in test runner `node:test` or standalone test scripts in `tests/`).
2. Design and implement opaque-box test cases covering all 4 tiers derived strictly from user requirements in `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md` and `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`:
   - **Tier 1 (Feature Coverage, >=5 per feature)**: Auth, data isolation, 3-seed recommendations, title similarity exclusion, local review sentiment analysis, sentiment-adapted recommendations, reading statuses, reviews, settings reset/delete.
   - **Tier 2 (Boundary & Corner Cases, >=5 per feature)**: Empty reviews, max character reviews, boundary ratings (1 & 5), missing seeds, duplicate seeds, non-existent books, invalid credentials, unauthorized data mutation attempts.
   - **Tier 3 (Cross-Feature Combinations, pairwise coverage)**: Auth + Shelving, Shelving + Reviewing + Sentiment adaptation, Review deletion + Shelf persistence, Reset books + Review persistence.
   - **Tier 4 (Real-World Application Scenarios, >=5)**: Full user journey (register -> onboarding seeds -> browse & want-to-read -> update reading status to read -> rate & review -> verify sentiment adaptation -> customize algorithm -> check Dev mode data segregation -> reset books in settings).
3. Create `TEST_INFRA.md` at project root documenting test architecture, methodology, and feature inventory coverage.
4. When all test suites and runner are ready and verified, publish `TEST_READY.md` at project root.
5. You own the `tests/` directory, `TEST_INFRA.md`, and `TEST_READY.md`. Do NOT modify server or client application code.
6. Dispatch `teamwork_test_writer` or workers/reviewers as needed to implement the test files.

MANDATORY INPUTS:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`

## 2026-11-13T19:57:54Z
From Parent (54805123-e26b-42d5-8dac-b0d9c2d12bdd):
"commit after every substep is completed. Please ensure changes are committed to git (excluding `.agents/` and temporary test artifacts) after every completed substep/milestone. If `git commit` hits a sandbox permission error inside your workers, report each completed substep/milestone immediately with the files to commit so we can escalate to the user/parent agent."
