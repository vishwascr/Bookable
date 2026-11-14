# Milestone 4 Investigation Report: iOS-Inspired Visual Design Overhaul & 20px Rounded Corners

**Agent**: `sub_orch_m4_explorer_1`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m4_explorer_1`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**Milestone**: Milestone 4 — iOS-Inspired UI Overhaul, Top Controls & Dev Mode Diagnostics  
**Focus**: iOS Design Language, Design Tokens, 20px Corner Radius Audit, and Turnkey CSS Specifications  

---

## 1. Observation

### 1.1 Centralized Stylesheet Architecture
- The entire frontend styling is centralized in a single stylesheet: `client/src/styles.css` (2,949 lines).
- Inspection across all 19 JSX components in `client/src/components/` and `client/src/App.jsx` confirms there are **zero CSS-in-JS libraries**, **zero CSS modules**, and **no conflicting inline styles** for border-radius or container layout (only dynamic bar widths `style={{ width: '...' }}` are set inline).
- The client builds cleanly with Vite (`npm --prefix client run build` succeeds in ~500ms, outputting `dist/assets/index-*.css` and `dist/assets/index-*.js`).

### 1.2 Comprehensive Audit of All 88 `border-radius` Declarations
Every occurrence of `border-radius` in `client/src/styles.css` was mapped to its exact rule and selector:

| Line # | Selector | Current Value | Classification | Required Action |
|:---|:---|:---|:---|:---|
| 59 | `.status` | `99px` | Header Pill Badge | Maintain iOS Pill (`9999px`) |
| 80 | `.error` | `8px` | Alert Box | Update to `--ios-radius-inner: 12px` |
| 100 | `.input-row` | `14px` | Search Input Container | Update to `--ios-radius-md: 14px` (iOS search field) |
| 136 | `.clear-btn` | `8px` | Inline Button | Update to `--ios-radius-sm: 10px` |
| 151 | `.search-btn` | `10px` | Form Button | Update to `--ios-radius-sm: 10px` |
| 169 | `.dropdown` | `12px` | Search Autocomplete Menu | Update to `--ios-radius-md: 14px` |
| 187 | `.dropdown-hint kbd` | `4px` | Micro Key Tag | Maintain subtle tag (`4px` or `6px`) |
| 202 | `.dropdown li` | `8px` | Menu Item Highlight | Update to `8px` / `10px` |
| **244** | **`.empty-state-hero`** | **`16px`** | **Primary Container** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 265 | `.hero-content kbd` | `4px` | Micro Key Tag | Maintain `4px` |
| 282 | `.sample-pill` | `99px` | Suggestion Pill | Maintain iOS Pill (`9999px`) |
| 307 | `.recommendation-breadcrumbs` | `10px` | Nav Bar | Update to `--ios-radius-md: 14px` |
| 364 | `.results-badge` | `99px` | Count Badge | Maintain iOS Pill (`9999px`) |
| 373 | `.btn-secondary` | `8px` | Button | Update to `--ios-radius-btn: 12px` |
| 395 | `.spinner` | `50%` | Loading Indicator | Maintain Circular (`50%`) |
| **410** | **`.search-empty-state`** | **`14px`** | **Primary Container** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 425 | `.search-tips` | `10px` | Nested Tip Box | Update to `--ios-radius-inner: 12px` |
| **450** | **`.book-search-card`** | **`14px`** | **Book Result Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 547 | `.pagination-btn` | `8px` | Pagination Control | Update to `--ios-radius-sm: 10px` |
| 597 | `.picker button` | `99px` | Segmented Control Pill | Maintain iOS Pill (`9999px`) |
| **642** | **`.card`** | **`14px`** | **Universal Card Base** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 672 | `.term` | `6px` | Metadata Keyword Tag | Maintain Tag (`6px`) |
| 716 | `.formula` | `8px` | Formula Monospace Box | Update to `--ios-radius-inner: 10px` |
| **740** | **`.run`** | **`14px`** | **Algorithm Run Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 779 | `.result` | `10px` | Recommendation Row | Update to `--ios-radius-inner: 12px` |
| 813 | `.bar` | `99px` | Feature Bar Track | Maintain Pill (`9999px`) |
| 820 | `.bar>div` | `99px` | Feature Bar Fill | Maintain Pill (`9999px`) |
| 845 | `.cover` | `4px` | Book Cover Image | Update to `--ios-radius-xs: 6px` |
| 900 | `.user-nav>button:not(.link)`| `99px` | Header Pill Nav Button | Maintain iOS Pill (`9999px`) |
| 915 | `.avatar` | `50%` | User Profile Circle | Maintain Circular (`50%`) |
| 929 | `.btn-primary` | `10px` | Primary Action Button | Update to `--ios-radius-btn: 12px` |
| **980** | **`.hero-cta`** | **`14px`** | **Landing Banner Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| **1001**| **`.auth-card`** | **`16px`** | **Auth Dialog Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 1029| `.auth-card input` | `9px` | Form Field | Update to `--ios-radius-input: 12px` |
| **1049**| **`.onboarding`** | **`16px`** | **Primary Wizard Container**| **MUST UPDATE TO 20px (`--ios-radius`)** |
| 1081| `.dots span` | `99px` | Step Indicators | Maintain Pill (`9999px`) |
| 1102| `.picked-chip` | `10px` | Selected Book Chip | Update to `--ios-radius-inner: 12px` |
| 1125| `.onb-search` | `12px` | Onboarding Search Bar | Update to `--ios-radius-input: 12px` |
| 1151| `.onb-book` | `12px` | Book Grid Item | Update to `--ios-radius-inner: 12px` |
| 1194| `.check` | `50%` | Selection Checkmark | Maintain Circular (`50%`) |
| 1250| `.fav-item` | `10px` | Favorite Seed Chip | Update to `--ios-radius-inner: 12px` |
| 1298| `.want-btn` | `99px` | Quick Add Pill | Maintain iOS Pill (`9999px`) |
| **1320**| **`.shelf`** | **`14px`** | **Shelf Container Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| **1413**| **`.mascot-placeholder`** | **`18px`** | **Mascot Container Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 1438| `.mascot-badge` | `99px` | Mascot Version Pill | Maintain iOS Pill (`9999px`) |
| **1495**| **`.logout-message-box`** | **`12px`** | **Logout Container Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 1535| `.status-btn-group` | `99px` | Reading Status Split Pill | Maintain iOS Pill (`9999px`) |
| 1602| `.status-btn-active` | `99px` | Reading Status Active Pill | Maintain iOS Pill (`9999px`) |
| 1641| `.reading-status-menu` | `14px` | Popover Menu | Update to `--ios-radius-md: 14px` |
| **1730**| **`.modal-container`** | **`20px`** | **Universal Modal Base** | **Standardize with `--ios-radius: 20px`** |
| 1764| `.modal-close-btn` | `8px` | Modal Close Button | Update to circular / `--ios-radius-circle: 50%` |
| 1781| `.modal-badge` | `99px` | Modal Header Pill | Maintain iOS Pill (`9999px`) |
| 1799| `.modal-book-snippet` | `14px` | Nested Book Summary | Update to `--ios-radius-md: 14px` |
| 1906| `.textarea-field textarea` | `12px` | Review Text Field | Update to `--ios-radius-input: 12px` |
| 1927| `.shelf-notice` | `10px` | Reassurance Notice | Update to `--ios-radius-inner: 12px` |
| 2020| `.detail-meta-grid` | `14px` | Book Metadata Grid | Update to `--ios-radius-inner: 14px` |
| 2050| `.btn-explore-seed` | `12px` | Modal Action Button | Update to `--ios-radius-btn: 12px` |
| **2073**| **`.rating-overview-card`**| **`16px`** | **Ratings Summary Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 2133| `.hist-bar-track` | `99px` | Histogram Track | Maintain Pill (`9999px`) |
| 2140| `.hist-bar-fill` | `99px` | Histogram Fill | Maintain Pill (`9999px`) |
| **2166**| **`.user-review-card`** | **`16px`** | **User Review Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 2206| `.sentiment-badge` | `99px` | Sentiment Polarity Pill | Maintain iOS Pill (`9999px`) |
| 2239| `.kw-pill` | `6px` | Sentiment Keyword Tag | Maintain Tag (`6px`) |
| **2251**| **`.write-review-prompt-card`**| **`14px`**| **Review Prompt Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| **2270**| **`.empty-reviews-state`** | **`14px`** | **Reviews Empty State** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| **2286**| **`.review-item-card`** | **`16px`** | **Community Review Card** | **MUST UPDATE TO 20px (`--ios-radius`)** |
| 2306| `.reviewer-avatar` | `50%` | Reviewer Avatar | Maintain Circular (`50%`) |
| 2400| `.shelves-filter-input` | `99px` | Search Filter Pill | Maintain iOS Pill (`9999px`) |
| 2432| `.shelf-tabs-nav` | `14px` | Segmented Shelf Bar | Update to `--ios-radius-md: 14px` |
| 2445| `.shelf-tab-btn` | `10px` | Shelf Tab Button | Update to `--ios-radius-sm: 10px` |
| 2464| `.tab-count-badge` | `99px` | Tab Count Pill | Maintain iOS Pill (`9999px`) |
| 2479| `.fav-strip-header` | `14px` | Favorites Banner | Update to `--ios-radius-md: 14px` |
| **2492**| **`.shelf-empty-state`** | **`20px`** | **Shelf Empty State** | **Standardize with `--ios-radius: 20px`** |
| **2512**| **`.shelf-book-card`** | **`20px`** | **Shelf Book Card** | **Standardize with `--ios-radius: 20px`** |
| 2539| `.fav-badge` | `50%` | Seed Star Badge | Maintain Circular (`50%`) |
| 2625| `.btn-review-status` | `8px` | Review Shelf Action | Update to `--ios-radius-sm: 8px` / `10px` |
| **2666**| **`.settings-card`** | **`20px`** | **Settings Page Card** | **Standardize with `--ios-radius: 20px`** |
| 2693| `.settings-avatar` | `50%` | Large User Avatar | Maintain Circular (`50%`) |
| 2735| `.status-badge` | `99px` | Profile Status Pill | Maintain iOS Pill (`9999px`) |
| **2761**| **`.stat-box`** | **`16px`** | **Stats Metric Card** | **UPDATE TO 20px (`--ios-radius`)** |
| 2835| `.btn-danger-outline` | `12px` | Destructive Action | Update to `--ios-radius-btn: 12px` |
| 2853| `.modal-reassurance-box` | `12px`| Nested Safe Banner | Update to `--ios-radius-inner: 12px` |
| 2864| `.modal-alert-box` | `12px` | Nested Warning Banner | Update to `--ios-radius-inner: 12px` |
| 2877| `.modal-error-alert` | `10px` | Nested Error Alert | Update to `--ios-radius-inner: 10px` |
| 2887| `.btn-danger` | `12px` | Destructive Fill Button | Update to `--ios-radius-btn: 12px` |
| 2909| `.btn-secondary` | `12px` | Secondary Button | Update to `--ios-radius-btn: 12px` |
| 2919| `.btn-secondary.sm` | `8px` | Small Secondary Button | Update to `--ios-radius-sm: 8px` |
| **2931**| **`.settings-toast-success`**| **`14px`**| **Notification Toast** | **UPDATE TO 16px / 20px** |
| 2949| `.toast-dismiss-btn` | `6px` | Toast Dismiss Button | Maintain `6px` |

### 1.3 Identification of All Non-Compliant Elements (16 Existing Selectors)
The following 16 selectors in `client/src/styles.css` currently declare border radii under 20px (`12px`, `14px`, `16px`, or `18px`) and MUST be updated to `20px` (`var(--ios-radius)`):
1. `.card` (line 642: `14px` → `20px`) — Universal base for `.seed`, `.how`, `.fav-strip`, `.slider` panels
2. `.auth-card` (line 1001: `16px` → `20px`) — Login, signup, and logout cards
3. `.book-search-card` (line 450: `14px` → `20px`) — Search results book card
4. `.empty-state-hero` (line 244: `16px` → `20px`) — Main landing hero banner
5. `.onboarding` (line 1049: `16px` → `20px`) — Onboarding favorites selector container
6. `.run` (line 740: `14px` → `20px`) — Algorithm results run container
7. `.shelf` (line 1320: `14px` → `20px`) — Legacy shelf container
8. `.hero-cta` (line 980: `14px` → `20px`) — Landing page CTA card
9. `.search-empty-state` (line 410: `14px` → `20px`) — Search zero-results container
10. `.rating-overview-card` (line 2073: `16px` → `20px`) — Community ratings summary container
11. `.user-review-card` (line 2166: `16px` → `20px`) — User's own review display card
12. `.review-item-card` (line 2286: `16px` → `20px`) — Community review item card
13. `.write-review-prompt-card` (line 2251: `14px` → `20px`) — Review callout card
14. `.empty-reviews-state` (line 2270: `14px` → `20px`) — Reviews empty state container
15. `.logout-message-box` (line 1495: `12px` → `20px`) — Logout feedback container
16. `.mascot-placeholder` (line 1413: `18px` → `20px`) — Mascot container box

Plus 2 upcoming Milestone 4 primary containers:
17. `.algo-customizer-panel` (New M4.2 component: Algorithm Customizer drawer) → MUST declare `20px`
18. `.dev-hud` (New M4.2 component: Dev Mode Diagnostics HUD) → MUST declare `20px`

### 1.4 Test Suite Impact Analysis
- Inspected all test files in `tests/`: `auth-isolation.test.js`, `recommendation-heuristics.test.js`, `sentiment-analysis.test.js`, `e2e-scenarios.test.js`.
- The test suite operates via direct HTTP `fetch` against the Express API (`http://127.0.0.1:5050/api`).
- There are **no DOM queries, no Selenium/Playwright browser automation, and no CSS selector assertions** in `tests/`.
- Adjusting CSS classes and rules in `client/src/styles.css` has **zero risk** of breaking any automated test suite.

