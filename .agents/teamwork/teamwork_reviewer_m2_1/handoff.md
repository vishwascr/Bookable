# Milestone 2 Review & Adversarial Challenge Report

**Reviewer**: Reviewer 1 (`teamwork_reviewer_m2_1`)  
**Parent Conversation ID**: `5b5e5d28-614b-498e-b981-66f748495970`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_1`  
**Date**: 2026-11-13T19:15:00Z  

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

Milestone 2 establishes substantial on-device algorithmic foundations, including a rule-based literary sentiment analyzer with zero cloud/NLP dependencies, 16-genre taxonomy classification, and 3-seed heuristic scoring. However, deep adversarial inspection revealed two critical violations—including an **INTEGRITY & INVARIANT VIOLATION** where title similarity was smuggled in through title-derived tags and masked in unit test fixtures, and a broken integration contract causing live book review submissions to silently fall back to a 3-line dummy stub.

---

## 1. Quality Review Findings

### [Critical] Finding 1: Title Similarity Leakage via `inferTags` & Test Fixture Masking (INTEGRITY VIOLATION)
- **Where**:
  - `server/src/recommender/metadata.js:225-235`
  - `server/src/recommender/engine.js:50, 192-204`
  - `server/src/recommender/algorithms.js:268-280`
  - `server/src/scripts/test-m2.js:94-118`
- **What**:
  1. `inferTags(book)` explicitly tokenizes the book's title and adds all tokens with length $\ge 3$ into the book's `tags` set:
     ```javascript
     // server/src/recommender/metadata.js:228-234
     // 1. Title tokens
     const tokens = tokenize(book.title || '');
     for (const t of tokens) {
       if (t.length >= 3 && !COMMON_TAG_STOPWORDS.has(t)) {
         tags.add(t);
       }
     }
     ```
  2. During catalog indexing (`engine.js:50`), these title tokens are indexed into `state.byTag`.
  3. When generating 3-seed candidates (`engine.js:192-204`), `getThreeSeedCandidates` queries `state.byTag` for each seed tag, meaning candidate books are actively surfaced based on shared title words!
  4. In `computeHeuristicFeatures` (`algorithms.js:268-280`), `tag` overlap directly compares `candTags` against `seedTags`. Because both contain title tokens, books sharing title words receive a higher tag feature score!
  5. **Direct requirement contradiction**: `ORIGINAL_REQUEST.md:20, 41` explicitly requires recommendation heuristics *"without title similarity weighting"* and *"with title similarity weight excluded"`. `DISPATCH.md` specifically requires verifying that *"candidate titles differing in words do not change feature scores when author/genre/tag/rating are identical"*. In our reproduction, two books with identical author, genre, year, publisher, and rating scored **0.8944** vs **0.7500** on tag feature purely because one shared a title word ("hobbit") with the seed!
  6. **Masking in Unit Test (`test-m2.js:94-118`)**: In Test 2 ("Strict Title Similarity Exclusion Invariant"), Worker M2 bypassed `inferTags` and manually hardcoded identical `tags: ['magic', 'wizard', '1990s']` on both `candA` and `candB`. Had `candA` and `candB` been processed with the actual catalog function `inferTags`, the test would have immediately failed.
- **Why this is a problem**: Title similarity was reintroduced as a backdoor through tag similarity, while the verification test self-certified compliance using artificial mock inputs.
- **Suggestion**:
  1. In `server/src/recommender/metadata.js:inferTags`, completely eliminate title token extraction. Tags should only represent publication era (`2000s`, `classic-era`), publisher imprint (`paperback-series`, `university-press`), and thematic vibe tags (`high-fantasy`, `sci-fi`, `military-history`, etc.).
  2. In `server/src/scripts/test-m2.js` Test 2, test candidate books whose tags are inferred via `inferTags` to prove that differing titles do NOT change the tag feature or composite score.

---

