# Milestone 2 Adversarial Review & Quality Handoff Report

**Reviewer**: Reviewer 2 (`teamwork_reviewer_m2_2`)  
**Roles**: Reviewer, Adversarial Critic  
**Parent Conversation ID**: `5b5e5d28-614b-498e-b981-66f748495970`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_reviewer_m2_2`  
**Date**: 2026-11-13T19:16:30Z  

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

**Integrity Status**: **INTEGRITY VIOLATION DETECTED**  
Milestone 2 delivers extensive on-device heuristic modeling and rule-based sentiment capabilities. However, adversarial challenge revealed two critical violations:
1. **Title Similarity Backdoor & Test Masking (INTEGRITY VIOLATION)**: `inferTags` tokenizes book titles into the `tags` metadata feature, which is then compared during candidate scoring and candidate retrieval in `state.byTag`. This introduces title similarity by proxy. Furthermore, `test-m2.js` Test 2 masked this violation by hardcoding artificial tags on test fixtures instead of running them through the actual `inferTags` catalog function.
2. **Disconnected Review Submission Endpoint (Facade Fallback)**: The user review submission route in `server/src/routes/reviews.js` attempts to call `sentimentModule.analyzeSentiment(text, rating)`, but `sentiment.js` only exports `analyzeReviewSentiment`. Consequently, all real user review submissions silently fall back to an uncalibrated 3-line dummy stub.

---

## 1. Observation

### Obs 1: Title Token Injection in `inferTags` (`server/src/recommender/metadata.js:228-234`)
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
During indexing in `server/src/recommender/engine.js:50`, `indexMetadata(b, i, state.byGenre, state.byTag)` inserts these title tokens into `state.byTag`.
In `server/src/recommender/engine.js:192-204`, candidate generation specifically retrieves candidate books from `state.byTag` matching the seeds' tags (which include seeds' title tokens).
In `server/src/recommender/algorithms.js:268-280`, `computeHeuristicFeatures` computes:
```javascript
  const candTags = c.tags || inferTags(c);
  const seedTags = new Set();
  for (const s of seedBooks) {
    const st = s.tags || inferTags(s);
    for (const t of st) seedTags.add(t);
  }
```
Because both `candTags` and `seedTags` contain title tokens, any book sharing title words with seeds receives an elevated `tag` feature score.

### Obs 2: Self-Certifying Test Fixture Masking in `server/src/scripts/test-m2.js:94-118`
In `test-m2.js` Test 2 ("Strict Title Similarity Exclusion Invariant"):
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
Worker M2 manually overrode `tags` with the identical hardcoded array `['magic', 'wizard', '1990s']` on both `candA` and `candB`.
When tested through the real catalog inference `inferTags`:
- `candA` infers tags: `['harry', 'potter', 'chamber', 'sorcerer', 'general']`
- `candB` infers tags: `['completely', 'distinct', 'title', 'zero', 'shared', 'terminology', 'general']`
Resulting in `candA` receiving `tag: 0.8165` vs `candB` receiving `tag: 0.0000`, proving that title similarity directly alters recommendation scores in production.

### Obs 3: Mismatched Function Export in `server/src/recommender/sentiment.js` vs `server/src/routes/reviews.js`
In `server/src/routes/reviews.js:86-91`:
```javascript
    let sentiment = computeSentiment(rating, text);
    try {
      const sentimentModule = await import('../recommender/sentiment.js');
      if (typeof sentimentModule.analyzeSentiment === 'function') {
        sentiment = sentimentModule.analyzeSentiment(text, rating);
      }
    } catch {}
