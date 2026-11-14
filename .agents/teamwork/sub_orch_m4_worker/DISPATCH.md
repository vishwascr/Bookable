## 2026-11-14T01:37:21Z

You are the implementation Worker for Milestone 4 (sub_orch_m4_worker).
Your state folder is: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_worker
Working directory: /Users/admin/Documents/Bookable

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY READ FIRST:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4/SCOPE.md
4. Explorer 1 handoff (iOS tokens & CSS specifications): /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_1/handoff.md
5. Explorer 2 handoff (Algorithm customizer drawer & 3-seed selector specifications): /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_2/handoff.md
6. Explorer 3 handoff (Dev Mode toggle & Diagnostics HUD specifications): /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_3/handoff.md
7. Test suite status: /Users/admin/Documents/Bookable/TEST_READY.md

YOUR TASKS:
Implement the complete Milestone 4 frontend overhaul according to the explorer specifications and new user requirements:

1. `client/src/styles.css`:
   - Insert the iOS design tokens in `:root` (canonical `--ios-radius: 20px`, `--ios-bg: #F2F2F7`, `--ios-card: #FFFFFF`, shadows, hairline borders, glass blur, iOS font stack).
   - Standardize border-radius to 20px (`var(--ios-radius) !important`) across:
     - Cards: `.card`, `.auth-card`, `.shelf-book-card`, `.settings-card`, `.book-search-card`, `.seed-card`, `.run`, `.shelf`, `.card.seed`, `.card.how`, `.fav-strip`, `.rating-overview-card`, `.user-review-card`, `.review-item-card`, `.write-review-prompt-card`, `.hero-cta`, `.stat-box`, `.logout-message-box`, `.mascot-placeholder`
     - Modals: `.modal-container`, `.review-modal`, `.detail-modal`, `.confirm-modal`
     - Primary containers: `.empty-state-hero`, `.onboarding`, `.search-empty-state`, `.empty-reviews-state`, `.shelf-empty-state`, `.algo-customizer-drawer`, `.algo-customizer-panel`, `.dev-hud`
   - Add styles for the top controls bar, algorithm customizer drawer, dev mode toggle switch, diagnostics HUD, and onboarding review stepper per the handoff reports.

2. `client/src/api.js`:
   - Add methods:
     - `recommendThree: (seeds, weights, limit = 12) => j('/api/recommend/three', { method: 'POST', body: { seeds, weights, limit } })`
     - `recommendSentimentAdapted: (body) => j('/api/recommend/sentiment-adapted', { method: 'POST', body })`
     - `getDevDiagnostics: () => j('/api/dev/diagnostics')`

3. `client/src/components/AlgorithmCustomizer.jsx`:
   - Create component with top toggle button and collapsible iOS 20px drawer.
   - Sliders for:
     - Genre ($w_{\text{genre}}$, default 0.35)
     - Author ($w_{\text{author}}$, default 0.25)
     - Tag ($w_{\text{tag}}$, default 0.25)
     - Rating ($w_{\text{rating}}$, default 0.15)
   - Permanently display Title Similarity Weight as EXCLUDED (0.00) with a locked/disabled visual and explanatory note per requirements.
   - Presets: "Balanced (Default)", "Author Focus", "Genre Focus", "Top Rated", "Thematic Tags", and "Reset to Defaults".
   - Debounced real-time callback on weight changes.

4. `client/src/components/ThreeSeedSelector.jsx`:
   - Create 3-seed selector component allowing users to pick 3 books (or click "⭐ Use Top 3 Favourites").
   - Query `api.recommendThree(isbns, weights, limit)` and render candidates with explanations, match counts, score tags, dev mode feature badges, and `ReadingStatusButton`.

5. `client/src/components/DevDiagnosticsHUD.jsx`:
   - Create component visible when `devMode === true`.
   - Algorithm Telemetry: Title exclusion confirmation badge (`🛡️ Title Similarity: EXCLUDED (0.00)`), active heuristic weights, candidate count, query latency ms.
   - Sentiment Engine Output: Polarity score gauge (-1.000 to +1.000), classification badge, star calibration metrics, detected positive/negative keywords with weights, modifiers (intensifiers/negators), extracted aspect tags.
   - Interactive Sentiment Tester sandbox: lets users test review text live and view token valences.
   - Engine Internals: catalog stats, normalized authors, taxonomies.

6. `client/src/components/Onboarding.jsx`:
   - Add the optional Review step after user picks 3–5 books!
   - Include left/right navigation arrows (← / →) to cycle through each selected book.
   - For each selected book, provide 1–5 star rating and optional review text to trigger sentiment analysis.
   - On completion, submit reviews via `api.submitReview` for any reviewed books, then proceed to the dashboard.
   - Provide a "Skip to Recommendations" button so reviews are optional.

7. `client/src/components/BookDetailModal.jsx` & `client/src/components/ReviewModal.jsx`:
   - Ensure public community reviews are fetched and visible for any user viewing a book.
   - In `BookDetailModal.jsx`: when `devMode === true`, show sentiment diagnostic badges on reviews. When `devMode === false`, display clean Goodreads review presentation.
   - In `ReviewModal.jsx`: call `onSentimentAnalyzed` callback on submission so HUD displays the fresh sentiment calculation.

8. `client/src/components/ForYou.jsx` & `client/src/components/ResultsRun.jsx`:
   - When `devMode === false`: suppress candidate counts, milliseconds, and raw score breakdown bars from standard browsing.
   - When `devMode === true`: reveal telemetry pill and diagnostic feature badges.
   - In `ForYou.jsx`: embed `ThreeSeedSelector` so users can easily use the 3-book recommendation engine with custom algorithm weights.

9. `client/src/App.jsx`:
   - Top action bar in header hosting `[ ⚙️ Customize Algorithm ]` and `[ 🛠️ Dev Mode: [ON|OFF] ]`.
   - State for `devMode` (default false, persisted in localStorage `bookable_dev_mode`).
   - State for `algoWeights` (default `{ genre: 0.35, author: 0.25, tag: 0.25, rating: 0.15 }`, persisted in localStorage `bookable_algo_weights`).
   - Mount `AlgorithmCustomizer` and `DevDiagnosticsHUD`.
   - Pass `devMode` and `algoWeights` down to child components.

10. VERIFICATION:
    - Run client build: `npm --prefix client run build` (must succeed with 0 errors).
    - Run test suite: `node tests/run-all.js` (all 120 tests must pass 100%).
    - Verify 20px rounded corners on all cards, modals, and containers.
    - Write complete handoff report to /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_worker/handoff.md. Include list of files ready for git commit.
    - Notify me via send_message when finished.
