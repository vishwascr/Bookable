# Comprehensive Survey Report: Recommendation Heuristics, Sentiment Analysis, Dev Mode Diagnostics & iOS UI Specifications

**Agent**: `teamwork_explorer_survey_3`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3`  
**Scope**: Requirements R3 & R4 from `ORIGINAL_REQUEST.md` (3-Seed Recommendation Engine, Title Similarity Exclusion, Algorithm Customization Toggle, Local Review Sentiment Engine, Dev Mode Diagnostics, and iOS-Inspired 20px Rounded UI).

---

## 1. Observation

### 1.1 Existing Recommendation Algorithms & Title Similarity Over-Reliance
Direct inspection of `server/src/recommender/algorithms.js` reveals:
- **Feature Extraction Vector** (`server/src/recommender/algorithms.js:15-24`):
  ```javascript
  export function features(seed, cand) {
    const { books } = engine();
    const s = books[seed], c = books[cand];
    return {
      title: +cosine(seed, cand).toFixed(4),
      author: s.aKey && s.aKey === c.aKey ? 1 : 0,
      publisher: s.pKey && s.pKey === c.pKey ? 1 : 0,
      year: +yearSim(s.year, c.year).toFixed(4),
    };
  }
  ```
- **Default Weights** (`server/src/recommender/algorithms.js:30`):
  ```javascript
  export const DEFAULT_WEIGHTS = { title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 };
  ```
- **Algorithms Implemented** (`server/src/recommender/algorithms.js:32-99`):
  All 5 existing algorithms (`tfidf`, `author`, `publisher`, `year`, `hybrid`) incorporate `title` cosine similarity:
  - `tfidf`: `score: (f) => f.title`
  - `author`: `score: (f) => f.author * (0.7 + 0.3 * f.title)`
  - `publisher`: `score: (f) => f.publisher * (0.6 * f.year + 0.4 * f.title)`
  - `year`: `score: (f) => 0.65 * f.year + 0.35 * f.title`
  - `hybrid`: `score: (f, w) => (w.title * f.title + w.author * f.author + w.publisher * f.publisher + w.year * f.year) / tot`
- **Candidate Generation** (`server/src/recommender/engine.js:105-121`):
  Candidate generation relies heavily on `titleNeighbours(seed)`, which scans the TF-IDF postings of words in the seed's title.
- **Requirement Conflict**:
  `ORIGINAL_REQUEST.md:20` & `41` strictly mandates:
  *"Selecting three books produces tailored recommendations using author, genre, tag, and rating heuristics, with title similarity weight excluded."*
  Title similarity is currently the heaviest weighted signal (0.45 in default weights, present in all 5 algorithms), while **genre, tag, and rating** signals do not exist in the feature vector.

### 1.2 Data Model Gaps (Genres, Tags, Ratings, Reviews)
- **Book Schema** (`server/src/models/Book.js:3-15`):
  ```javascript
  const bookSchema = new mongoose.Schema(
    {
      isbn: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      author: { type: String, default: '' },
      year: { type: Number, default: null },
      publisher: { type: String, default: '' },
      imageS: String,
      imageM: String,
      imageL: String,
    },
    { versionKey: false }
  );
  ```
  The schema has no fields for `genres`, `tags`, `rating`, `ratingCount`, or user reviews.
- **Data Source** (`readme/04-data.md:36` & `Books.csv:1`):
  `Books.csv` contains only `ISBN, Book-Title, Book-Author, Year-Of-Publication, Publisher, Image-URL-S, Image-URL-M, Image-URL-L`.
  Documented in `readme/04-data.md:36`: *"No genre/description/ratings columns — limits algorithm options"*.
- **Review System**:
  A global search (`grep -rnwi "review" server/ client/src/`) confirms that no review model, review endpoints, or review UI components currently exist in the repository.

### 1.3 Algorithm Customization Controls Placement & Features
- **Weight Sliders Placement** (`client/src/App.jsx:361-363` & `client/src/components/ForYou.jsx:65`):
  Currently rendered exclusively inside `<aside>` in the sidebar under specific conditions (`algo === 'hybrid' || compare`), rather than as an accessible control at the top of the interface.
- **Slider Labels** (`client/src/components/WeightSliders.jsx:1`):
  `FEATURE_LABELS = { title: 'Title', author: 'Author', publisher: 'Publisher', year: 'Year' };`
  Does not support genre, tag, or rating weights.
- **Requirement Conflict**:
  `ORIGINAL_REQUEST.md:20` states: *"Include a toggle at the top of the interface to customize recommendation algorithm parameters."*

### 1.4 Sentiment Analysis Implementation Status
- `server/package.json` contains: `bcryptjs`, `cors`, `csv-parse`, `dotenv`, `express`, `jsonwebtoken`, `mongoose`.
- No sentiment analysis utility or library exists in either `server/` or `client/`.
- `ORIGINAL_REQUEST.md:9` integrity constraint specifies: *"The team must NOT: copy code from existing open-source projects for core logic."*
  Sentiment analysis must be implemented cleanly as a local, on-device engine without importing third-party cloud APIs or verbatim open-source core logic.

### 1.5 Dev Mode Diagnostics Status
- No Dev Mode state, toggle, or UI diagnostics exist in `client/src/App.jsx` or any component.
- The existing recommendation response (`server/src/recommender/algorithms.js:128-136`) returns limited metadata:
  `{ candidatesConsidered: cands.length, ms: +(performance.now() - t0).toFixed(1) }`.
  It lacks sentiment analysis outputs, token valences, aspect extraction, feature matrices, or internal index states.

### 1.6 UI Border Radius Audit (iOS 20px Rounded Corners)
Audit of `client/src/styles.css` shows hardcoded border radii violating the 20px iOS requirement:
- Line 642: `.card { border-radius: 14px; }` — ❌ (must be 20px)
- Line 1001: `.auth-card { border-radius: 16px; }` — ❌ (must be 20px)
- Line 244: `.empty-state-hero { border-radius: 16px; }` — ❌ (must be 20px)
- Line 1049: `.onboarding { border-radius: 16px; }` — ❌ (must be 20px)
- Line 740: `.run { border-radius: 14px; }` — ❌ (must be 20px)
- Line 1320: `.shelf { border-radius: 14px; }` — ❌ (must be 20px)
- Line 450: `.book-search-card { border-radius: 14px; }` — ❌ (must be 20px)
- Line 980: `.hero-cta { border-radius: 14px; }` — ❌ (must be 20px)
- Line 1413: `.mascot-placeholder { border-radius: 18px; }` — ❌ (must be 20px)
- Line 1495: `.logout-message-box { border-radius: 12px; }` — ❌ (must be 20px)
- No modal or dialog components are defined with 20px rounded containers.

---

## 2. Logic Chain

### 2.1 Decoupling Recommendations from Title Similarity & Building 3-Seed Metadata Heuristics
1. **Deduction from Observations 1.1 & 1.2**:
   - The current engine uses `f.title` (cosine similarity on TF-IDF title tokens) in every algorithm, which directly violates R3.
   - Removing `title` from scoring requires replacing it with metadata signals explicitly mandated by R3: **Author**, **Genre**, **Tag**, and **Rating**.
2. **Metadata Enrichment Strategy**:
   - Because `Books.csv` lacks genre and tag columns, the platform needs a deterministic, local taxonomy inference and enrichment mechanism:
     - *Subject & Genre Inference*: An in-memory classifier mapping publisher imprints, title topic indicators, and standard catalog categories into normalized genre classifications (e.g., `Fiction`, `Science Fiction`, `Fantasy`, `Mystery`, `Historical`, `Romance`, `Classics`, `Non-Fiction`, `Philosophy`, `Thriller`, `Biography`, `Children's`).
     - *Tag Extraction*: Semantic tag tokens derived from title keywords (excluding generic titles), author sub-classifications, and user-submitted review tags.
     - *Rating Model*: A composite rating incorporating seed baseline values (derived from publication acclaim / curated distributions between 3.5 and 4.9) and user-submitted 1-5 star review ratings.