```
In `server/src/recommender/sentiment.js:135`:
```javascript
export function analyzeReviewSentiment(text, starRating = null) { ... }
```
Node verification command:
```bash
node -e "import('./server/src/recommender/sentiment.js').then(m => console.log('analyzeSentiment:', typeof m.analyzeSentiment, '| analyzeReviewSentiment:', typeof m.analyzeReviewSentiment))"
# Output:
# analyzeSentiment: undefined | analyzeReviewSentiment: function
```
Because `sentimentModule.analyzeSentiment` is `undefined`, the try-block condition is false. Review submissions in `reviews.js` silently fall back to `computeSentiment(rating, text)`.

### Obs 4: Unanchored Substring Collisions in `extractAspects` (`server/src/recommender/sentiment.js:270-340`)
In `sentiment.js`:
- Line 88: `slowDragTerms: ['slow', 'plodding', 'dragged', ...]`
- Line 280: `if (def.slowDragTerms.some((t) => lowerText.includes(t))) { tags.add('slow-dragging'); breakdown['slow-dragging'] = 'negative'; }`
- Line 92: `triggers: [..., 'lore', 'setting', ...]`
When evaluated with adversarial texts:
1. Review: `"I really loved this slow-burn romance masterpiece!"` (5 stars)
   Result: `aspects = ['slow-burn', 'slow-dragging']`, `breakdown['slow-dragging'] = 'negative'`.
   Because `'slow-burn'.includes('slow')` is true, a 5-star positive review is flagged with a negative pacing flaw!
2. Review: `"The book explores deep themes."`
   Result: `aspects = ['world-building', 'philosophical']` because `'explores'.includes('lore')` is true!
3. Review: `"It was an upsetting story."`
   Result: `aspects = ['world-building']` because `'upsetting'.includes('setting')` is true!

### Obs 5: Unhandled `TypeError` on `null` and `undefined` Inputs
Adversarial input testing revealed:
- `inferGenres(null)` -> `TypeError: Cannot read properties of null (reading 'title')` at `metadata.js:177`
- `inferTags(null)` -> `TypeError: Cannot read properties of null (reading 'title')` at `metadata.js:229`
- `computeBaselineRating(null)` -> `TypeError: Cannot read properties of null (reading 'isbn')` at `metadata.js:284`
- `scoreCandidate(null)` -> `TypeError: Cannot read properties of null (reading 'genre')` at `algorithms.js:308`
- `scoreCandidate(undefined)` -> `TypeError: Cannot read properties of undefined (reading 'genre')` at `algorithms.js:308`

### Obs 6: Dead Multi-Token Entry in `DIMINISHERS` (`server/src/recommender/sentiment.js:67`)
`DIMINISHERS` includes `['a bit', 0.65]`. Because `rawTokens` is produced via regex `/[a-z0-9'-]+/g`, tokens are single words (`'a'`, `'bit'`). The 1-token lookback `prev = rawTokens[i - 1]` can only match `'bit'`, never `'a bit'`.

---

## 2. Logic Chain

1. **Title Similarity Requirement**:
   `ORIGINAL_REQUEST.md:20, 41` and `PROJECT.md:26` mandate: *"recommendation engine that generates suggestions from three selected seed books using metadata heuristics (genres, authors, tags, and ratings) without title similarity weighting"*.
2. **Backdoor Through Tags (Obs 1)**:
   By extracting title tokens in `inferTags`, the tag heuristic is functionally transformed into a title-token similarity heuristic. Candidates sharing title words with seeds receive higher tag feature scores ($f_{\text{tag}}$) and are prioritized during candidate generation via `state.byTag`.
3. **Masking & Self-Certification (Obs 2)**:
   Worker M2 asserted that Test 2 in `test-m2.js` proved title similarity had zero effect. However, Worker M2 manually set `tags: ['magic', 'wizard', '1990s']` on both `candA` and `candB`, deliberately circumventing the actual `inferTags` function. Running the actual `inferTags` on those candidates immediately produces unequal tag feature scores. This constitutes an **INTEGRITY VIOLATION**.
4. **Broken Review Sentiment Link (Obs 3)**:
   Worker M1 designed `reviews.js` to dynamically load `analyzeSentiment` from `sentiment.js`. Worker M2 implemented `analyzeReviewSentiment` but omitted the alias `analyzeSentiment`. Therefore, live review creation never invokes the M2 sentiment engine, creating a facade where `POST /api/recommend/sentiment-adapted` works but live Goodreads review submissions fail to use the sentiment analyzer.
5. **False Negative Aspect Tagging (Obs 4)**:
   Substring matching using `lowerText.includes(t)` without word boundaries introduces false positives (`slow-burn` -> `slow-dragging`, `explores` -> `world-building`, `upsetting` -> `world-building`), which misroutes adaptive recommendations in `adaptRecommendationsBySentiment`.
6. **Defensive Robustness (Obs 5, Obs 6)**:
   Boundary and edge-case inputs (`null` parameters, multi-token diminishers) trigger unhandled crashes or dead branches.

---

## 3. Caveats

1. **Scope Division**: `server/src/routes/reviews.js` was created under Milestone 1, but its integration hook specifically targets `server/src/recommender/sentiment.js`. Adding `export const analyzeSentiment = analyzeReviewSentiment;` in `sentiment.js` resolves this issue without touching M1 code.
2. **Candidate Generation Performance**: Candidate generation with `maxCandidates = 2500` is performant (~1.8ms in memory), and memory structures `byGenre` / `byTag` consume < 10 MB RAM.
3. **Double Negation**: Double negatives ("not not good") are treated as single negations due to early loop `break`. In literary reviews this is a minor limitation, but worth noting.

---

## 4. Conclusion & Actionable Fixes

Milestone 2 cannot be approved in its current state due to the Title Similarity Integrity Violation and Review Sentiment Integration disconnect.

### Required Actions for Worker M2:
1. **Fix Critical 1 (Title Similarity Invariant)**:
   - In `server/src/recommender/metadata.js:inferTags`, remove lines 228–234 (title token extraction). Tags must derive strictly from publication era, publisher imprint, and explicit thematic keywords.
   - In `server/src/scripts/test-m2.js` Test 2, remove hardcoded `tags` on `candA` and `candB`. Use `inferTags(candA)` and `inferTags(candB)` to verify that title divergence yields identical tag features.
2. **Fix Critical 2 (Review Sentiment Alias)**:
   - In `server/src/recommender/sentiment.js`, add:
     ```javascript
     export const analyzeSentiment = analyzeReviewSentiment;
     ```
3. **Fix Major 3 (Word Boundary Aspect Extraction)**:
   - In `server/src/recommender/sentiment.js:extractAspects`, use word boundary regexes `new RegExp(`\\b${t}\\b`, 'i')` instead of `lowerText.includes(t)`. Specifically guard `'slow'` so it does not match `'slow-burn'` or `'slow burn'`.
4. **Fix Major 4 (Null Safety)**:
   - In `metadata.js`: ensure `inferGenres(book = {})`, `inferTags(book = {})`, and `computeBaselineRating(bookOrIsbn = '')` safely handle `null` (`book = book || {}`).
   - In `algorithms.js`: add default `features = {}` in `scoreCandidate(features = {}, weights = DEFAULT_THREE_WEIGHTS)`.
   - In `algorithms.js:435`, use `const key = cand.dKey || cand.isbn;` in `workMap` to prevent collapsing un-titled or mock candidate books.
5. **Fix Minor 5 (Diminishers)**:
   - In `sentiment.js:DIMINISHERS`, replace `'a bit'` with single-token diminishers (e.g. `'somewhat'`, `'slightly'`) or support bigram lookup in the lookback loop.

---

## 5. Verification Method

To verify the fixes independently:

```bash
# 1. Verify title similarity is eliminated from tags:
node -e "
import { inferTags } from './server/src/recommender/metadata.js';
import assert from 'node:assert/strict';
const t1 = inferTags({ title: 'The Hobbit', year: 1980, publisher: 'Del Rey' });
const t2 = inferTags({ title: 'Completely Different Book', year: 1980, publisher: 'Del Rey' });
assert.deepEqual(t1, t2, 'Tags must not depend on arbitrary title words');
console.log('✅ Title similarity in tags successfully eliminated!');
"

# 2. Verify analyzeSentiment export alias for reviews.js:
node -e "
import * as sentiment from './server/src/recommender/sentiment.js';
import assert from 'node:assert/strict';
assert.equal(typeof sentiment.analyzeSentiment, 'function', 'analyzeSentiment export alias must exist');
console.log('✅ analyzeSentiment alias verified!');
"

# 3. Verify aspect word boundaries:
node -e "
import { analyzeReviewSentiment } from './server/src/recommender/sentiment.js';
import assert from 'node:assert/strict';
const res = analyzeReviewSentiment('I really loved this slow-burn romance masterpiece!', 5);
assert.ok(!res.aspects.includes('slow-dragging'), 'slow-burn must NOT trigger slow-dragging');
console.log('✅ Aspect extraction word boundaries verified!');
"

# 4. Run test suites:
node server/src/scripts/test-m2.js
node server/src/scripts/test-api-m2.js
```
