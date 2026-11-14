## 2026-11-13T20:17:17Z
You are teamwork_explorer_m3_3.
Your state folder: /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3
Working directory: /Users/admin/Documents/Bookable

MANDATORY INPUTS: Read these files first:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_2/handoff.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m3/SCOPE.md
5. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/DISPATCH.md

Your mission:
Analyze the codebase and provide an exact technical specification and plan for implementing:
1. `client/src/components/SettingsPage.jsx`:
   - Account overview (avatar, username, displayName, member since date).
   - Reading & shelf statistics (total books shelved, want to read, currently reading, read, reviews written).
   - "Reset My Books" action:
     - Clear confirmation modal dialog explaining that all shelf books and favourites will be cleared while written reviews remain intact.
     - Calls `POST /api/me/reset-books`.
     - Updates `me` state immediately.
   - "Delete My Reviews" action:
     - Clear confirmation modal dialog explaining that all user reviews will be permanently deleted while shelved books remain intact.
     - Calls `DELETE /api/me/reviews`.
     - Updates statistics / state immediately.
2. `client/src/App.jsx` wiring:
   - Navigation bar updates: add `⚙️ Settings` link when logged in.
   - Add `'settings'` view to view state machine.
   - Global review and detail modal state (`reviewModalBook`, `detailModalBook`).
   - Shelf change handler callback that syncs across all pages.
3. `GAP_ANALYSIS.md` (at project root `/Users/admin/Documents/Bookable/GAP_ANALYSIS.md`):
   - Detailed parity report between Bookable and an on-device Goodreads alternative.
   - Comprehensive comparison matrix (UX Dimension, Goodreads standard, Bookable parity implementation, status).
   - Detailed coverage of:
     - Catalog search & discovery
     - Universal "+ Want to read" action
     - 3 exclusive reading statuses (Want to read, Currently reading, Read)
     - 1-5 star ratings & interactive star widget
     - Written book reviews with text & community stream
     - Multi-shelf personal libraries with 5 tabbed sections
     - Book details view
     - User authentication & multi-user data isolation
     - Settings page with confirmation-protected Reset Books and Delete Reviews
   - Verification evidence and parity scorecard.

Write your findings to `handoff.md` in your state folder (/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m3_3/handoff.md) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When done, send a message to your parent sub-orchestrator.