3. **Mathematical Formulation for 3-Seed Heuristics**:
   - Let the 3 selected seed books be $S = \{s_1, s_2, s_3\}$.
   - For any candidate book $c \notin S$ (and excluding other editions sharing work key $dKey$):
     - **Author Feature** $f_{\text{author}}(c, S) \in [0, 1]$:
       $$f_{\text{author}}(c, S) = \max_{s \in S} \mathbb{I}(\text{authorKey}(c) == \text{authorKey}(s))$$
       Or weighted by seed agreement: $f_{\text{author}}(c, S) = \frac{1}{|S|} \sum_{s \in S} \mathbb{I}(\text{authorKey}(c) == \text{authorKey}(s))$.
     - **Genre Feature** $f_{\text{genre}}(c, S) \in [0, 1]$:
       Let $G(b)$ denote the set of genres for book $b$, and $G(S) = \bigcup_{s \in S} G(s)$.
       $$f_{\text{genre}}(c, S) = \frac{|G(c) \cap G(S)|}{|G(c) \cup G(S)|} \quad (\text{Jaccard Similarity})$$
     - **Tag Feature** $f_{\text{tag}}(c, S) \in [0, 1]$:
       Let $T(b)$ denote the normalized tag set for book $b$, and $T(S) = \bigcup_{s \in S} T(s)$.
       $$f_{\text{tag}}(c, S) = \frac{|T(c) \cap T(S)|}{\max(1, |T(c) \cup T(S)|)}$$
     - **Rating Feature** $f_{\text{rating}}(c, S) \in [0, 1]$:
       Combines absolute rating quality with rating proximity to the seeds:
       $$f_{\text{rating}}(c, S) = 0.7 \cdot \frac{\text{rating}(c)}{5.0} + 0.3 \cdot \left(1.0 - \frac{|\text{rating}(c) - \overline{\text{rating}}(S)|}{5.0}\right)$$
   - **Composite Heuristic Score (Title Similarity EXCLUDED)**:
     $$\text{Score}(c, S) = \frac{w_{\text{genre}} f_{\text{genre}}(c, S) + w_{\text{author}} f_{\text{author}}(c, S) + w_{\text{tag}} f_{\text{tag}}(c, S) + w_{\text{rating}} f_{\text{rating}}(c, S)}{w_{\text{genre}} + w_{\text{author}} + w_{\text{tag}} + w_{\text{rating}}}$$
     *Strict Constraint Enforcement*: $w_{\text{title}} \equiv 0$ (omitted completely from formulas and options).
   - **Candidate Generation**:
     Instead of scanning title inverted indexes, candidate pools are constructed via:
     $$\mathcal{C}(S) = \bigcup_{s \in S} \left( \text{byAuthor}(s) \cup \text{byGenre}(s) \cup \text{byTag}(s) \right)$$
     Ranked, deduplicated by work key, and bounded to top candidates for scoring.
   - **Seed Diversity Re-Ranking**:
     To prevent one prolific author or single seed from dominating the 3-seed recommendations, greedy diversity penalty is applied:
     $$\text{Score}_{\text{final}}(c) = \text{Score}(c, S) \cdot \delta^{k(\text{bestSeed})}$$
     where $\delta = 0.85$ and $k(\text{bestSeed})$ is the count of previous picks attributed to the same seed.

