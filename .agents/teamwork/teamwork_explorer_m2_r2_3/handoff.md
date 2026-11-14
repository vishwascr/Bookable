# Milestone 2 Round 2 Test Suite & Verification Decoupling Fix Strategy Report

**Agent**: `teamwork_explorer_m2_r2_3` (Explorer 3, Round 2)  
**Parent Conversation ID**: `5b5e5d28-614b-498e-b981-66f748495970`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**Date**: 2026-11-13T19:35:00Z  

---

## Executive Summary

This report establishes the comprehensive fix strategy for the Milestone 2 verification test suite (`server/src/scripts/test-m2.js`, `server/src/scripts/challenge-sentiment.js`, and `server/src/scripts/test-api-m2.js`) and reviews route integration (`server/src/routes/reviews.js`).

Adversarial exploration verified four critical defect mechanisms:
1. **Test 2 Masking in `test-m2.js`**: Test 2 hardcoded static tags (`['magic', 'wizard', '1990s']`) directly onto mock candidate objects, completely bypassing catalog function `inferTags(b)`. When candidates are evaluated through real `inferTags(cand)`, candidate A (sharing title words with the seed) scores **0.8165** vs **0.7500** for candidate B on tag features (composite recommendation score **0.9062** vs **0.4352**), completely violating the title invariance constraint ($w_{\text{title}} = 0$).
2. **Double Negation & Lexicon Failures in `challenge-sentiment.js`**: `"It is not without merit."` yields polarity $0.0$ because `merit` is absent from `LITERARY_LEXICON`. `"It is not without genius."` yields polarity $-0.586$ (classified as negative) because the 3-token lookback window breaks on the first negator (`'not'`) and inverts positive praise into criticism.
3. **Aspect Substring & Word Boundary Collisions**: (a) `"slow-burn"` romance reviews trigger the negative aspect `"slow-dragging"` because `'slow'` in `slowDragTerms` matches `'slow'` in `'slow-burn'`. (b) `"She explored..."` and `"An upsetting..."` false-trigger the `"world-building"` aspect because `'lore'` matches in `'explored'` (`'exp-lore-d'`) and `'setting'` matches in `'upsetting'` (`'up-setting'`).
4. **Review Submission Facade Fallback in `reviews.js`**: `server/src/routes/reviews.js:88` checks `if (typeof sentimentModule.analyzeSentiment === 'function')`. Because `sentiment.js` only exports `analyzeReviewSentiment` without aliasing `analyzeSentiment`, every live review submitted in Bookable silently falls back to `computeSentiment(rating, text)`, bypassing the ~250-word literary lexicon, negation lookahead, and aspect extraction.

Complete machine-applicable patches and drop-in proposed replacement scripts have been generated in the state folder:
- `test-m2.patch` & `proposed_test-m2.js`
- `challenge-sentiment.patch` & `proposed_challenge-sentiment.js`
- `test-api-m2.patch` & `proposed_test-api-m2.js`

---

## 1. Observation

### 1.1 Test 2 Masking and Title Leakage
- **Files**:
  - `server/src/scripts/test-m2.js:94-118`
  - `server/src/recommender/metadata.js:225-235`
  - `server/src/recommender/algorithms.js:268-280`
- **Observed Code**:
  In `test-m2.js:96-116`, the test author manually bypassed tag inference by pre-setting hardcoded tags:
  ```javascript
  const candA = {
    isbn: 'CAND_A',
    title: 'Harry Potter Chamber Sorcerer',
    author: 'J. K. Rowling',
    aKey: 'jkrowling',
    genres: ['Fantasy', 'Young Adult & Children'],
    tags: ['magic', 'wizard', '1990s'],
    rating: 4.5,
    dKey: 'harry potter chamber sorcerer',
  };
  const candB = {
    isbn: 'CAND_B',
    title: 'Completely Distinct Title Zero Shared Terminology',
    author: 'J. K. Rowling',
    aKey: 'jkrowling',
    genres: ['Fantasy', 'Young Adult & Children'],
    tags: ['magic', 'wizard', '1990s'],
    rating: 4.5,
    dKey: 'completely distinct title',
  };
  ```
- **Empirical Execution without Hardcoded Tags**:
  When candidate books are instantiated with identical non-title metadata (`author: 'J. R. R. Tolkien'`, `publisher: 'Del Rey'`, `year: 1980`, `rating: 4.5`) but differing titles, and passed to real `inferTags(cand)`:
  - `candA.title = 'The Hobbit Quest Return'` -> `candA.tags = [ 'return', 'hobbit', 'quest', '1980s', 'paperback-series', 'high-fantasy' ]`
  - `candB.title = 'The Silmarillion'` -> `candB.tags = [ 'silmarillion', '1980s', 'paperback-series', 'high-fantasy' ]`
  - Heuristic feature vector comparison against Seed (`"The Hobbit"`):
    - `featA.tag = 0.8165`
    - `featB.tag = 0.7500`
    - `fA.tag === fB.tag` -> **`false`**
    - Composite score: `scoreA = 0.9062` vs `scoreB = 0.4352`.
  Cand A receives more than double the recommendation score of Cand B purely due to title word overlap with the seed book. Hardcoding `tags` in `test-m2.js` masked this regression completely.

