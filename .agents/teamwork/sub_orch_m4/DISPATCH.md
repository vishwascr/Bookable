# Task Assignment: Milestone 4 Sub-Orchestrator

## 🔒 My Identity
- Archetype: orchestrator (self)
- Roles: orchestrator, successor
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4
- Parent Conversation ID: 54805123-e26b-42d5-8dac-b0d9c2d12bdd (Top-level Project Orchestrator)

## Milestone Scope: M4 — iOS-Inspired UI Overhaul, Top Controls & Dev Mode Diagnostics
Your scope is to implement the iOS-inspired visual overhaul with 20px rounded corners across all primary containers, the top-of-viewport algorithm customization controls, and the Dev Mode toggle with real-time diagnostics HUD:

1. **iOS-Inspired Visual Design (20px Rounded Corners)**:
   - Apply `--ios-radius: 20px` border-radius across cards, modals, and primary containers in `client/src/styles.css`:
     - Cards (`.card`, `.auth-card`, `.shelf-book-card`, `.settings-card`, `.book-search-card`, `.seed-card`, `.run`)
     - Modals (`.modal-container`, `.review-modal`, `.book-detail-modal`, `.confirm-modal`)
     - Primary containers (`.empty-state-hero`, `.onboarding`, `.dev-hud`, `.algo-customizer-panel`)
   - iOS aesthetic: clean typography, subtle borders (`rgba(0,0,0,0.08)` or dark mode equivalent), smooth transitions, elegant shadow tokens.

2. **Top-Level Algorithm Customization Drawer (`client/src/components/AlgorithmCustomizer.jsx`)**:
   - Prominent toggle button at the top of the interface: `[ ⚙️ Customize Algorithm ]` (or dropdown/drawer).
   - Collapsible drawer allowing users to customize recommendation algorithm weights:
     - Genre weight ($w_{\text{genre}}$)
     - Author weight ($w_{\text{author}}$)
     - Tag weight ($w_{\text{tag}}$)
     - Rating weight ($w_{\text{rating}}$)
     - Title similarity weight ($w_{\text{title}}$) must be displayed as permanently EXCLUDED / 0.
   - Real-time adjustment passes updated weights to recommendation queries.

3. **Dev Mode Toggle & Diagnostics HUD (`client/src/components/DevDiagnosticsHUD.jsx`)**:
   - Top-level toggle: `[ 🛠️ Dev Mode: [ON|OFF] ]`.
   - When **OFF** (disabled): Under-the-hood technical details, raw sentiment scores, token weights, and algorithm internals remain cleanly hidden from standard Goodreads browsing.
   - When **ON** (enabled): Reveals under-the-hood diagnostics:
     - Sentiment analysis outputs: raw polarity score (-1.0 to +1.0), detected positive/negative keywords, aspect extractions, star blend calculations.
     - Algorithm telemetry: candidate count evaluated, query latency (ms), feature weight breakdown, seed count, title exclusion confirmation.
     - Card badges: displays diagnostic badges on recommendation cards showing individual feature scores.

4. **Integration in `client/src/App.jsx`**:
   - Embed the top toggle bar containing `[ ⚙️ Customize Algorithm ]` and `[ 🛠️ Dev Mode: ON/OFF ]`.
   - Connect global `devMode` state (persisted in localStorage or React state).
   - Pass algorithm weights to recommendation views.

5. **Verification**:
   - Client build succeeds cleanly (`npm --prefix client run build`).
   - All 120 tests in `node tests/run-all.js` pass (100%).
   - Verify 20px rounded corners on all cards, modals, and primary containers.
   - Verify Dev Mode hides diagnostics when OFF and reveals telemetry when ON.
   - List files ready for git commit in handoff report.

6. **Write Boundaries**:
   - Exclusively owns: `client/src/components/DevDiagnosticsHUD.jsx`, `client/src/components/AlgorithmCustomizer.jsx`, `client/src/components/ThreeSeedSelector.jsx`, `client/src/styles.css`, `client/src/App.jsx`.

Follow the Project Pattern procedure: Assess -> Decompose or Iterate (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
Exit when the gate passes.

MANDATORY INPUTS:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- Survey report: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3/handoff.md`
- Test suite: `/Users/admin/Documents/Bookable/TEST_READY.md`


## 2026-11-13T20:51:02Z
[Message from Parent 54805123-e26b-42d5-8dac-b0d9c2d12bdd]
You are the Milestone 4 Sub-Orchestrator for Bookable.
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3/handoff.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4/DISPATCH.md
5. /Users/admin/Documents/Bookable/TEST_READY.md

Your scope:
M4: iOS-Inspired UI Overhaul, Top Controls & Dev Mode Diagnostics.
Apply 20px rounded corners across cards, modals, and primary containers.
Implement top toggle drawer for Algorithm Customization (sliders for genre, author, tag, rating; title similarity permanently excluded).
Implement Dev Mode toggle and Diagnostics HUD (revealing sentiment analysis outputs and algorithm metrics when enabled, hiding them when disabled).
Verify build (`npm run build`), test suite (`node tests/run-all.js`), and styling compliance.
Follow the orchestrator procedure (Assess -> Decompose/Iterate with Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
When M4 gate passes, report back via send_message with your handoff.md path and list of files ready for git commit.


## 2026-11-14T01:32:57Z
[Message from Parent 54805123-e26b-42d5-8dac-b0d9c2d12bdd]
**Context**: Liveness check on Milestone 4.
**Content**: Please check the status of your 3 Explorers (96a6288c, 3faa3aa0, 2dac20e2), synthesize their findings if ready, and proceed with Worker dispatch.
**Action**: Update progress.md and report current status.


## 2026-11-14T01:36:21Z
[Message from Parent 54805123-e26b-42d5-8dac-b0d9c2d12bdd]
**Context**: New User Requirements for Milestone 4
**Content**: Two new user requirements have been received and incorporated into `ORIGINAL_REQUEST.md` and `PROJECT.md`:
1. **Onboarding ("Pick 3–5 books you love") Review Step**:
   - After picking 3–5 books during onboarding, add an optional step asking for reviews of those selected books for sentiment analysis.
   - Include left/right navigation arrows (<kbd>←</kbd> / <kbd>→</kbd>) to toggle between the selected books, with a 1-5 star rating and optional review text for each book.
2. **Public Community Reviews**:
   - Ensure reviews shared by a user are public and appear for other users viewing that book (in `BookDetailModal` and community reviews stream).
**Action**: Incorporate both requirements into your worker blueprint for Milestone 4 implementation and verification.