---

## 2. Logic Chain

### 2.1 Translating Requirements into an Authentic iOS Aesthetic
1. **Deduction from R4 & Acceptance Criteria**:
   - `ORIGINAL_REQUEST.md:23`: *"Apply an iOS-like visual design across the application featuring 20px rounded corners for cards, modals, and primary containers."*
   - `ORIGINAL_REQUEST.md:46`: *"Application cards, modals, and key interactive containers use an iOS-inspired design with 20px rounded corners."*
2. **Apple Human Interface Guidelines (HIG) Principles**:
   - *Continuous Curvature & 20px Radii*: Standardized 20px squircle-like corners for primary cards and modals create harmonious grouping.
   - *Concentric Geometry Rule*: Nested elements inside a 20px container follow $R_{\text{inner}} \approx R_{\text{outer}} - \text{padding}$, resulting in 10px–14px inner controls and 9999px full pills for standalone badges.
   - *Layered Depth & Multi-Stop Shadows*: Rather than harsh single-drop shadows, authentic iOS surfaces use subtle double-layer shadows (`0 4px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)`), paired with ultra-subtle hairline borders (`1px solid rgba(0, 0, 0, 0.06)`).
   - *Material Vibrancy & Translucency*: Floating chrome (top navigation, modals, HUD) utilizes `backdrop-filter: blur(20px) saturate(180%)` to allow underlying content hues to bleed through naturally.
   - *System Grouped Background*: The base canvas uses iOS System Grouped Background (`#F2F2F7`), against which pure white `#FFFFFF` cards float with crisp contrast.