### 1.2 Verbatim Double Negation Failures in `challenge-sentiment.js`
- **Command Executed**: `node server/src/scripts/challenge-sentiment.js`
- **Observed Failures**:
  ```
  ❌ [FAIL] Double Negation: "It is not without merit." -> assert polarity > 0 -> Expected polarity > 0.0, observed: 0 (lexiconMatches: 0, label: "neutral")
  ❌ [FAIL] Double Negation: "It is not without genius." -> assert polarity > 0 -> Expected polarity > 0.0, observed: -0.586 (classified as: "negative", negators: ["not"])
  ```
- **Source Inspection**:
  1. In `server/src/recommender/sentiment.js:12-54`, `merit` is absent from `LITERARY_LEXICON`.
  2. In `server/src/recommender/sentiment.js:160-168`:
     ```javascript
     let isNegated = false;
     for (let j = Math.max(0, i - 3); j < i; j++) {
       if (NEGATORS.has(rawTokens[j])) {
         isNegated = true;
         negatorsDetected.push(rawTokens[j]);
         break;
       }
     }
     if (isNegated) multiplier *= -0.80;
     ```
     For `"It is not without genius."`, `rawTokens` is `['it', 'is', 'not', 'without', 'genius']`. Index 2 is `'not'`, index 3 is `'without'`. At index 4 (`'genius'`), the lookback finds `'not'` at $j=2$, marks `isNegated = true`, breaks immediately, ignores `'without'`, and applies `multiplier *= -0.80` to genius ($+3.5$), resulting in $-2.80$ raw score and $-0.586$ polarity.

### 1.3 Verbatim Aspect Extraction Substring Collisions
- **Command Executed**:
  ```javascript
  const r1 = analyzeReviewSentiment("A wonderful slow-burn romance with compelling characters.", 5);
  const r2 = analyzeReviewSentiment("She explored the quiet streets.", 4);
  const r3 = analyzeReviewSentiment("An upsetting tragedy.", 2);
  ```
- **Observed Output**:
  ```
  r1 aspects: [ 'slow-burn', 'slow-dragging' ]
  r1 aspectBreakdown: { 'slow-burn': 'positive', 'slow-dragging': 'negative' }
  r2 aspects: [ 'world-building' ]
  r3 aspects: [ 'world-building' ]
  ```
- **Root Cause**:
  In `server/src/recommender/sentiment.js:88, 92, 271-283, 311-314`:
  1. `slowDragTerms` includes `'slow'`. `lowerText.includes('slow')` matches the `'slow'` inside `'slow-burn'`.
  2. `triggers` in category `world-building` includes `'lore'` and `'setting'`. Because unanchored `.includes()` is used, `"explored"` matches `'lore'` (`'exp-lore-d'`), and `"upsetting"` matches `'setting'` (`'up-setting'`).

### 1.4 Verbatim Review Route Export Mismatch (`reviews.js`)
- **Inspection of `server/src/routes/reviews.js:86-91`**:
  ```javascript
  let sentiment = computeSentiment(rating, text);
  try {
    const sentimentModule = await import('../recommender/sentiment.js');
    if (typeof sentimentModule.analyzeSentiment === 'function') {
      sentiment = sentimentModule.analyzeSentiment(text, rating);
    }
  } catch {}
  ```
- **Inspection of `server/src/recommender/sentiment.js:135`**:
  ```javascript
  export function analyzeReviewSentiment(text, starRating = null) { ... }
  ```
- **Empirical Execution**:
  Checking the imported module in Node.js:
  - `typeof sentimentModule.analyzeSentiment` -> **`undefined`**
  - `typeof sentimentModule.analyzeReviewSentiment` -> **`function`**
  - `postReviewHandler` with `{ rating: 4, text: "Not good, not exciting, and definitely not recommended." }` saved:
    `{ score: 0.5, label: 'positive', keywords: ['good', 'exciting', 'definitely', 'recommended'] }`
  Text analysis was completely bypassed and defaulted to the dummy formula `(rating - 3) / 2 = 0.5`.

---

## 2. Logic Chain

