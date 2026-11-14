# Scope: Milestone 4 — iOS-Inspired UI Overhaul, Top Controls & Dev Mode Diagnostics

## Architecture
Milestone 4 is the visual, control layer, and onboarding overhaul of Bookable:
- **Design Language**: iOS-inspired design featuring 20px rounded corners across cards, modals, and primary containers (`--ios-radius: 20px`), subtle borders, soft elevation shadows, and clean modern typography.
- **Top Controls Bar**:
  - `AlgorithmCustomizer.jsx`: Collapsible top drawer/panel toggled via `[ ⚙️ Customize Algorithm ]` providing sliders for genre ($w_{\text{genre}}$), author ($w_{\text{author}}$), tag ($w_{\text{tag}}$), and rating ($w_{\text{rating}}$) weights. Title similarity weight is permanently displayed as EXCLUDED (0.00). Dynamic weight adjustments feed into recommendation engine requests.
  - `DevDiagnosticsHUD.jsx`: Toggled via `[ 🛠️ Dev Mode: [ON|OFF] ]`. When OFF, all internal telemetry and raw sentiment scores remain hidden, maintaining a clean Goodreads browsing experience. When ON, reveals real-time sentiment analysis outputs (polarity, detected positive/negative keywords, aspect extractions, star calibration), recommendation engine metrics (candidates evaluated, query latency, weights applied, title exclusion badge), and card diagnostic badges.
- **Onboarding Review Step (`Onboarding.jsx`)**:
  - After picking 3–5 books during onboarding, present an optional step asking for reviews of those selected books for sentiment analysis.
  - Includes left/right navigation arrows (<kbd>←</kbd> / <kbd>→</kbd>) to toggle between the selected books, with a 1-5 star rating and optional review text for each book.
- **Community Reviews**:
  - Ensure reviews shared by any user are public and appear for other users viewing that book (in `BookDetailModal` and community reviews stream).
- **Integration**:
  - `App.jsx`: Top navigation header hosts the algorithm customizer toggle and Dev Mode switch. State for algorithm weights and devMode is managed and passed down to child components (`ForYou.jsx`, `Shelves.jsx`, recommendation views).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 5 | Community Review Stream | Display community reviews and user's review on book modals/details | M4, M3 | Follow-up |
| 12 | Algorithm Customization Toggle | Top-of-interface toggle and slider controls to dynamically adjust recommendation parameters | M4 | R3, AC3 |
| 15 | iOS-Inspired 20px Rounded UI | Visual redesign enforcing 20px border-radius on cards, modals, and primary containers | M4 | R4, AC4 |
| 16 | Dev Mode Diagnostics Toggle | Top-bar toggle revealing sentiment analysis outputs, algorithm metrics, and internal state when enabled | M4 | R4, AC4 |
| 20 | Onboarding Review Step | Optional step after picking 3-5 books with ← / → navigation to review selected books for sentiment analysis | M4 | Follow-up |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M4.1 | Exploration & Technical Plan | Investigate existing client styling, component hierarchy, modal structures, and test suites | M2, M3 | DONE |
| M4.2 | Implementation | Implement 20px iOS styles, AlgorithmCustomizer drawer, DevDiagnosticsHUD, Onboarding review step, and App integration | M4.1 | IN_PROGRESS |
| M4.3 | Independent Reviews | Review visual styling, 20px enforcement, dev mode toggle hiding/revealing, build & test verification | M4.2 | PLANNED |
| M4.4 | Adversarial Verification | Empirical challenge of sliders, dev mode toggle, CSS computed properties, title exclusion display | M4.2 | PLANNED |
| M4.5 | Forensic Audit | Verify authentic implementation, no cheating or mocked outputs | M4.2 | PLANNED |
| M4.6 | Gate & Handoff | Evaluate gate criteria, report back to Project Orchestrator | M4.3, M4.4, M4.5 | PLANNED |

## Code Layout & Write Boundaries
- `client/src/styles.css`
- `client/src/api.js`
- `client/src/components/AlgorithmCustomizer.jsx`
- `client/src/components/DevDiagnosticsHUD.jsx`
- `client/src/components/ThreeSeedSelector.jsx`
- `client/src/components/Onboarding.jsx`
- `client/src/components/ForYou.jsx`
- `client/src/components/ResultsRun.jsx`
- `client/src/components/ReviewModal.jsx`
- `client/src/components/BookDetailModal.jsx`
- `client/src/App.jsx`
