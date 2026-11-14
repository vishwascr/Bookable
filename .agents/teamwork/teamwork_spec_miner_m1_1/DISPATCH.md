## 2026-11-13T18:46:37Z
You are Explorer 1 (teamwork_spec_miner) for Milestone 1 of Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1

MANDATORY INPUTS:
- Read /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
- Read /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
- Read /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m1/SCOPE.md
- Read /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_2/handoff.md

Your mission:
Extract and document the complete, rigorous API specifications and contracts for Milestone 1 (Backend Data Models, Auth, Shelves & Settings):
1. User Schema additions (`currentlyReading`, `read`) and existing fields (`favorites`, `wantToRead`).
2. Review Schema specifications (fields, types, defaults, indexes, validation constraints).
3. Exact endpoint contracts for:
   - `PUT /api/me/shelf/:isbn` (status transition state machine: want_to_read, currently_reading, read, none)
   - `GET /api/me/shelves` (response format, populated books partitioned by shelf)
   - `GET /api/me` (additions to existing user profile response)
   - `GET /api/books/:isbn/reviews` (public/optional auth, averageRating, totalReviews, rating counts/distribution, review list, userReview)
   - `POST /api/books/:isbn/reviews` (auth required, rating 1-5, text, upsert behavior, sentiment structure, automatic add to read shelf)
   - `DELETE /api/reviews/:id` (auth required, ownership check)
   - `GET /api/me/reviews` (auth required, list of user's reviews)
   - `POST /api/me/reset-books` (auth required, clears shelves and favorites, keeps reviews)
   - `DELETE /api/me/reviews` (auth required, deletes user reviews, keeps shelves)
   - Backwards-compatibility requirements for `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn`

Produce a comprehensive handoff report at `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, notify me via send_message.