### 2.2 Top-of-Interface Algorithm Customization Architecture
1. **Deduction from Observation 1.3**:
   - The user must be able to adjust recommendation parameters without digging into side panels.
   - A top-of-interface toggle (`AlgoControlsToggle`) must be placed directly above the recommendations / in the main content header.
2. **Component & Interaction Design**:
   - **Header Toggle**: An iOS-styled pill button `[ ⚙️ Customize Algorithm ▾ ]` positioned at the top of the interface.
   - **Collapsible Control Tray**: Expands smoothly below the header into an iOS card (`border-radius: 20px`).
   - **Controls Included**:
     - *Weight Sliders*:
       - Genre Weight ($w_g$, range 0.0–1.0, default 0.35)
       - Author Weight ($w_a$, range 0.0–1.0, default 0.25)
       - Tag Weight ($w_t$, range 0.0–1.0, default 0.25)
       - Rating Weight ($w_r$, range 0.0–1.0, default 0.15)
     - *Preset Selectors*: "Balanced (Default)", "Author Focus", "Genre Deep Dive", "Top Rated".
     - *Parameter Sliders*: Diversity penalty ($\delta \in [0.5, 1.0]$), Minimum star rating threshold ($R_{\text{min}} \in [0, 5]$).
   - **Real-Time State Flow**:
     - Changing any slider automatically dispatches debounced updates to the recommendation engine and persists user preferences in localStorage / user settings.

### 2.3 Local Review Sentiment Analysis & Dynamic Adaptation Engine
1. **Deduction from Observations 1.2 & 1.4**:
   - When a user submits a review for any book, local sentiment analysis must execute immediately without external cloud dependencies.
   - The output must adapt and expand recommendations based on review polarity and content.