3. **Layout Stability & Zero Reflow Risk**:
   - All elements already use `box-sizing: border-box`.
   - Modifying `border-radius` from 14px/16px to 20px does not alter element widths, margins, or padding.
   - Dropdowns (such as `.reading-status-menu` in `.shelf-book-card`) must not be clipped: `.shelf-book-card` and `.card` must avoid `overflow: hidden`, keeping dropdowns freely floating.

---

## 3. iOS Design Token Specifications

The following `:root` tokens must be inserted at the top of `client/src/styles.css`:

```css
:root {
  /* ==========================================================================
     iOS Design System Tokens — Bookable Milestone 4
     ========================================================================== */

  /* 1. Corner Radius Tokens (Canonical 20px Standard) */
  --ios-radius: 20px;          /* MANDATORY for cards, modals, and primary containers */
  --ios-radius-lg: 20px;       /* Primary surface containers */
  --ios-radius-md: 14px;       /* Sub-containers, search bar, dropdown menus */
  --ios-radius-sm: 10px;       /* Buttons, tab triggers, inputs */
  --ios-radius-xs: 6px;        /* Tags, keyword badges, book covers */
  --ios-radius-pill: 9999px;   /* Segmented controls, status badges, progress bars */
  --ios-radius-circle: 50%;    /* Avatars, checkmarks, circular icon buttons */

  /* 2. Color System (iOS System Grouped Palette + Bookable Brand Vibrancy) */
  --ios-bg: #F2F2F7;                   /* iOS System Grouped Background */
  --ios-card: #FFFFFF;                 /* Pure White Card Surface */
  --ios-surface-secondary: #F8F8FA;    /* Secondary Card / Nested Group Surface */
  --ios-surface-tertiary: #EBEBF0;     /* Inactive controls, slider tracks */
  --ios-ink: #1C1C1E;                  /* iOS Label (Primary Text) */
  --ios-muted: #8E8E93;                /* iOS Secondary Label (Muted Text) */
  --ios-blue: #007AFF;                 /* iOS System Blue (Accent / Dev Active) */
  --ios-accent: #E85D3B;               /* Bookable Warm Terracotta Brand Accent */
  --ios-accent-hover: #D44E2E;         /* Accent Hover State */
  --ios-green: #34C759;                /* iOS System Green (Success / Want to Read / Read) */
  --ios-orange: #FF9500;               /* iOS System Orange (Stars / Neutral) */
  --ios-red: #FF3B30;                  /* iOS System Red (Destructive / Danger / Negative) */
  --ios-purple: #AF52DE;               /* iOS System Purple (Aspect Tags) */
  --ios-indigo: #5856D6;               /* iOS System Indigo */

  /* Backward Compatibility Mappings for Existing CSS */
  --bg: var(--ios-bg);
  --card: var(--ios-card);
  --ink: var(--ios-ink);
  --muted: var(--ios-muted);
  --line: rgba(60, 60, 67, 0.12);      /* iOS Hairline Separator */
  --accent: var(--ios-accent);
  --accent-hover: var(--ios-accent-hover);
  --accent-2: var(--ios-blue);
  --ok: var(--ios-green);

  /* 3. Hairline Borders & Separators */
  --ios-border: 1px solid rgba(0, 0, 0, 0.07);
  --ios-border-subtle: 1px solid rgba(0, 0, 0, 0.04);
  --ios-border-focus: 1px solid rgba(0, 122, 255, 0.4);
  --ios-separator: 1px solid rgba(60, 60, 67, 0.12);

  /* 4. Elevation Shadows (Multi-Stop iOS Diffusion) */
  --ios-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --ios-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --ios-shadow-card: 0 4px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
  --ios-shadow-card-hover: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03);
  --ios-shadow-modal: 0 24px 60px rgba(0, 0, 0, 0.16), 0 4px 16px rgba(0, 0, 0, 0.06);
  --ios-shadow-dropdown: 0 10px 30px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04);
  --ios-shadow-thumb: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.06);

  /* 5. Translucency & Glassmorphism */
  --ios-glass-bg: rgba(255, 255, 255, 0.85);
  --ios-glass-blur: blur(20px) saturate(180%);
  --ios-modal-backdrop: rgba(0, 0, 0, 0.38);

  /* 6. Typography & Transitions */
  --ios-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif;
  --ios-transition-fast: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  --ios-transition-smooth: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  --ios-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

---

## 4. Turnkey CSS Modification Specifications

### 4.1 Master 20px Rounded Container Enforcement Rule
To guarantee that every card, modal, and primary container strictly maintains the 20px corner radius regardless of cascade order, declare the collective enforcement selector in `client/src/styles.css`:

```css
/* ==========================================================================
   MANDATORY: 20px Rounded Corners Across Cards, Modals & Primary Containers
   ========================================================================== */
