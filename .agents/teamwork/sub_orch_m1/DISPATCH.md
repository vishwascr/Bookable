# Task Assignment: Milestone 1 Sub-Orchestrator

## 🔒 My Identity
- Archetype: orchestrator (self)
- Roles: orchestrator, successor
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m1
- Parent Conversation ID: 54805123-e26b-42d5-8dac-b0d9c2d12bdd (Top-level Project Orchestrator)

## Milestone Scope: M1 — Backend Data Models, Auth, Shelves & Settings
Your scope is to implement the backend data foundations, multi-user isolation, review management, shelf status state transitions, and settings data reset/deletion:
1. **Review Schema (`server/src/models/Review.js`)**:
   - Fields: `userId`, `username`, `displayName`, `isbn`, `rating` (1–5), `text`, `sentiment` (`score`, `label`, `keywords`), timestamps.
   - Indices: `{ userId: 1, isbn: 1 }` (unique), `{ isbn: 1, createdAt: -1 }`.
2. **User Schema Extension (`server/src/models/User.js`)**:
   - Add `currentlyReading: { type: [String], default: [] }` and `read: { type: [String], default: [] }` while preserving `favorites` and `wantToRead`.
3. **Reading Status & Shelves Routes (`server/src/routes/users.js` or dedicated)**:
   - `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`. Moving to a status mutually excludes from other reading statuses.
   - `GET /api/me/shelves`: Returns populated books partitioned by shelf (`wantToRead`, `currentlyReading`, `read`, `favorites`).
4. **Reviews Routes (`server/src/routes/reviews.js`)**:
   - `GET /api/books/:isbn/reviews`: Public. Average rating, rating counts (1-5), community review list.
   - `POST /api/books/:isbn/reviews`: Authenticated (`requireAuth`). Accepts rating & text. Saves review with initial sentiment (if sentiment module available or placeholder structure).
   - `DELETE /api/reviews/:id`: Authenticated. Enforces ownership: only author can delete their review.
   - `GET /api/me/reviews`: Authenticated. List of reviews written by current user.
5. **Settings Endpoints (`server/src/routes/users.js`)**:
   - `POST /api/me/reset-books`: Authenticated. Clears current user's shelves (`wantToRead`, `currentlyReading`, `read`, `favorites`) without deleting reviews.
   - `DELETE /api/me/reviews`: Authenticated. Deletes all reviews written by current user without resetting shelves.
6. **Multi-User Data Isolation**:
   - Strict `req.userId` filtering on all library operations. Users cannot access or alter other users' private shelf data.
7. **Write Boundaries**:
   - Exclusively owns: `server/src/models/Review.js`, `server/src/models/User.js`, `server/src/routes/reviews.js`, `server/src/routes/users.js`, `server/src/index.js` (mounting review routes).

Follow the Project Pattern procedure: Assess -> Decompose or Iterate (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
Exit when the gate passes.

MANDATORY INPUTS:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- Survey report: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_2/handoff.md`


## 2026-11-13T18:44:50Z
You are the Milestone 1 Sub-Orchestrator for Bookable.
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m1
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_2/handoff.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m1/DISPATCH.md

Your scope:
M1: Backend Data Models, Auth, Shelves & Settings.
Implement Review model, User schema extension (currentlyReading, read), review endpoints, shelf endpoints, settings reset-books and delete-reviews endpoints with strict isolation enforcement.
File ownership: server/src/models/Review.js, server/src/models/User.js, server/src/routes/reviews.js, server/src/routes/users.js, server/src/index.js.
Follow the orchestrator procedure (Assess -> Decompose/Iterate with Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
When M1 gate passes, report back via send_message with your handoff.md path.


## 2026-11-13T19:57:42Z
commit after every substep is completed. Please ensure changes are committed to git (excluding `.agents/` and temporary test artifacts) after every completed substep/milestone. If `git commit` hits a sandbox permission error inside your workers, report each completed substep/milestone immediately with the files to commit so we can escalate to the user/parent agent.