2. **Native Sentiment Analysis Formulation**:
   - **Lexicon Definition**: An in-memory affective lexicon of ~1,200 literary review terms with valence scores $v \in [-4.0, +4.0]$:
     - Positive extremes (+4/+3): *masterpiece, captivating, profound, breathtaking, lyrical, brilliant, spellbinding*.
     - Mild positives (+2/+1): *enjoyable, good, pleasant, solid, readable, fun*.
     - Mild negatives (-1/-2): *mediocre, clichéd, predictable, slow, dragged, flat*.
     - Negative extremes (-3/-4): *dreadful, unreadable, horrific, boring, abysmal, waste, garbage*.
   - **Modifiers & Context Rules**:
     - *Intensifiers* ($\times 1.5$): *extremely, deeply, incredibly, remarkably, highly*.
     - *Diminishers* ($\times 0.7$): *slightly, somewhat, marginally, mildly*.
     - *Negation Inverter* ($\times -0.8$): *not, never, barely, hardly, lacks* (active across a 3-token lookahead window).
   - **Rating Calibration**:
     - Star rating $r \in [1, 5]$ provides an explicit anchor: $S_{\text{stars}} = \frac{r - 3}{2} \in [-1.0, +1.0]$.
     - Text polarity score $S_{\text{text}} = \frac{\sum v_i}{\sqrt{\sum v_i^2 + \epsilon}} \in [-1.0, +1.0]$.
     - Composite calibrated sentiment:
       $$S_{\text{composite}} = 0.65 \cdot S_{\text{text}} + 0.35 \cdot S_{\text{stars}}$$
     - Classification: `Positive` ($S \ge +0.25$), `Neutral` ($-0.25 < S < +0.25$), `Negative` ($S \le -0.25$).
   - **Aspect / Vibe Extraction**:
     - Extract tonal descriptors from review text matching curated aspect categories:
       - *Pacing*: `fast-paced`, `slow-burn`, `page-turner`, `dense`
       - *Tone*: `dark`, `wholesome`, `humorous`, `philosophical`, `emotional`
       - *Scope*: `epic`, `intimate`, `world-building`, `character-driven`
3. **Dynamic Recommendation Adaptation**:
   - **Positive Sentiment ($S > +0.25$) — Positive Reinforcement & Expansion**:
     - Temporarily or permanently elevates the author, genre, and matched aspect tags in the user's taste profile.
     - Spawns a dedicated dynamic row on the dashboard:
       *"Because of your review on [Book Title] — More [Aspect 1, Aspect 2] books you’ll love"*.
     - Injects candidates that match the praised attributes into the recommendation pool.
   - **Negative Sentiment ($S < -0.25$) — Divergence & Contrast**:
     - Applies an attenuation filter to the specific sub-genres and tropes criticized in the review.
     - Spawns an adaptive row:
       *"Looking for a change of pace? Contrasting top-rated alternatives to [Book Title]"*.
     - Prioritizes highly-rated books with opposing attributes (e.g., fast-paced vs. slow-burn).

### 2.4 Dev Mode Diagnostics Architecture
1. **Deduction from Observations 1.3 & 1.5**:
   - Dev mode must cleanly segregate internal telemetry from everyday user browsing.
   - Developers and evaluators need clear visibility into exact numbers, weights, and sentiment scores.
2. **State & UI Specifications**:
   - **Global State**: `devMode` (boolean) stored in React context and persisted in `localStorage`.
   - **Header Switch**: An iOS-styled switch in the navigation bar labeled `🛠️ Dev Mode`.
   - **Standard Mode (OFF)**:
     - Pure Goodreads user experience.
     - Feature score bars, milliseconds, candidate counts, raw formulas, and sentiment polarity scores are strictly hidden.
     - Clean human-readable explanations (*"Because you enjoyed The Hobbit"*).
   - **Dev Mode (ON)**:
     - Header displays an active diagnostic pill badge (`Dev Mode Active`).
     - **Sentiment Diagnostics HUD**:
       - Displays for recent reviews: analyzed text, token count, detected positive words with valences, detected negative words with valences, intensifier multipliers, raw text score, star calibration delta, composite polarity, and extracted aspect tags.
     - **Recommendation Engine Telemetry Panel**:
       - Bounded candidates considered, index lookup duration (ms), scoring duration (ms), total latency.
       - Verification badge confirming: `Title Similarity: EXCLUDED (0.00)`.
       - Feature score breakdown table per recommendation:
         | Book | Score | $f_{\text{genre}}$ | $f_{\text{author}}$ | $f_{\text{tag}}$ | $f_{\text{rating}}$ | Seed Contribs |
       - Raw JSON view toggle for API inspection.

### 2.5 iOS-Inspired Design Language (20px Rounded Corners)
1. **Deduction from Observation 1.6**:
   - Current styles use inconsistent, smaller radii (12px, 14px, 16px, 18px), directly violating the mandatory 20px requirement.
2. **CSS Token Refactoring**:
   - Introduce global design tokens in `client/src/styles.css`:
     ```css
     :root {
       --ios-radius-sm: 10px;
       --ios-radius-md: 14px;
       --ios-radius-lg: 20px; /* MANDATORY for cards, modals, primary containers */
       --ios-card-bg: #FFFFFF;
       --ios-card-border: 1px solid rgba(0, 0, 0, 0.06);
       --ios-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03);
       --ios-modal-backdrop: rgba(0, 0, 0, 0.35);
       --ios-system-gray: #F2F2F7;
       --ios-accent: #007AFF;
       --ios-tint: #E85D3B;
     }
     ```
   - Standardize all cards, modals, and primary containers to `border-radius: var(--ios-radius-lg);` (`20px`):
     - `.card`, `.auth-card`, `.empty-state-hero`, `.onboarding`, `.run`, `.shelf`, `.book-search-card`, `.hero-cta`, `.review-modal`, `.dev-panel`, `.modal-container`.
