## 2026-11-13T18:53:47Z
You are the Worker for Milestone 1 of Bookable.
Working directory: /Users/admin/Documents/Bookable
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m1

MANDATORY INPUTS:
- Read /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- Read /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
- Read /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m1/SCOPE.md
- Read Explorer findings:
  - /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_spec_miner_m1_1/handoff.md
  - /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m1_2/handoff.md
  - /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m1_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

FILE WRITE OWNERSHIP:
You exclusively own and may edit/create:
- server/src/models/Review.js
- server/src/models/User.js
- server/src/routes/reviews.js
- server/src/routes/users.js
- server/src/index.js
- (You may also update server/src/auth.js if needed to add optionalAuth, or define optionalAuth inside reviews.js)
- You may create automated test verification scripts (e.g. server/src/scripts/test-m1.js or tests/m1-verify.js) to prove all endpoints work.
DO NOT touch client files or other server files outside your scope.

TASKS:
1. Extend User model (server/src/models/User.js):
   - Add currentlyReading: { type: [String], default: [] }
   - Add read: { type: [String], default: [] }
   - Update toPublic() method to include currentlyReading and read.
2. Create Review model (server/src/models/Review.js):
   - userId (ObjectId ref User, required, indexed)
   - username (String, required)
   - displayName (String, default '')
   - isbn (String, required, indexed)
   - rating (Number, required, min 1, max 5, integer validator)
   - text (String, default '', trim, maxlength 5000)
   - sentiment ({ score: { type: Number, default: 0 }, label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' }, keywords: { type: [String], default: [] } })
   - Timestamps: true, versionKey: false
   - Indexes: compound unique { userId: 1, isbn: 1 }, { isbn: 1, createdAt: -1 }, { userId: 1, createdAt: -1 }.
3. Implement Shelves & User routes in server/src/routes/users.js:
   - Book population helper with MongoDB fallback (getBookByIsbn / populateBooks).
   - PUT /api/me/shelf/:isbn: accepts { status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }. Enforce mutually exclusive reading shelf status transitions.
   - GET /api/me/shelves: returns populated { wantToRead, currentlyReading, read, favorites }.
   - GET /api/me: extends response with populated currentlyReading, read, and stats while preserving favorites and wantToRead for 100% smoke.js compatibility.
   - Preserve POST /api/me/want/:isbn and DELETE /api/me/want/:isbn.
   - POST /api/me/reset-books: resets wantToRead, currentlyReading, read, favorites to [] without touching reviews.
4. Implement Review routes in server/src/routes/reviews.js:
   - GET /api/books/:isbn/reviews: optional auth. Calculates averageRating (1 decimal), totalReviews, ratingDistribution & ratingCounts ({1:0, 2:0, 3:0, 4:0, 5:0}), reviews list sorted newest first, and userReview (or null).
   - POST /api/books/:isbn/reviews: requireAuth. Validates integer rating (1-5) and text <= 5000 chars. Upserts review on { userId, isbn }. Auto-adds book to read shelf and removes from wantToRead/currentlyReading. Returns created/updated review with stats. Includes sentiment fallback.
   - DELETE /api/reviews/:id: requireAuth. Validates ObjectId, checks ownership (403 if unauthorized), deletes review (204).
   - GET /api/me/reviews: requireAuth. Returns user's reviews populated with book details.
   - DELETE /api/me/reviews: requireAuth. Deletes all reviews written by req.userId without resetting shelves.
5. Register reviews router in server/src/index.js.
6. Verification:
   - Run `npm run smoke` in server/ to verify 0 regressions.
   - Run comprehensive automated test script verifying all new M1 endpoints, status transitions, isolation, IDOR protection, and settings resets.
   - Document all verification results, commands executed, and output in `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_worker_m1/handoff.md`.

When complete, notify me via send_message with your handoff.md path.