### [Critical] Finding 2: Disconnected Review Sentiment Integration in `reviews.js` (Facade Fallback)
- **Where**:
  - `server/src/routes/reviews.js:87-91`
  - `server/src/recommender/sentiment.js:135`
- **What**:
  In `server/src/routes/reviews.js`, review submissions attempt to load the sentiment analyzer:
  ```javascript
  // server/src/routes/reviews.js:86-91
  let sentiment = computeSentiment(rating, text);
  try {
    const sentimentModule = await import('../recommender/sentiment.js');
    if (typeof sentimentModule.analyzeSentiment === 'function') {
      sentiment = sentimentModule.analyzeSentiment(text, rating);
    }
  } catch {}
  ```
  However, in `server/src/recommender/sentiment.js:135`, the function is exported as `export function analyzeReviewSentiment(text, starRating = null)`.
  There is **no** `analyzeSentiment` export or alias in `sentiment.js`.
- **Why this is a problem**:
  `typeof sentimentModule.analyzeSentiment === 'function'` evaluates to `false` at runtime. Every review created in the application silently falls back to `computeSentiment(rating, text)` in `reviews.js`, which only computes `((rating - 3) / 2)` and takes words with length $\ge 4$. The ~250-term literary lexicon, negation lookahead, intensifiers, aspect extraction, and star calibration are completely bypassed when real users write reviews.
- **Suggestion**:
  1. In `server/src/recommender/sentiment.js`, export `analyzeSentiment` as an alias:
     `export { analyzeReviewSentiment, analyzeReviewSentiment as analyzeSentiment };`
  2. In `server/src/routes/reviews.js`, check `sentimentModule.analyzeReviewSentiment || sentimentModule.analyzeSentiment`.

---

### [Major] Finding 3: Aspect Extraction False-Positive on "slow-burn" Pacing
- **Where**:
  - `server/src/recommender/sentiment.js:88, 271-283`
- **What**:
  `slowDragTerms` includes the single token `'slow'`. In `extractAspects`:
  ```javascript
  if (def.slowDragTerms.some((t) => lowerText.includes(t))) {
    tags.add('slow-dragging');
    breakdown['slow-dragging'] = 'negative';
  }
  ```
  When a user submits a 5-star review praising a "wonderful slow-burn romance with great characters", `lowerText.includes('slow')` matches the word "slow" in "slow-burn".
  As a result, the review gets tagged with `slow-dragging: 'negative'` in addition to `slow-burn: 'positive'`.
- **Why this is a problem**:
  In `adaptRecommendationsBySentiment`, `criticizedAspects` picks up `slow-dragging`, triggering `negative_contrast` mode or injecting unwanted contrasting vibes (`fast-paced`, `gripping-plot`) into recommendations for a user who loved a slow-burn book.
- **Suggestion**:
  Ensure term checks use word boundaries or explicitly exclude `'slow-burn'` and `'slow burn'` before matching `'slow'` (or replace `'slow'` with `'slow-paced'`, `'too slow'`, etc.).

---

### [Major] Finding 4: Inverted Map Candidate Pool Head-Slicing Bias in `engine.js`
- **Where**:
  - `server/src/recommender/engine.js:176-189, 191-204`
- **What**:
  Candidate sampling from genres and tags uses naive head slicing:
  ```javascript
  const sample = genreList.slice(0, 400);
  ```
  `genreList` is an array of book indices in chronological database insertion order.
- **Why this is a problem**:
  In a 270,000-book catalog where genres like "Fantasy" contain 20,000+ titles, books at index $\ge 400$ are permanently starved from candidate evaluation unless their author matches one of the seeds.
- **Suggestion**:
  Use stride sampling (`step = Math.max(1, Math.floor(genreList.length / 400))`) or sort by Bayesian baseline rating before slicing.

---

## 2. Adversarial Challenge Report

**Overall Risk Assessment**: **HIGH**