1. **Title Invariance Evidence & Chain**:
   - `ORIGINAL_REQUEST.md:20, 41` explicitly dictates: *"metadata heuristics (genres, authors, tags, and ratings) without title similarity weighting"* and *"with title similarity weight excluded"*.
   - If `test-m2.js` hardcodes identical tags on `candA` and `candB`, it tests only the trivial identity of pre-equalized vectors ($A = A$), rather than verifying that differing titles leave feature scores invariant when run through the actual catalog inference pipeline.
   - When candidate tags are dynamically inferred via `inferTags(cand)`, the test immediately detects whether title tokens leaked into tags.
   - Therefore, removing hardcoded tags and asserting `candA.tags = inferTags(candA)` and `featA.tag === featB.tag === featC.tag` provides strict invariance verification.

2. **Double Negation Evidence & Chain**:
   - In English literary reviews, double negations such as "not without merit" and "not without genius" affirm understated positive praise (litotes).
   - In `challenge-sentiment.js`, assertions require `polarity > 0.0`.
   - Missing `merit` causes score to remain $0.0$; breaking on the first negator causes double negation to be treated as single negation ($-0.80\times$), inverting high praise into a negative score ($-0.586$).
   - Both `challenge-sentiment.js` and `test-m2.js` must verify that double negation evaluates to positive polarity (`score > 0.0` and `label === 'positive'`).

3. **Aspect Boundary Evidence & Chain**:
   - Romance and literary fiction readers actively seek "slow-burn" narratives.
   - When "slow-burn" simultaneously triggers "slow-dragging", `adaptRecommendationsBySentiment` flags "slow-dragging" as a criticized aspect, penalizes the book's author, and switches to `negative_contrast` mode (injecting unwanted fast-paced action thrillers).
   - Similarly, false-positive matching of "lore" in "explored" and "setting" in "upsetting" corrupts aspect breakdowns for standard prose.
   - Incorporating word boundary checks (`(^|[^a-z0-9])term([^a-z0-9]|$)`) and explicit pacing separation in test assertions ensures aspect extraction cannot be satisfied by substring collisions.

4. **Review Submission Integration Evidence & Chain**:
   - JavaScript ES Module namespace objects are sealed and non-extensible by language specification; `analyzeSentiment` cannot be monkey-patched onto `sentimentModule` dynamically.
   - If `sentiment.js` does not export `analyzeSentiment`, `reviews.js` silently falls back to `computeSentiment(rating, text)`.
   - Testing `reviews.js` route execution with rating 4 and negative text ("Not good, not exciting, and definitely not recommended.") produces positive label under the fallback, but negative label under the calibrated M2 analyzer.
   - Therefore, verifying that the review route persists calibrated sentiment with negative polarity and `metrics` proves non-fallback integration.

---

## 3. Caveats

1. **Database Decoupling in Router Unit Tests**:
   - In the local testing harness without active MongoDB daemon connections, direct invocation of `POST /books/:isbn/reviews` in `reviews.js` would stall at `Review.findOneAndUpdate` if Mongoose connection buffering is active.
   - Our fix strategy mocks `Review.findOneAndUpdate` and `Review.find` in-memory within the test block (and restores originals in a `finally` block). This isolates the route's sentiment integration logic without requiring network sockets or MongoDB daemon processes.
2. **Catalog Metadata Dependencies**:
   - In `test-m2.js` Test 2, books require `year` and `publisher` properties so that `inferTags` can infer publication era and imprint tags. The test fixtures provide realistic metadata (`year: 1980`, `publisher: 'Del Rey'`, `genres: ['Fantasy']`).
3. **Execution Mode**:
   - All proposed test scripts are 100% native ESM, require zero external testing frameworks (leveraging `node:assert/strict`), and execute synchronously in $< 200\text{ ms}$.

---

## 4. Conclusion & Actionable Fix Strategy

### 4.1 Changes for `server/src/scripts/test-m2.js`

1. **Unmask Test 2**:
   - Remove hardcoded pre-set `tags` on `candA`, `candB`, and `seeds`.
   - Pass candidates dynamically through `inferTags(cand)` and `inferGenres(cand)`.
   - Add a third candidate `candC` with zero title word overlap.
   - Assert that candidate tags do NOT contain title tokens (`assert(!candA.tags.includes('hobbit'))`).
   - Assert `featA.tag === featB.tag === featC.tag` and `scoreA === scoreB === scoreC`.
2. **Add Aspect Isolation & Double Negation to Test 4**:
   - Add 4.6: Double Negation affirmation (`"It is not without merit."` -> `score > 0.0`, `"It is not without genius."` -> `score > 0.0`).
   - Add 4.7: Aspect pacing separation (`"slow-burn"` -> `aspects.includes('slow-burn')` and `!aspects.includes('slow-dragging')`).
   - Add 4.8: Word boundary trigger protection (`"explored"` does NOT match `"lore"`; `"upsetting"` does NOT match `"setting"`).