.card,
.auth-card,
.shelf-book-card,
.settings-card,
.book-search-card,
.seed-card,
.card.seed,
.card.how,
.fav-strip,
.run,
.shelf,
.empty-state-hero,
.onboarding,
.modal-container,
.review-modal,
.detail-modal,
.search-empty-state,
.empty-reviews-state,
.shelf-empty-state,
.rating-overview-card,
.user-review-card,
.review-item-card,
.write-review-prompt-card,
.hero-cta,
.stat-box,
.logout-message-box,
.mascot-placeholder,
.algo-customizer-panel,
.dev-hud {
  border-radius: var(--ios-radius) !important; /* Exactly 20px */
}
```

### 4.2 Exact Rule-by-Rule Modifications in `client/src/styles.css`

#### 1. Universal Card Base (`.card`) — Lines 639–644
```css
/* BEFORE */
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}

/* AFTER (iOS 20px Card Styling) */
.card {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 18px 20px;
  box-shadow: var(--ios-shadow-card);
  transition: var(--ios-transition-smooth);
}
```

#### 2. Auth Card (`.auth-card`) — Lines 996–1007
```css
/* BEFORE */
.auth-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 10px 30px #0000000d;
}

/* AFTER (iOS 20px Auth Card) */
.auth-card {
  width: 100%;
  max-width: 440px;
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--ios-shadow-modal);
}
```

#### 3. Empty State Hero (`.empty-state-hero`) — Lines 239–246
```css
/* BEFORE */
.empty-state-hero {
  text-align: center;
  padding: 50px 20px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  margin: 10px 0 30px;
}