### Challenge 1: Subversive Title Similarity via Semantic Tags
- **Assumption Challenged**: Worker M2 claimed title similarity weighting is completely excluded ($w_{\text{title}} = 0$) and candidate titles differing in words do not change feature scores.
- **Attack Scenario**:
  Create a seed book:
  - Seed: `"The Hobbit"` (J.R.R. Tolkien, 1980, Del Rey).
  Create two candidates with identical author, genre, publisher, and year:
  - Cand A: `"The Return of the Hobbit"`
  - Cand B: `"The Silmarillion"`
  Run them through `inferTags` and `computeHeuristicFeatures`.
- **Observed Result**:
  - Cand A tags: `[ 'return', 'hobbit', '1980s', 'paperback-series', 'high-fantasy' ]`
  - Cand B tags: `[ 'silmarillion', '1980s', 'paperback-series', 'high-fantasy' ]`
  - Cand A tag feature score: **0.8944**
  - Cand B tag feature score: **0.7500**
  Cand A was boosted purely due to the word "hobbit" in its title. Title similarity was actively scored.
- **Blast Radius**: Invalidates compliance with Acceptance Criterion 3 (R3, AC3).

---

### Challenge 2: Review Sentiment Facade on Primary Workflow
- **Assumption Challenged**: Submitting a book review triggers local sentiment analysis that adapts and records review sentiment.
- **Attack Scenario**:
  Submit a review via `POST /api/books/:isbn/reviews` with rating 4 and negative text:
  `{ rating: 4, text: "Not good, not exciting, and definitely not recommended." }`.
- **Observed Result**:
  Because `sentimentModule.analyzeSentiment` is `undefined`, `reviews.js` falls back to `computeSentiment(4, text)`, recording `score: 0.50`, `label: "positive"`. The review is incorrectly labeled positive because text analysis was skipped entirely.
- **Blast Radius**: Core Goodreads parity workflow (reviews with sentiment) broken in production.

---

### Challenge 3: Aspect Extraction Collision on Slow-Burn Books
- **Assumption Challenged**: Aspect extraction cleanly isolates positive and negative literary dimensions.
- **Attack Scenario**:
  Pass `"A wonderful slow-burn romance with great characters"` (5 stars) to `analyzeReviewSentiment`.
- **Observed Result**:
  Extracted aspects: `[ 'slow-burn', 'slow-dragging' ]`.
  Aspect breakdown: `{ 'slow-burn': 'positive', 'slow-dragging': 'negative' }`.
- **Blast Radius**: Degrades recommendation quality for romance and literary fiction readers.

---

## 3. Verified Claims

| Claim | Method | Result | Notes |
|---|---|---|---|
| Pure on-device sentiment analyzer without external APIs or packages | Inspected `server/package.json` and imports in `sentiment.js` | **PASS** | Zero external dependencies; 100% native ESM. |
| 3-token lookahead negation (-0.8x) | Tested "not good", "never brilliant" | **PASS** | Negation correctly inverted positive term valences. |
| Contrastive conjunction shift (1.4x) | Tested trailing clause with "but was awful" | **PASS** | Shift amplified trailing clause score. |
| 16-Genre taxonomy rule classification | Tested fantasy, sci-fi, thriller keyword rules | **PASS** | Accurately assigns 1–3 literary genres. |
| Bayesian catalog rating formula | Verified `(C*prior + sum)/(C+N)` with $C=3$ | **PASS** | Math is correct and stable. |
| Dev Mode diagnostics telemetry | Verified `GET /api/dev/diagnostics` schema | **PASS** | Returns seed count, weights used, and `titleExcluded: true`. |
| API input validation | Verified `POST /recommend/three` rejection of $\ne 3$ seeds and duplicates | **PASS** | 400 Bad Request returned with descriptive errors. |

---

## 4. Coverage Gaps & Unverified Items