3. **Add Test 6 for `reviews.js` Integration**:
   - Verify `sentimentModule.analyzeSentiment` is exported as an alias.
   - Execute `POST /books/:isbn/reviews` route handler with mock user and rating 4 + negative text.
   - Assert captured database update contains `label === 'negative'`, `score < 0`, and `metrics` object.

### 4.2 Changes for `server/src/scripts/challenge-sentiment.js`

1. **Retain Tests 1.3 and 1.4**:
   - Keep `"It is not without merit."` and `"It is not without genius."` assertions (`polarity > 0.0`). Once Worker applies the lexicon entry and negator counting in `sentiment.js`, both will pass.
2. **Add New Linguistic Adversarial Tests**:
   - 1.12: Double Negation with alternative term `"It is not without charm."` -> assert `polarity > 0.0`.
   - 1.13: Aspect Pacing Separation (`"A wonderful slow-burn romance..."`) -> assert `slow-burn` present and `slow-dragging` absent.
   - 1.14: Aspect Word Boundary Substring Protection (`"She explored..."` and `"An upsetting..."` do NOT trigger `world-building`).
3. **Add Section 5: Review Route Module Contract**:
   - Verify `sentimentModule.analyzeSentiment` export alias.
   - Verify calibrated evaluation of rating 4 with negative text yields negative classification.

### 4.3 Changes for `server/src/scripts/test-api-m2.js`

1. **Add Test 7**:
   - `POST /recommend/sentiment-adapted` with double negation review (`"It is not without merit, and possesses genuine literary depth."`) -> assert `sentiment.label === 'positive'`, `adaptationStrategy === 'positive_reinforce'`.
2. **Add Test 8**:
   - `POST /recommend/sentiment-adapted` with slow-burn review (`"A wonderful slow-burn romance with compelling characters."`) -> assert `sentiment.aspects.includes('slow-burn')`, assert `!sentiment.aspects.includes('slow-dragging')`.

---

## 5. Verification Method

### 5.1 Artifacts Available in State Folder
The following complete artifacts are available for immediate inspection and worker application:
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/proposed_test-m2.js`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/proposed_challenge-sentiment.js`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/proposed_test-api-m2.js`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/test-m2.patch`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/challenge-sentiment.patch`
- `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_3/test-api-m2.patch`

### 5.2 Verification Commands

1. **Verify Test Scripts Syntax**:
   ```bash
   node --check server/src/scripts/test-m2.js
   node --check server/src/scripts/challenge-sentiment.js
   node --check server/src/scripts/test-api-m2.js
   ```

2. **Run Unmasked Invariant Verification**:
   ```bash
   node server/src/scripts/test-m2.js
   ```
   *Expected Output*:
   - Test 1: Metadata Inference & Bayesian Rating -> PASS
   - Test 2: Strict Title Similarity Exclusion Invariant (with dynamic `inferTags`) -> PASS
   - Test 3: 3-Seed Recommendation Engine & Diversity Ranking -> PASS
   - Test 4: Sentiment Analyzer, Negation, Contrastive Shifts, Double Negation & Aspect Isolation -> PASS
   - Test 5: Dynamic Sentiment Recommendation Adaptation -> PASS
   - Test 6: Review Route Integration with `analyzeSentiment` -> PASS
   - Exit code: `0`

3. **Run Adversarial Challenge Battery**:
   ```bash
   node server/src/scripts/challenge-sentiment.js
   ```
   *Expected Output*:
   - Section 1: All 14 linguistic scenarios (including double negations and aspect boundaries) -> PASS
   - Section 2: Star calibration sensitivity -> PASS
   - Section 3: Dynamic recommendation adaptation -> PASS
   - Section 4: 1,000 synthetic reviews latency benchmark ($< 1.0\text{ ms/review}$) -> PASS
   - Section 5: Review route contract verification -> PASS
   - Exit code: `0`, printing `📊 CHALLENGE SUMMARY: 25 PASSED | 0 FAILED`, `🏁 FINAL VERDICT: APPROVE`

4. **Run API Route Integration**:
   ```bash
   node server/src/scripts/test-api-m2.js
   ```
   *Expected Output*: All 8 tests pass with exit code `0`.

### 5.3 Invalidation Conditions
- Any test hardcoding pre-set `tags` on mock books in Test 2 invalidates invariance verification.
- Any double negation evaluating to $\le 0.0$ invalidates sentiment calibration.
- Any aspect extraction where "slow-burn" triggers "slow-dragging" or "explored" triggers "world-building" invalidates aspect isolation.
- Any review submission where `typeof sentimentModule.analyzeSentiment` is not a function invalidates Goodreads review integration.
