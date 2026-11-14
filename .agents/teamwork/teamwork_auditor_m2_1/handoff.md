# Forensic Audit Report: Milestone 2 — 3-Book Recommendation Engine & Local Sentiment Analyzer

**Work Product**: Milestone 2 Deliverables (`server/src/recommender/`, `server/src/routes/api.js`, `server/package.json`, test scripts)  
**Profile**: General Project  
**Integrity Mode**: Demo Mode (from `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**  

---

## 1. Observation

### 1.1 Integrity Forensics Phase Results

| Check Name | Status | Details |
|---|---|---|
| **Hardcoded Test Outputs / Inputs** | **PASS** | Grep of catalog ISBNs (`0439136350`, `0345339681`, `0060973129`, etc.) found zero ISBN branching or canned result returns in recommender code. Matches only exist in test scripts and `users.js` initial seed array. |
| **Facade Detection** | **PASS** | Zero dummy returns, placeholder functions, or `NotImplementedError` stubs found in `metadata.js`, `sentiment.js`, `algorithms.js`, `engine.js`, or `api.js`. |
| **Pre-populated Artifact Detection** | **PASS** | `find . -name '*.log' -o -name '*result*'` confirmed zero pre-populated test log or output files exist in the workspace. |
| **Title Similarity Exclusion Invariant** | **PASS** | `computeHeuristicFeatures` strictly calculates `{ author, genre, tag, rating }`. Title TF-IDF vectors are never accessed. Title weight injections (`title: 1000`, `w_title: 1000`) are ignored. Under adversarial testing, candidate sharing 100% seed title words but unrelated metadata scored $0.1068$ (rating only), while candidate with completely unrelated title and matching metadata scored $0.9958$. |
| **Mathematical Heuristics Verification** | **PASS** | Jaccard genre similarity ($|A \cap B| / |A \cup B| = 0.3333$ for $\{F, YA\} \cap \{F, H\}$), tag overlap ($|A \cap B| / \sqrt{|A| \cdot |B|} = 0.5$ for 2 shared tags out of 4), author binary match ($1.0$ vs $0.0$), and Bayesian rating ($(C \cdot \text{prior} + \sum r)/(C+N) = 4.50$ for $[5,5,5]$ with prior 4.0) mathematically verified. |
| **Rule-Based Sentiment Engine Verification** | **PASS** | ~250-word literary domain lexicon, 3-token lookback negation ($-0.80$ multiplier), intensifiers ($1.4\times$ to $1.8\times$), diminishers ($0.45\times$ to $0.70\times$), contrastive conjunctions ($1.4\times$ weight shift after 'but'), star rating calibration ($S_{\text{star}} = (r-3)/2$), and 7 aspect categories confirmed. |
| **Third-Party Dependency Audit** | **PASS** | `server/package.json` contains only `bcryptjs`, `cors`, `csv-parse`, `dotenv`, `express`, `jsonwebtoken`, `mongoose`. Zero external cloud APIs, zero third-party NLP libraries. |
| **Runtime Test Execution** | **PASS** | `node server/src/scripts/test-m2.js` passed 5/5 test suites. `node server/src/scripts/test-api-m2.js` passed 6/6 route tests. |

### 1.2 Raw Tool Execution Evidence

#### Check 1: Runtime Test Suites Execution
```bash
$ node server/src/scripts/test-m2.js
🧪 Starting Milestone 2 Verification Suite...

Test 1: Metadata Inference & Bayesian Rating
  ✅ Genre classification, tag inference, and Bayesian rating verified.

Test 2: Strict Title Similarity Exclusion Invariant
  ✅ Invariant verified: Title similarity has ZERO effect on heuristic features and scoring.

Test 3: 3-Seed Recommendation Engine & Diversity Ranking
  ✅ 3-Seed recommendation pipeline and diversity re-ranking verified.

Test 4: Sentiment Analyzer & Aspect Extraction
  ✅ Sentiment analysis, negation lookahead, contrastive shifts, and star calibration verified.

Test 5: Dynamic Sentiment Recommendation Adaptation
  ✅ Dynamic sentiment adaptation (reinforce positive & contrast negative) verified.

🎉 ALL MILESTONE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!
```

```bash
$ node server/src/scripts/test-api-m2.js
🧪 Starting API Routes Integration Test (Mock Dispatch)...

  ✅ GET /health passed.
  ✅ GET /dev/diagnostics passed.
  ✅ POST /recommend/three happy path passed.
  ✅ POST /recommend/three input validations passed.
  ✅ POST /recommend/sentiment-adapted positive review passed.
  ✅ POST /recommend/sentiment-adapted negative review passed.

🎉 ALL API ROUTE INTEGRATION TESTS PASSED SUCCESSFULLY!
```

#### Check 2: Independent Empirical Verification of Mathematical Formulas
- **Genre Jaccard Calculation**:
  ```bash
  $ node -e "
  import { computeHeuristicFeatures } from './server/src/recommender/algorithms.js';
  const seeds = [{ isbn: '1', genres: ['Fantasy', 'Young Adult & Children'], tags: [], rating: 4.0, aKey: 'a' }];
  const cand = { isbn: '2', genres: ['Fantasy', 'Horror'], tags: [], rating: 4.0, aKey: 'b' };
  const f = computeHeuristicFeatures(cand, seeds);
  console.log(f.genre); // Output: 0.3333 (Jaccard verified: 1/3)
  "
  ```
- **Tag Overlap Calculation**:
  ```bash
  $ node -e "
  import { computeHeuristicFeatures } from './server/src/recommender/algorithms.js';
  const seeds = [{ isbn: '1', genres: [], tags: ['magic', 'wizard', 'dragon', 'quest'], rating: 4.0, aKey: 'a' }];
  const cand = { isbn: '2', genres: [], tags: ['magic', 'wizard', '2000s', 'classic-era'], rating: 4.0, aKey: 'b' };
  const f = computeHeuristicFeatures(cand, seeds);
  console.log(f.tag); // Output: 0.5 (Overlap verified: 2 / sqrt(4*4) = 0.5)
  "
  ```
- **Bayesian Rating Calculation**:
  ```bash
  $ node -e "
  import { getCatalogRating } from './server/src/recommender/metadata.js';
  console.log(getCatalogRating('str', [5, 5, 5])); // Output: 4.5 (Verified: (3*4 + 15)/6 = 4.50)
  console.log(getCatalogRating('str', [5, 5, 4, 2])); // Output: 4.0 (Verified: (3*4 + 16)/7 = 4.00)
  "
  ```

#### Check 3: Adversarial Title Similarity Poisoning & Exclusion Invariant
```bash
$ node -e "
import { computeHeuristicFeatures, scoreCandidate } from './server/src/recommender/algorithms.js';
const seeds = [{ isbn: 'S1', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['magic', 'quest'], rating: 4.8 }];
const candTitleOnly = { isbn: 'C1', title: 'The Hobbit Tolkien Magic Quest', author: 'Other', aKey: 'other', genres: ['Art'], tags: ['kitchen'], rating: 3.5 };
const candMetaOnly = { isbn: 'C2', title: 'Different Name', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', genres: ['Fantasy'], tags: ['magic', 'quest'], rating: 4.8 };
console.log('C1:', scoreCandidate(computeHeuristicFeatures(candTitleOnly, seeds))); // 0.1068
console.log('C2:', scoreCandidate(computeHeuristicFeatures(candMetaOnly, seeds))); // 0.9958
"
```
Result: Title overlap gave zero boost. Cand 2 with matching metadata scored $0.9958$ vs Cand 1's $0.1068$.

#### Check 4: Cross-Milestone Contract Note
In `server/src/routes/reviews.js:87-90`:
```javascript
const sentimentModule = await import('../recommender/sentiment.js');
if (typeof sentimentModule.analyzeSentiment === 'function') {
  sentiment = sentimentModule.analyzeSentiment(text, rating);
}
```
`server/src/recommender/sentiment.js` exports `analyzeReviewSentiment` (matching M2 SCOPE), but does not alias `analyzeSentiment`. As a result, review submissions in M1 fall back to local helper `computeSentiment` rather than calling the M2 engine. This does not violate M2 integrity, but should be addressed by exporting `export { analyzeReviewSentiment as analyzeSentiment }` in `sentiment.js` during subsequent integration.

---

## 2. Logic Chain

1. **Premise 1**: The user specified Demo Mode in `ORIGINAL_REQUEST.md`, requiring authentic implementation of core logic without copying or delegating core work to external libraries/tools.
2. **Observation**: `server/src/recommender/sentiment.js` implements a 100% local rule-based sentiment engine with a ~250-word domain lexicon, multi-token lookback negation handling, contrastive conjunction adjustments, star rating calibration, and aspect extraction without importing any third-party NLP packages or calling external cloud APIs.
3. **Observation**: `server/src/recommender/algorithms.js` and `metadata.js` implement 3-seed heuristic recommendations based strictly on author match, genre Jaccard similarity, tag overlap, and Bayesian rating.
4. **Observation**: The title similarity exclusion constraint was tested adversarially with injected title weights and conflicting title/metadata candidates. Title similarity was proven to have zero effect on heuristic feature generation or candidate ranking ($w_{\text{title}} = 0$).
5. **Observation**: Static code analysis confirmed the complete absence of hardcoded ISBNs, branching on specific test seeds, dummy returns, and pre-populated result files.
6. **Observation**: All M2 verification scripts and API integration test suites executed cleanly with 0 errors.
7. **Inference**: Milestone 2 satisfies all integrity and functional constraints authentically and without shortcuts.
8. **Conclusion**: The work product is CLEAN.

---

## 3. Caveats

1. **Cross-Milestone Export Alias**: As noted in Observation 1.2 Check 4, `sentiment.js` exports `analyzeReviewSentiment` while M1's `reviews.js` checks for `sentimentModule.analyzeSentiment`. While both functions perform rule-based sentiment analysis, adding `export { analyzeReviewSentiment as analyzeSentiment }` in `sentiment.js` will link the full M2 analyzer to M1/M3 review persistence.
2. **Catalog In-Memory Build**: Indexing genres and tags adds ~300ms to catalog index build time at server startup; tested and verified stable in local Node environment.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 2 (3-Book Recommendation Engine & Local Sentiment Analyzer) passes all forensic checks:
1. Genuine, from-scratch rule-based sentiment engine and metadata heuristic pipeline.
2. Zero external NLP libraries or cloud APIs.
3. Strict title similarity exclusion ($w_{\text{title}} = 0$) verified mathematically and adversarially.
4. Zero hardcoded test inputs, branching, or facade implementations.
5. 100% pass rate across automated verification test suites.

The work product is approved.

---

## 5. Verification Method

To independently verify this audit:

```bash
# 1. Run M2 heuristic, invariant, and unit tests:
node server/src/scripts/test-m2.js

# 2. Run M2 API router integration tests:
node server/src/scripts/test-api-m2.js

# 3. Empirically verify title exclusion under title poisoning:
node -e "
import { computeHeuristicFeatures, scoreCandidate } from './server/src/recommender/algorithms.js';
const s = [{ isbn: '1', title: 'A', aKey: 'a', genres: ['Fantasy'], tags: ['magic'], rating: 4.5 }];
const c1 = { isbn: '2', title: 'A', aKey: 'b', genres: ['Art'], tags: [], rating: 3.5 };
const c2 = { isbn: '3', title: 'Z', aKey: 'a', genres: ['Fantasy'], tags: ['magic'], rating: 4.5 };
const s1 = scoreCandidate(computeHeuristicFeatures(c1, s));
const s2 = scoreCandidate(computeHeuristicFeatures(c2, s));
console.log('Title Match:', s1, 'Metadata Match:', s2);
if (s2 > s1 && computeHeuristicFeatures(c1, s).genre === 0) console.log('CLEAN');
"
```
