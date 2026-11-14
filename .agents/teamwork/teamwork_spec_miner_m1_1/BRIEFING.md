# BRIEFING — 2026-11-13T18:48:45Z

## Mission
Extract and document the complete, rigorous API specifications and data contracts for Milestone 1 (Backend Data Models, Auth, Shelves & Settings) of Bookable.

## 🔒 My Identity
- Archetype: teamwork_spec_miner
- Roles: Specification Miner
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1
- Original parent: ca196c2a-23a3-488e-b4dc-e90d461cbeef
- Milestone: Milestone 1 (Backend Data Models, Auth, Shelves & Settings)

## 🔒 Key Constraints
- Do not implement anything — read-only probe and contract specification.
- Prioritize authoritative sources (ORIGINAL_REQUEST.md, PROJECT.md, SCOPE.md, survey handoff, existing server code).
- Enumerate full interfaces, inputs, outputs, error conditions, edge cases, status codes, validations.
- Keep .agents/teamwork/ metadata-only.

## Current Parent
- Conversation ID: ca196c2a-23a3-488e-b4dc-e90d461cbeef
- Updated: not yet

## Task Summary
- **What to build**: Complete specifications for User/Review schemas and 10 endpoint contracts for M1.
- **Success criteria**: Unambiguous API contracts with verified schema definitions, request/response formats, state transition logic, error codes, and edge case coverage.
- **Interface contracts**: PROJECT.md § 1 & SCOPE.md.
- **Code layout**: `server/src/models/`, `server/src/routes/`.

## Key Decisions Made
- `User` model extended with `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }`. `toPublic()` extended to include both fields while preserving existing fields for smoke test compatibility.
- `Review` model defined with compound unique index `{ userId: 1, isbn: 1 }`, sorting index `{ isbn: 1, createdAt: -1 }`, 1-5 rating validation, 5000 character limit on text, and structured sentiment subdocument.
- Reading shelf state machine enforces mutual exclusivity across `wantToRead`, `currentlyReading`, and `read`. `favorites` is preserved independently.
- `POST /api/books/:isbn/reviews` performs upsert on `{ userId, isbn }`, auto-transitions the book to the `read` shelf, and includes default/fallback sentiment.
- Ownership checks on `DELETE /api/reviews/:id` return `403 Forbidden` if `review.userId` does not match `req.userId`.
- Settings endpoints (`POST /api/me/reset-books` and `DELETE /api/me/reviews`) maintain strict isolation between shelf data and review documents.
- Legacy `POST /api/me/want/:isbn` and `DELETE /api/me/want/:isbn` preserved for 100% backward compatibility with `smoke.js`.

## Artifact Index
- /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/DISPATCH.md — Dispatch assignment
- /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/progress.md — Liveness heartbeat
- /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/BRIEFING.md — Persistent context
- /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/handoff.md — Final handoff report