- **Loopback socket E2E execution**: The standalone E2E runner (`tests/run-all.js`) connects to `http://127.0.0.1:5050/api`. In the restricted macOS sandbox, loopback network socket binding requires elevation (`BypassSandbox: true`), which is disallowed by security policy. Unit test suites and direct Express router dispatch (`test-api-m2.js`) were used instead.

---

## 5. Handoff Report

### 5.1 Observation
1. In `server/src/recommender/metadata.js`, lines 228–234 extract title tokens directly into `tags`.
2. In `server/src/recommender/engine.js`, line 50 populates `state.byTag` with title tokens, and lines 192–204 query `state.byTag` during 3-seed candidate generation.
3. In `server/src/scripts/test-m2.js`, lines 94–118 manually supply identical `tags` arrays to candidates, masking the title token leak in `inferTags`.
4. In `server/src/routes/reviews.js`, line 88 checks `if (typeof sentimentModule.analyzeSentiment === 'function')`, while `server/src/recommender/sentiment.js`, line 135 exports `analyzeReviewSentiment`.
5. In `server/src/recommender/sentiment.js`, line 88 lists `'slow'` under `slowDragTerms`, causing substring matches in `'slow-burn'`.

### 5.2 Logic Chain
1. Requirement R3 & AC3 mandate strict exclusion of title similarity from 3-seed heuristics.
2. Ingesting title tokens into tags and scoring them in `tag` overlap introduces title similarity into the recommendation score.
3. Hardcoding static tags in unit tests prevents regression detection.
4. Exporting `analyzeReviewSentiment` without aliasing `analyzeSentiment` causes `reviews.js` to silently execute dummy fallback logic.
5. Therefore, the implementation does not meet the Milestone 2 acceptance criteria and must be revised.

### 5.3 Caveats
- The core lexicon, math, and architecture designed by Worker M2 are high quality and well-structured. With the title token extraction removed from `inferTags` and the export alias added, Milestone 2 will fully meet all requirements.

### 5.4 Conclusion
Verdict: **REQUEST_CHANGES**. The worker must:
1. Strip title tokens from `inferTags` in `metadata.js`.
2. Update `test-m2.js` Test 2 to test books through `inferTags` to prove true title invariance.
3. Export `analyzeSentiment` as an alias in `sentiment.js` (and check both names in `reviews.js`).
4. Fix the `'slow-burn'` aspect extraction collision in `sentiment.js`.
5. Implement stride or rating-based sampling in `engine.js`.

### 5.5 Verification Method
To verify fixes independently:
```bash
# 1. Syntax check:
node --check server/src/recommender/metadata.js
node --check server/src/recommender/sentiment.js
node --check server/src/recommender/algorithms.js
node --check server/src/recommender/engine.js
node --check server/src/routes/api.js

# 2. Invariant verification (must pass without hardcoded tags in candidates):
node server/src/scripts/test-m2.js

# 3. Router integration test:
node server/src/scripts/test-api-m2.js

# 4. Independent title invariance check:
node -e '
import { inferTags, inferGenres } from "./server/src/recommender/metadata.js";
import { computeHeuristicFeatures } from "./server/src/recommender/algorithms.js";
const seed = { isbn: "S1", title: "The Hobbit", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
seed.genres = inferGenres(seed); seed.tags = inferTags(seed);
const candA = { isbn: "C1", title: "The Return of the Hobbit", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
candA.genres = inferGenres(candA); candA.tags = inferTags(candA);
const candB = { isbn: "C2", title: "The Silmarillion", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
candB.genres = inferGenres(candB); candB.tags = inferTags(candB);
const fA = computeHeuristicFeatures(candA, [seed]);
const fB = computeHeuristicFeatures(candB, [seed]);
if (fA.tag !== fB.tag) { console.error("FAILED: Title leaked into tag feature!", fA.tag, "vs", fB.tag); process.exit(1); }
console.log("PASSED: Title strictly excluded from tags and features.");
'
```