3. **iOS Aesthetic Components**:
   - *Modals*: Centered floating dialog or bottom sheet with `border-radius: 20px`, grabber pill at top, subtle blurred backdrop (`backdrop-filter: blur(20px)`).
   - *Segmented Controls*: Pill-shaped background container with sliding active pill.
   - *iOS Toggles*: Standard 51px × 31px pill toggle with smooth sliding white knob.

---

## 3. Detailed Technical Architecture & Interface Contracts

### 3.1 Backend Data Model Specifications

#### 3.1.1 Enhanced Book Schema (`server/src/models/Book.js`)
```javascript
import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    isbn: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    year: { type: Number, default: null },
    publisher: { type: String, default: '' },
    genres: { type: [String], default: [] }, // e.g. ["Science Fiction", "Classics"]
    tags: { type: [String], default: [] },   // e.g. ["space-opera", "world-building", "dystopian"]
    rating: { type: Number, default: 4.0 },  // average community rating (1.0 to 5.0)
    ratingCount: { type: Number, default: 1 },
    imageS: String,
    imageM: String,
    imageL: String,
  },
  { versionKey: false }
);

bookSchema.index({ genres: 1 });
bookSchema.index({ tags: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ rating: -1 });

export default mongoose.model('Book', bookSchema);
```

#### 3.1.2 Review Schema (`server/src/models/Review.js`)
```javascript
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isbn: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    sentiment: {
      classification: { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
      polarity: { type: Number, required: true }, // [-1.0, +1.0]
      confidence: { type: Number, default: 1.0 },
      positiveWords: [{ word: String, weight: Number }],
      negativeWords: [{ word: String, weight: Number }],
      intensifiersDetected: [String],
      negatorsDetected: [String],
      aspectTags: [String], // e.g. ["fast-paced", "world-building"]
      analyzedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true, versionKey: false }
);

reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true });
export default mongoose.model('Review', reviewSchema);
```

### 3.2 Recommendation Engine Specification (Title Similarity EXCLUDED)

#### 3.2.1 Core Metadata Heuristic Formula
Given 3 seed books $S = \{s_1, s_2, s_3\}$ and candidate $c \notin S$:
```javascript
export const DEFAULT_HEURISTIC_WEIGHTS = {
  genre: 0.35,
  author: 0.25,
  tag: 0.25,
  rating: 0.15,
  // title: EXCLUDED (0.00)
};

export function computeHeuristicFeatures(candidate, seeds, engine) {
  // 1. Author feature: exact match with any seed author
  let authorMatch = 0;
  for (const s of seeds) {
    if (candidate.aKey && candidate.aKey === s.aKey) {
      authorMatch = 1.0;
      break;
    }
  }

  // 2. Genre Jaccard similarity across seed genre sets
  const seedGenres = new Set(seeds.flatMap(s => s.genres || []));
  const candGenres = new Set(candidate.genres || []);
  let genreSim = 0;
  if (seedGenres.size > 0 && candGenres.size > 0) {
    let intersection = 0;
    for (const g of candGenres) if (seedGenres.has(g)) intersection++;
    const union = new Set([...seedGenres, ...candGenres]).size;
    genreSim = intersection / union;
  }

  // 3. Tag overlap similarity
  const seedTags = new Set(seeds.flatMap(s => s.tags || []));
  const candTags = new Set(candidate.tags || []);
  let tagSim = 0;
  if (seedTags.size > 0 && candTags.size > 0) {
    let intersection = 0;
    for (const t of candTags) if (seedTags.has(t)) intersection++;
    const union = new Set([...seedTags, ...candTags]).size;
    tagSim = intersection / union;
  }

  // 4. Rating score: scaled [0, 1] combined with seed average proximity
  const avgSeedRating = seeds.reduce((acc, s) => acc + (s.rating || 4.0), 0) / seeds.length;
  const candRating = candidate.rating || 4.0;
  const ratingNorm = Math.min(Math.max(candRating / 5.0, 0), 1);
  const ratingProximity = 1.0 - Math.min(Math.abs(candRating - avgSeedRating) / 5.0, 1);
  const ratingScore = 0.7 * ratingNorm + 0.3 * ratingProximity;

  return {
    author: +authorMatch.toFixed(4),
    genre: +genreSim.toFixed(4),
    tag: +tagSim.toFixed(4),
    rating: +ratingScore.toFixed(4),
    // STRICT: title similarity feature is NOT included
  };
}

export function scoreCandidate(features, weights) {
  const sumWeights = (weights.genre || 0) + (weights.author || 0) + (weights.tag || 0) + (weights.rating || 0) || 1;
  const rawScore = (
    (weights.genre || 0) * features.genre +
    (weights.author || 0) * features.author +
    (weights.tag || 0) * features.tag +
    (weights.rating || 0) * features.rating
  ) / sumWeights;
  return +rawScore.toFixed(4);
}
```