/* AFTER (iOS 20px Primary Container) */
.empty-state-hero {
  text-align: center;
  padding: 54px 24px;
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  margin: 10px 0 30px;
  box-shadow: var(--ios-shadow-card);
}
```

#### 4. Onboarding Container (`.onboarding`) — Lines 1046–1051
```css
/* BEFORE */
.onboarding {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 24px;
}

/* AFTER (iOS 20px Primary Container) */
.onboarding {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 28px;
  box-shadow: var(--ios-shadow-card);
}
```

#### 5. Algorithm Run Card (`.run`) — Lines 737–742
```css
/* BEFORE */
.run {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}

/* AFTER (iOS 20px Algorithm Card) */
.run {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 18px 20px;
  box-shadow: var(--ios-shadow-card);
}
```

#### 6. Search Book Card (`.book-search-card`) — Lines 447–462
```css
/* BEFORE */
.book-search-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  gap: 14px;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s, border-color .15s;
}
.book-search-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

/* AFTER (iOS 20px Interactive Card) */
.book-search-card {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 16px;
  display: flex;
  gap: 16px;
  cursor: pointer;
  box-shadow: var(--ios-shadow-card);
  transition: var(--ios-transition-smooth);
}
.book-search-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ios-shadow-card-hover);
  border-color: rgba(232, 93, 59, 0.4);
}
```

#### 7. Rating Overview & Review Cards — Lines 2068–2077, 2163–2168, 2283–2288
```css
/* AFTER (iOS 20px Cards) */
.rating-overview-card {
  display: flex;
  gap: 28px;
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 20px 26px;
  margin: 12px 0 24px;
  align-items: center;
  box-shadow: var(--ios-shadow-card);
}

