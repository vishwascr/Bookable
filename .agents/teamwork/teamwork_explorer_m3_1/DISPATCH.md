# Explorer 1 Dispatch: Universal ReadingStatusButton & Catalog Integration

## Objective
Analyze the codebase and provide an exact technical specification and plan for implementing:
1. `client/src/components/ReadingStatusButton.jsx`
   - Universal Goodreads-like button with 1-click "+ Want to Read" and dropdown selector for reading statuses: "Want to read", "Currently reading", "Read", or "Remove from shelf".
   - Handling loading state, active status display ("✓ Want to Read", "📖 Currently Reading", "✓ Read"), and shelf removal.
   - Immediate optimistic UI update + API call to `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`.
   - Prop signature, state synchronisation, and behavior when user is not logged in (e.g. prompt to log in or redirect to login).
2. Integration into existing components:
   - `SearchResults.jsx`: every book card
   - `ResultsRun.jsx`: every recommendation item
   - `SeedPanel.jsx`: currently inspected seed book
   - `ForYou.jsx`: replacing the one-off toggle button
   - `Shelves.jsx`: shelf book card
3. `client/src/api.js`: additions for shelf status update (`api.updateShelfStatus(isbn, status)`).
4. `client/src/App.jsx`: global user library state management to ensure shelf counts and book status updates reflect immediately across all views.

## Input Files to Read
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m3/SCOPE.md`
- `client/src/components/SearchResults.jsx`
- `client/src/components/ResultsRun.jsx`
- `client/src/components/SeedPanel.jsx`
- `client/src/components/ForYou.jsx`
- `client/src/components/Shelves.jsx`
- `client/src/App.jsx`
- `client/src/api.js`
- `server/src/routes/users.js`

## Output Requirements
Write `handoff.md` in your state folder: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_1/handoff.md` with:
- Observation (code analysis)
- Component specifications & exact JSX/logic structures
- Integration diff plan for each affected component
- Caveats & risks
- Verification method


## 2026-11-13T20:17:00Z
You are teamwork_explorer_m3_1.
Your state folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_1
Working directory: /Users/admin/Documents/Bookable

MANDATORY INPUTS: Read these files first:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m3/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_1/DISPATCH.md

Your mission:
Analyze the codebase and provide an exact technical specification and plan for implementing:
1. `client/src/components/ReadingStatusButton.jsx`:
   - Universal Goodreads-like button with 1-click "+ Want to Read" and dropdown selector for reading statuses: "Want to read", "Currently reading", "Read", or "Remove from shelf".
   - Active status indicators ("✓ Want to Read", "📖 Currently Reading", "✓ Read") with dropdown chevron.
   - Integration with backend `PUT /api/me/shelf/:isbn` with `{ status: 'want_to_read' | 'currently_reading' | 'read' | 'none' }`.
   - Optimistic UI updates, error handling, unauthenticated guest handling (prompting to log in).
2. Catalog integration:
   - `SearchResults.jsx`: every book card
   - `ResultsRun.jsx`: every recommendation item
   - `SeedPanel.jsx`: selected seed book view
   - `ForYou.jsx`: replacing old toggle button
   - `Shelves.jsx`: shelf book cards
3. `client/src/api.js`: additions for updating shelf status.
4. `client/src/App.jsx`: global user library state management to ensure shelf counts and book status updates reflect immediately across all views.

Write your findings to `handoff.md` in your state folder (/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_1/handoff.md) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When done, send a message to your parent sub-orchestrator.