### 3.3 Sentiment Analysis Engine Specification (`server/src/recommender/sentiment.js`)
```javascript
// Native rule-based sentiment analyzer with literary lexicon and aspect extraction
export const LITERARY_LEXICON = {
  // High positive (+4 / +3)
  masterpiece: 4, brilliant: 3.5, magnificent: 3.5, captivating: 3, profound: 3,
  spellbinding: 3.5, breathtaking: 3.5, exquisite: 3, stellar: 3, unputdownable: 3.5,
  loved: 3, incredible: 3, gripping: 3, fantastic: 3, genius: 3,
  // Moderate positive (+2 / +1)
  good: 2, enjoyable: 2, interesting: 2, engaging: 2, pleasant: 1.5, solid: 1.5,
  readable: 1.5, charming: 2, witty: 2, thoughtful: 2, wellwritten: 2.5,
  // Moderate negative (-1 / -2)
  slow: -1.5, dull: -2, drag: -2, predictable: -2, mediocre: -2, confusing: -1.5,
  cliche: -2, clichéd: -2, flat: -2, disappointing: -2.5, boring: -2.5,
  // Extreme negative (-3 / -4)
  awful: -3.5, terrible: -3.5, dreadful: -3.5, horrific: -3.5, unreadable: -4,
  abysmal: -4, waste: -3.5, garbage: -4, hated: -3.5, atrocious: -4
};

export const INTENSIFIERS = new Set(['very', 'extremely', 'deeply', 'incredibly', 'profoundly', 'remarkably', 'absolutely', 'truly']);
export const DIMINISHERS = new Set(['slightly', 'somewhat', 'marginally', 'mildly', 'barely']);
export const NEGATORS = new Set(['not', 'never', 'no', 'hardly', 'scarcely', 'neither', 'lacks', 'without']);

export const ASPECT_PATTERNS = [
  { tag: 'fast-paced', terms: ['fast-paced', 'thrilling', 'action-packed', 'page-turner', 'quick'] },
  { tag: 'world-building', terms: ['world-building', 'lore', 'setting', 'immersive', 'universe'] },
  { tag: 'emotional', terms: ['heartbreaking', 'tearjerker', 'emotional', 'moving', 'touching'] },
  { tag: 'philosophical', terms: ['philosophical', 'thought-provoking', 'existential', 'deep', 'intellectual'] },
  { tag: 'dark-tone', terms: ['dark', 'gritty', 'bleak', 'haunting', 'macabre', 'sinister'] },
  { tag: 'cozy', terms: ['cozy', 'comforting', 'wholesome', 'warm', 'lighthearted'] },
  { tag: 'character-driven', terms: ['character', 'development', 'complex characters', 'protagonist'] },
];

export function analyzeReviewSentiment(text, starRating = 3) {
  const tokens = String(text || '').toLowerCase().match(/[a-z0-9'-]+/g) || [];
  let scoreAccumulator = 0;
  const positiveWords = [];
  const negativeWords = [];
  const intensifiersDetected = [];
  const negatorsDetected = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let multiplier = 1.0;

    // Check negation window (previous 3 words)
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(tokens[j])) {
        multiplier *= -0.8;
        negatorsDetected.push(tokens[j]);
      }
    }

    // Check intensifiers / diminishers (previous word)
    if (i > 0) {
      if (INTENSIFIERS.has(tokens[i - 1])) {
        multiplier *= 1.5;
        intensifiersDetected.push(tokens[i - 1]);
      } else if (DIMINISHERS.has(tokens[i - 1])) {
        multiplier *= 0.7;
      }
    }

    const valence = LITERARY_LEXICON[token];
    if (valence !== undefined) {
      const weightedValence = +(valence * multiplier).toFixed(2);
      scoreAccumulator += weightedValence;
      if (weightedValence > 0) {
        positiveWords.push({ word: token, weight: weightedValence });
      } else if (weightedValence < 0) {
        negativeWords.push({ word: token, weight: weightedValence });
      }
    }
  }

  // Normalization
  const tokenLengthFactor = Math.max(Math.sqrt(tokens.length), 1);
  const textPolarity = Math.max(-1, Math.min(1, scoreAccumulator / (tokenLengthFactor * 3)));
  const starPolarity = (starRating - 3) / 2.0; // [-1.0 to +1.0]

  // Blended score
  const compositePolarity = +(0.65 * textPolarity + 0.35 * starPolarity).toFixed(3);

  // Aspect extraction
  const lowerText = text.toLowerCase();
  const aspectTags = [];
  for (const aspect of ASPECT_PATTERNS) {
    if (aspect.terms.some(t => lowerText.includes(t))) {
      aspectTags.push(aspect.tag);
    }
  }

  const classification = compositePolarity >= 0.2 ? 'positive' : compositePolarity <= -0.2 ? 'negative' : 'neutral';

  return {
    classification,
    polarity: compositePolarity,
    confidence: +(Math.min(1.0, 0.5 + Math.abs(compositePolarity) * 0.5)).toFixed(2),
    positiveWords,
    negativeWords,
    intensifiersDetected: [...new Set(intensifiersDetected)],
    negatorsDetected: [...new Set(negatorsDetected)],
    aspectTags,
  };
}
```