.user-review-card {
  background: var(--ios-surface-secondary);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 18px;
  box-shadow: var(--ios-shadow-xs);
}

.review-item-card {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius); /* 20px */
  padding: 18px;
  box-shadow: var(--ios-shadow-card);
}

.write-review-prompt-card {
  background: #fff8f5;
  border: 1.5px dashed var(--ios-accent);
  border-radius: var(--ios-radius); /* 20px */
  padding: 18px 20px;
  text-align: center;
}
```

#### 8. Modals (`.modal-container`) — Lines 1714–1738
```css
/* AFTER (iOS Glass Backdrop & 20px Modal Surface) */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--ios-modal-backdrop);
  backdrop-filter: var(--ios-glass-blur);
  -webkit-backdrop-filter: var(--ios-glass-blur);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeInModal 0.2s ease-out;
}

.modal-container {
  background: var(--ios-card);
  border-radius: var(--ios-radius); /* 20px */
  box-shadow: var(--ios-shadow-modal);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: var(--ios-border);
  position: relative;
  animation: scaleUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 5. CSS Specifications for New Milestone 4 Components

### 5.1 Top Navigation & iOS Controls Bar
In `client/src/App.jsx`, the header will feature the algorithm customizer toggle and Dev Mode switch.

```css
/* ==========================================================================
   Milestone 4: Top Navigation & iOS Action Controls
   ========================================================================== */
.top-controls-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* iOS Pill Button for Customize Algorithm Toggle */
.btn-algo-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid var(--line);
  color: var(--ios-ink);
  padding: 8px 16px;
  border-radius: var(--ios-radius-pill);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--ios-shadow-xs);
  transition: var(--ios-transition-fast);
}

.btn-algo-toggle:hover {
  background: #f7f7fa;
  border-color: rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.btn-algo-toggle.active {
  background: var(--ios-accent);
  color: #ffffff;
  border-color: var(--ios-accent);
  box-shadow: 0 2px 8px rgba(232, 93, 59, 0.25);
}

/* iOS Native-Style Toggle Switch for Dev Mode */
.ios-switch-container {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ios-ink);
}

.ios-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
}

.ios-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.ios-switch-track {
  position: absolute;
  inset: 0;
  background-color: var(--ios-surface-tertiary);
  border-radius: var(--ios-radius-pill);
  transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.ios-switch input:checked + .ios-switch-track {
  background-color: var(--ios-blue);
}

.ios-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  background-color: #ffffff;
  border-radius: 50%;
  box-shadow: var(--ios-shadow-thumb);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.ios-switch input:checked + .ios-switch-track .ios-switch-thumb {
  transform: translateX(20px);
}
```

### 5.2 Algorithm Customizer Panel (`.algo-customizer-panel`)
Styled with 20px corners, iOS card aesthetics, and prominent title similarity exclusion indicator:

```css
/* ==========================================================================
   Milestone 4: Algorithm Customizer Panel (iOS 20px Container)
   ========================================================================== */
.algo-customizer-panel {
  background: var(--ios-card);
  border: var(--ios-border);
  border-radius: var(--ios-radius) !important; /* 20px */
  padding: 24px 28px;
  margin-bottom: 24px;
  box-shadow: var(--ios-shadow-card);
  animation: slideDownCustomizer 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDownCustomizer {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.algo-customizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: var(--ios-separator);
}

.algo-customizer-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ios-ink);
}

/* Permanent Title Similarity Exclusion Banner */
.title-exclusion-notice {
  background: #fff9e6;
  border: 1px solid #ffe58f;
  border-radius: var(--ios-radius-inner);
  padding: 10px 16px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: #7a5c00;
}

.title-exclusion-badge {
  background: #faad14;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.72rem;
  padding: 3px 8px;
  border-radius: var(--ios-radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Preset Buttons Pill Bar */
.algo-presets-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.algo-preset-btn {
  background: var(--ios-surface-secondary);
  border: 1px solid var(--line);
  color: var(--ios-ink);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: var(--ios-radius-pill);
  cursor: pointer;
  transition: var(--ios-transition-fast);
}

.algo-preset-btn:hover {
  background: #ffffff;
  border-color: var(--ios-accent);
  color: var(--ios-accent);
}

.algo-preset-btn.active {
  background: var(--ios-ink);
  color: #ffffff;
  border-color: var(--ios-ink);
}

/* iOS Slider Inputs */
.weight-slider-row {
  display: grid;
  grid-template-columns: 120px 1fr 60px;
  align-items: center;
  gap: 16px;
  margin: 12px 0;
  font-size: 0.9rem;
}

.weight-slider-label {
  font-weight: 600;
  color: var(--ios-ink);
}

.weight-slider-track {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--ios-surface-tertiary);
  border-radius: var(--ios-radius-pill);
  outline: none;
}

.weight-slider-track::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: var(--ios-shadow-thumb);
  border: 0.5px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.weight-slider-track::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.weight-slider-val {
  text-align: right;
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 600;
  color: var(--ios-ink);
}
```

### 5.3 Dev Diagnostics HUD (`.dev-hud`)
Visible only when Dev Mode is ON; provides real-time telemetry and sentiment diagnostics:

```css
/* ==========================================================================
   Milestone 4: Dev Diagnostics HUD (iOS 20px Container)
   ========================================================================== */
.dev-hud {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: var(--ios-glass-blur);
  -webkit-backdrop-filter: var(--ios-glass-blur);
  border: 1px solid rgba(0, 122, 255, 0.25);
  border-radius: var(--ios-radius) !important; /* 20px */
  padding: 22px 26px;
  margin-bottom: 24px;
  box-shadow: 0 8px 30px rgba(0, 122, 255, 0.08), var(--ios-shadow-card);
  animation: slideDownDevHud 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDownDevHud {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

.dev-hud-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 122, 255, 0.15);
}

.dev-hud-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--ios-ink);
}

.dev-mode-active-pill {
  background: var(--ios-blue);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 9px;
  border-radius: var(--ios-radius-pill);
}

.dev-hud-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.dev-hud-card {
  background: var(--ios-surface-secondary);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--ios-radius-inner);
  padding: 16px;
}

.dev-hud-card h4 {
  margin: 0 0 10px;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ios-muted);
}

.dev-metric-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.dev-metric-row:last-child {
  border-bottom: none;
}

.dev-metric-label {
  color: var(--ios-muted);
}

.dev-metric-value {
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 600;
  color: var(--ios-ink);
}

/* Diagnostic Badges on Cards (Visible only in Dev Mode) */
.dev-card-badge {
  background: #f0f6ff;
  border: 1px solid #c8ddfd;
  color: var(--ios-blue);
  font-size: 0.72rem;
  font-family: ui-monospace, Menlo, monospace;
  padding: 3px 8px;
  border-radius: var(--ios-radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
```

---

## 6. Caveats

1. **Card Overflow & Dropdown Clipping**:
   - Several cards (e.g. `.shelf-book-card`, `.card.seed`) contain interactive dropdown menus (`.reading-status-menu`).
   - If `overflow: hidden` is added to `.card` or `.shelf-book-card`, the absolute-positioned status dropdown menu will be clipped.
   - **Resolution**: Do NOT apply `overflow: hidden` to card containers. Only apply `overflow: hidden` to image containers (`.card-cover-wrap`) or progress bar tracks (`.bar`, `.hist-bar-track`).
2. **Scroll Lock on Modals**:
   - `ReviewModal.jsx` and `BookDetailModal.jsx` already properly lock body scroll (`document.body.style.overflow = 'hidden'`) and release it on unmount. The 20px modal container with `max-height: 90vh` and `overflow-y: auto` accommodates all viewport sizes without clipping.
3. **WebKit Backdrop Filter Prefix**:
   - For Safari and iOS WebKit compatibility, always include `-webkit-backdrop-filter: var(--ios-glass-blur)` alongside standard `backdrop-filter`.
4. **Standard Goodreads Mode Cleanliness**:
   - When Dev Mode is OFF, `.dev-hud` and `.dev-card-badge` must be unmounted or hidden (`display: none;`), ensuring that regular users experience only the clean, elegant Goodreads browsing UI.

---

## 7. Conclusion

1. **Centralized CSS Enables Clean Turnkey Patching**:
   - All client styling is cleanly centralized in `client/src/styles.css`. Updating the `:root` tokens and targeting the 16 non-compliant card/container selectors fulfills R4 completely.
2. **20px Border Radius Normalization**:
   - Enforcing `border-radius: var(--ios-radius, 20px) !important;` on cards, modals, and primary containers standardizes Bookable to the required iOS design language.
3. **No Test Regressions**:
   - The standalone automated E2E test suite in `tests/` tests HTTP API payloads and has zero dependencies on DOM CSS classes. The production client build (`npm run build`) is fully preserved.
4. **Immediate Next Step for M4.2 Worker**:
   - Apply the `:root` design tokens and updated rules into `client/src/styles.css`, integrate `AlgorithmCustomizer.jsx` and `DevDiagnosticsHUD.jsx` with the defined CSS classes, and verify computed styles in the browser.

---

## 8. Verification Method

### 8.1 Automated Commands
```bash
# 1. Verify Client Production Build
npm --prefix client run build
# Expected: Built in < 1s with 0 errors, outputting assets to dist/

# 2. Verify Syntax of Stylesheet
node -e '
const fs = require("fs");
const css = fs.readFileSync("client/src/styles.css", "utf8");
console.log("CSS file size:", (css.length / 1024).toFixed(1), "KB");
assert(css.includes("--ios-radius: 20px"), "Missing --ios-radius token");
'
```

### 8.2 Computed Style Verification Checklist (DevTools / Headless DOM)
Inspect elements to assert that `window.getComputedStyle(element).borderRadius === '20px'`:
- [ ] `.card` computed `borderRadius === '20px'`
- [ ] `.auth-card` computed `borderRadius === '20px'`
- [ ] `.empty-state-hero` computed `borderRadius === '20px'`
- [ ] `.onboarding` computed `borderRadius === '20px'`
- [ ] `.book-search-card` computed `borderRadius === '20px'`
- [ ] `.shelf-book-card` computed `borderRadius === '20px'`
- [ ] `.settings-card` computed `borderRadius === '20px'`
- [ ] `.modal-container` computed `borderRadius === '20px'`
- [ ] `.algo-customizer-panel` computed `borderRadius === '20px'`
- [ ] `.dev-hud` computed `borderRadius === '20px'`

### 8.3 Invalidation Conditions
- Any card, modal, or primary container computing to a border-radius other than 20px.
- Reading status dropdown menu being clipped by parent card overflow.
- Client build failing or throwing CSS parsing errors during `npm run build`.
