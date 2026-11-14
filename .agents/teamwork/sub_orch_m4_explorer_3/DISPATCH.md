# DISPATCH — sub_orch_m4_explorer_3
Role: teamwork_explorer
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_3
Working directory: /Users/admin/Documents/Bookable


## 2026-11-13T20:52:47Z
You are teamwork_explorer_3 for Milestone 4 (sub_orch_m4_explorer_3).
Your state folder is: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_3
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read these files first:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4/SCOPE.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3/handoff.md
5. /Users/admin/Documents/Bookable/TEST_READY.md

Your focus: Dev Mode Toggle & Diagnostics HUD (`DevDiagnosticsHUD.jsx`)
Investigate client/src/App.jsx, client/src/components/, server sentiment and recommendation endpoints, and tests in `tests/`.
1. Inspect how `devMode` state should be managed:
   - Toggle button/switch in top navigation: `[ 🛠️ Dev Mode: [ON|OFF] ]`.
   - Persisted in localStorage (`bookable_dev_mode`) or React state.
   - Default: false (OFF).
2. Inspect what happens when Dev Mode is OFF:
   - All internal diagnostics, raw sentiment scores (-1.0 to +1.0), token weights, aspect breakdowns, candidate counts, and latency numbers are completely hidden from standard Goodreads browsing.
3. Inspect what happens when Dev Mode is ON:
   - A dedicated `DevDiagnosticsHUD.jsx` expands or appears below the header (or collapsible tray) with:
     - Algorithm Telemetry: candidates evaluated, latency ms, active weights, seed count, title exclusion confirmation badge.
     - Review Sentiment Analysis Output: shows analyzed text, polarity score, classification (positive/neutral/negative), detected positive/negative keywords with weights, intensifiers/negators, extracted aspect tags, star calibration.
     - Engine internals & state metrics (from `/api/dev/diagnostics` or recommendation responses).
     - Card badges / overlays: recommendation cards display diagnostic badges showing individual feature scores when Dev Mode is active.
4. Verify integration with `App.jsx`, `ForYou.jsx`, `ReviewModal.jsx`, `BookDetailModal.jsx`.
5. Recommend exact component code structure, state flows, and props. DO NOT modify source files directly.
6. Write your complete handoff report to /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_3/handoff.md and notify me via send_message when finished.