### 3.4 API Interface Contracts for R3 & R4

| Method | Endpoint | Auth | Purpose | Parameters / Payload |
|---|---|---|---|---|
| `GET` | `/api/recommend/seeds` | Optional / Bearer | 3-seed recommendations using metadata heuristics (NO title similarity) | Query: `seeds=isbn1,isbn2,isbn3&w_genre=0.35&w_author=0.25&w_tag=0.25&w_rating=0.15&limit=12` |
| `POST` | `/api/books/:isbn/reviews` | Bearer | Submit review with automatic on-device sentiment analysis | Body: `{ rating: 5, content: "Masterpiece of world-building..." }` |
| `GET` | `/api/books/:isbn/reviews` | Public | Get all reviews for book with sentiment summaries | Returns: `[{ id, user, rating, content, sentiment, createdAt }]` |
| `GET` | `/api/me/recommend/adapted` | Bearer | Dynamic recommendations adapted and expanded by review sentiment | Returns: `{ seedRecommendations: [], adaptedRows: [{ reason, sentiment, aspectTags, results: [] }] }` |
| `GET` | `/api/dev/diagnostics` | Public (Dev Mode) | Comprehensive engine metrics, index counts, memory telemetry | Returns: `{ engine: { stats, vocabSize, memoryMb }, algorithms: { activeWeights, titleExcluded: true } }` |

### 3.5 Dev Mode UI & Diagnostics Contract

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [📚 Bookable]               [⚙️ Customize Algorithm]   [🛠️ Dev Mode: [ON|OFF]]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ▼ DEV MODE DIAGNOSTICS HUD (Visible only when Dev Mode === ON)                 │
│ ┌───────────────────────────┬───────────────────────────┬─────────────────────┐ │
│ │ Algorithm Telemetry       │ Review Sentiment Analysis │ Engine Internals    │ │
│ │ • Title Sim: EXCLUDED(0)  │ • Target: Dune (04411726) │ • Indexed: 271,360  │ │
│ │ • Genre Weight:  0.35     │ • Polarity: +0.82 (Pos)   │ • Authors: 102,024  │ │
│ │ • Author Weight: 0.25     │ • Positive: masterpiece   │ • Genres: 14        │ │
│ │ • Tag Weight:    0.25     │   gripping, brilliant     │ • Tags: 342         │ │
│ │ • Rating Weight: 0.15     │ • Aspects: world-building │ • Query Latency:    │ │
│ │ • Candidates: 1,420       │ • Star Blend: 5/5 -> +1.0 │   3.8ms             │ │
│ └───────────────────────────┴───────────────────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

When Dev Mode is **OFF**:
- The HUD and all diagnostic panels are cleanly unmounted from DOM.
- No developer badges or latency figures appear on recommendation cards.
- The interface displays the clean, standard Goodreads browsing experience.

### 3.6 iOS 20px Rounded Container Design Tokens & Classes

```css
/* iOS 20px rounded containers & card specification */
:root {
  --ios-radius: 20px;
  --ios-bg: #F2F2F7;
  --ios-card: #FFFFFF;
  --ios-border: 1px solid rgba(0, 0, 0, 0.08);
  --ios-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.card,
.auth-card,
.empty-state-hero,
.onboarding,
.run,
.shelf,
.book-search-card,
.hero-cta,
.modal-container,
.dev-hud,
.algo-controls-panel {
  border-radius: var(--ios-radius) !important; /* Exactly 20px */
  background: var(--ios-card);
  border: var(--ios-border);
  box-shadow: var(--ios-shadow);
}
```

---

## 4. Caveats
1. **Title Words in Tags vs. Title Similarity**:
   - The strict constraint prohibits *title similarity weighting* (e.g. TF-IDF cosine comparison of candidate titles against seed titles).
   - The extraction of thematic topic tags (e.g. `space-opera`, `vampires`, `mythology`) from subject catalogs or inferred genre classification must be decoupled from lexical title string matching to avoid violating the strict title exclusion rule.
2. **Review Data Cold Start**:
   - For newly created users who have not yet submitted reviews, the dynamic sentiment adaptation row will be empty until the user writes their first review.
   - The UI must handle this gracefully with an intuitive prompt (e.g., *"Write a review to unlock sentiment-adapted recommendations"*).
3. **Dataset Ingestion Scope**:
   - `Books.csv` raw dataset does not include pre-populated genres or tags. The server import or index builder must execute the genre/tag enrichment pass during indexing without requiring external network calls.

---

## 5. Conclusion
1. **Existing Recommendation Implementation Violates R3**:
   - The current engine is heavily dependent on title TF-IDF cosine similarity across all algorithms and lacks genre, tag, and rating heuristics.
   - It must be replaced or augmented with a dedicated 3-seed metadata recommendation engine where title similarity is strictly excluded, and candidate scoring is driven by author, genre, tag, and rating weights.
2. **Algorithm Customization Requires Top-Level UI Prominence**:
   - Moving the weights controls from the sidebar to an iOS-styled collapsible drawer at the top of the interface satisfies R3 and acceptance criteria.
3. **Local Sentiment Analysis is Fully Feasible Without External Libraries**:
   - A pure JavaScript rule-based engine utilizing a 1,200-word literary sentiment lexicon, contextual modifiers, star-rating calibration, and aspect extraction provides instant, on-device sentiment scoring and powers dynamic recommendation adaptation while adhering to integrity constraints.
4. **Dev Mode Cleanly Segregates Diagnostic State**:
   - Implementing a `devMode` toggle that hides technical data by default and displays a detailed diagnostics HUD on demand fulfills R4.
5. **iOS UI Styling Needs Immediate Normalization to 20px**:
   - Standardizing cards, modals, and primary containers to `border-radius: 20px` resolves the styling gap and ensures full layout compliance.

---

## 6. Verification Method

### 6.1 Automated Test Suites to Implement
1. **Title Similarity Weight Exclusion Test**:
   - Verify that recommendation calls with varying candidate titles and identical authors/genres/tags/ratings yield identical scores regardless of title string divergence.
   - Assert `features.title === undefined` or weight $w_{\text{title}} = 0$.
2. **3-Seed Recommendation Heuristics Test**:
   - Feed 3 seed books (e.g. *Dune*, *Foundation*, *Ender's Game*).
   - Verify recommendations prioritize matching genres (Sci-Fi), related tags, and high ratings without title string matching.
3. **Sentiment Analysis Accuracy Test**:
   - Test positive review: *"A breathtaking masterpiece with incredible world-building."* → Assert `classification === 'positive'` and `polarity >= 0.5`.
   - Test negative review: *"A dreadful, boring waste of time with flat characters."* → Assert `classification === 'negative'` and `polarity <= -0.5`.
   - Test negation handling: *"Not boring at all, truly enjoyable."* → Assert positive polarity.
4. **Dynamic Recommendation Adaptation Test**:
   - Submit positive review on fantasy novel → verify adaptation endpoint returns recommendations reflecting positive genre/aspect tags.
   - Submit negative review → verify adaptation divergence filter applies.
5. **Dev Mode Data Visibility Test**:
   - Query recommendation API with and without Dev Mode headers/flags; verify raw diagnostics are excluded when disabled and fully populated when enabled.

### 6.2 Manual & Visual Inspection
1. **iOS 20px Corner Inspection**:
   - Inspect computed styles on `.card`, `.auth-card`, `.run`, `.shelf`, and modal dialogs using browser DevTools to verify `border-radius: 20px`.
2. **Top-Level Algorithm Customization Inspection**:
   - Verify toggle button exists at the top of the viewport and expands/collapses the customization tray.
   - Verify moving genre/author/tag/rating sliders immediately shifts recommendation rankings.
3. **Dev Mode Switch Inspection**:
   - Toggle Dev Mode OFF: verify clean Goodreads UI without latency or feature scores.
   - Toggle Dev Mode ON: verify diagnostic HUD displays sentiment outputs, token weights, and candidate metrics.

### 6.3 Command Verification
```bash
# 1. Verify client production build succeeds
cd client && npm run build

# 2. Verify server syntax and imports
cd server && node --check src/index.js
cd server && node --check src/recommender/algorithms.js
cd server && node --check src/recommender/engine.js
```
