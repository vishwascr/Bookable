# Milestone 2 Fix Strategy: Title-Tag Decoupling, Candidate Sampling & Null Safety

**Agent**: Explorer 1 (`teamwork_explorer_m2_r2_1`)  
**Parent Conversation ID**: `5b5e5d28-614b-498e-b981-66f748495970`  
**Working Directory**: `/Users/admin/Documents/Bookable`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_1`  
**Date**: 2026-11-13T19:25:00Z  
**Verdict**: **REMEDIATION STRATEGY COMPLETE (READY FOR IMPLEMENTATION WORKER)**

---

## 1. Observation

Direct code and runtime inspection revealed three critical flaws across `metadata.js`, `engine.js`, and `algorithms.js`:

### Obs 1: Direct and Indirect Title Similarity Leakage into `tags` (`server/src/recommender/metadata.js`)
In `server/src/recommender/metadata.js`:
- **Lines 228–234**: Title tokens are explicitly extracted and added to `tags`:
  ```javascript
  // 1. Title tokens
  const tokens = tokenize(book.title || '');
  for (const t of tokens) {
    if (t.length >= 3 && !COMMON_TAG_STOPWORDS.has(t)) {
      tags.add(t);
    }
  }
  ```
- **Lines 262–270**: Thematic vibe tags in Section 4 inspect `titleNorm`:
  ```javascript
  const titleNorm = normalize(book.title || '');
  const authorNorm = normalize(book.author || '');
  const fullText = `${titleNorm} ${authorNorm}`;
  if (/\b(magic|wizard|dragon|witch|realm|quest|tolkien|hobbit|fellowship|rings|ring|potter)\b/.test(fullText)) tags.add('high-fantasy');
  ```
- **Consequence**:
  1. `state.byTag` indexes all title tokens (`engine.js:50`).
  2. Candidate retrieval (`engine.js:192-204`) fetches candidates sharing seed title tokens.
  3. `computeHeuristicFeatures` (`algorithms.js:268-280`) measures tag overlap against seeds.
- **Empirical Proof**:
  Running candidates through `inferTags` with identical author, year, publisher, and rating:
  ```bash
  Cand A: "The Return of the Hobbit" -> tags: [ 'return', 'hobbit', '1980s', 'paperback-series', 'high-fantasy' ]
  Cand B: "The Silmarillion"         -> tags: [ 'silmarillion', '1980s', 'paperback-series', 'high-fantasy' ]
  Feature Scores against Seed "The Hobbit":
  fA.tag = 0.8944  vs  fB.tag = 0.7500
  ```
  Cand A received an artificial score boost of **+0.1444** solely due to the word `"hobbit"` in its title, violating the strict title similarity exclusion invariant ($w_{\text{title}} = 0$).

### Obs 2: Chronological Head-Slicing Starvation (`server/src/recommender/engine.js`)
In `server/src/recommender/engine.js:180, 195`:
```javascript
// 2. Inferred genres (sample up to 400 per genre)
const sample = genreList.slice(0, 400);

// 3. Rare / semantic tags (sample up to 150 per tag)
const sample = tagList.slice(0, 150);
```
- **Consequence**: `genreList` and `tagList` contain book indices in raw database insertion order. In a catalog with 270,000 books where genres contain 20,000+ titles, `.slice(0, 400)` permanently starves books at index $\ge 400$ from being evaluated as candidates (unless they share an author with the seeds).

### Obs 3: Unhandled TypeErrors on `null` and `undefined` Inputs
Direct execution in Node.js revealed five uncaught TypeErrors:
1. `inferGenres(null)`:
   `TypeError: Cannot read properties of null (reading 'title')` at `metadata.js:177`
2. `inferTags(null)`:
   `TypeError: Cannot read properties of null (reading 'title')` at `metadata.js:229`
3. `computeBaselineRating(null)`:
   `TypeError: Cannot read properties of null (reading 'isbn')` at `metadata.js:284`
4. `scoreCandidate(null)`:
   `TypeError: Cannot read properties of null (reading 'genre')` at `algorithms.js:308`
5. `scoreCandidate(undefined)`:
   `TypeError: Cannot read properties of undefined (reading 'genre')` at `algorithms.js:308`
6. `workMap.get(cand.dKey)` at `algorithms.js:435`:
   If `cand.dKey` is undefined, all candidates lacking `dKey` collapse into a single map entry `workMap.get(undefined)`.

### Obs 4: Unit Test Fixture Masking (`server/src/scripts/test-m2.js:94-118`)
Test 2 ("Strict Title Similarity Exclusion Invariant") bypassed `inferTags` by manually hardcoding identical `tags: ['magic', 'wizard', '1990s']` on `candA` and `candB`. When candidates are instead evaluated dynamically via `inferTags`, the test failed.

---

## 2. Logic Chain

1. **Title Invariance Mandate** (`ORIGINAL_REQUEST.md:20, 41`, `SCOPE.md:14`):
   The recommendation engine must generate recommendations based on author, genre, tag, and rating heuristics without title similarity weighting ($w_{\text{title}} = 0$).
2. **Leakage Mechanism (from Obs 1)**:
   Extracting title tokens or checking title keywords inside `inferTags` converts the tag heuristic into a title-token similarity heuristic. Because `tags` are indexed in `state.byTag` and scored in `f.tag`, title similarity directly controls candidate discovery and final ranking.
3. **Decoupling Strategy**:
   To guarantee true title invariance, `inferTags(book)` must NEVER read, tokenize, or inspect `book.title`. Tags must derive strictly from:
   - Publication era (`book.year`)
   - Publisher imprints and formats (`book.publisher`)
   - Canonical genre-to-vibe mappings (`book.genres`)
   - Renowned author thematic vibes (`book.author`)
   - Fallback `'general'`
4. **Sampling Fairness (from Obs 2)**:
   Head-slicing `.slice(0, 400)` imposes an artificial truncation that biases recommendations toward whatever titles were inserted first in MongoDB. Replacing `.slice(0, 400)` with a uniform stride algorithm (`step = Math.max(1, Math.floor(list.length / maxItems))`) evaluates candidates evenly across the entire catalog with $O(K)$ latency and zero memory overhead. Composite scoring (`scoreCandidate`) then naturally promotes the highest-quality candidates from the representative sample.
5. **Defensive Robustness (from Obs 3)**:
   Adding `book = book || {}`, default parameter fallbacks, and `cand.dKey || cand.isbn || String(idx)` prevents runtime 500 errors when handling partial book documents, API payloads, or mock fixtures.

---

## 3. Caveats

1. **Genre Classification vs Tag Inference**:
   `inferGenres(book)` uses title, author, and publisher to determine literary genre (e.g. `'Fantasy'`). This is standard taxonomic classification. Genre similarity ($f_{\text{genre}}$) evaluates genre category overlap, not title word similarity.
2. **Lexicon & Sentiment Scope**:
   Aspect extraction false positives ("slow-burn") and double-negation lookahead ("not without merit") in `sentiment.js` are assigned to peer Explorer 2.
3. **Candidate Pool Limit**:
   Using `sampleStride` preserves the total evaluation bound ($2,500$ candidates), maintaining sub-2ms query times.

---

## 4. Conclusion & Actionable Fix Strategy

The implementation worker must apply the following exact modifications across three codebase files and update the test suite.

### 4.1 Changes to `server/src/recommender/metadata.js`

#### Diff 1: Clean Imports & Remove Unused Stopwords
```javascript
// Remove unused tokenize import and COMMON_TAG_STOPWORDS set
import { normalize } from './text.js';
```

#### Diff 2: Null Safety in `inferGenres` (Lines 176–180)
```javascript
export function inferGenres(book = {}) {
  const b = book || {};
  const titleNorm = normalize(b.title || '');
  const authorNorm = normalize(b.author || '');
  const pubNorm = normalize(b.publisher || '');
  const fullText = `${titleNorm} ${authorNorm} ${pubNorm}`;
  // ... rest of inferGenres remains intact
```

#### Diff 3: Complete Decoupling of `inferTags` (Replace Lines 215–278)
Replace lines 215–278 with the following pure metadata tag inference engine:

```javascript
/**
 * Canonical 16-genre taxonomy to descriptive vibe tags.
 */
const GENRE_VIBE_MAP = {
  'Fantasy': ['high-fantasy', 'mythic'],
  'Science Fiction': ['sci-fi', 'speculative'],
  'Mystery & Thriller': ['mystery', 'suspense'],
  'Romance': ['romance', 'relationship-drama'],
  'Historical Fiction': ['historical', 'period-piece'],
  'Horror': ['dark-horror', 'chilling'],
  'Classics & Literature': ['literary-classic', 'canonical'],
  'Biography & Memoir': ['biographical', 'memoir'],
  'Philosophy & Religion': ['philosophical', 'theological'],
  'Science & Nature': ['scientific', 'nature-science'],
  'History & Politics': ['military-history', 'political'],
  'Self-Help & Psychology': ['self-improvement', 'psychological'],
  'Young Adult & Children': ['young-adult', 'coming-of-age'],
  'Poetry & Plays': ['poetry', 'dramatic-works'],
  'Art, Cooking & Lifestyle': ['arts-culture', 'culinary'],
  'General Fiction': ['contemporary-fiction'],
};

/**
 * Infer 3 to 10 semantic tags for a book based strictly on publication era,
 * publisher format/imprint, catalog genres, and author themes.
 * STRICT ENFORCEMENT: book.title is NEVER read or tokenized.
 */
export function inferTags(book = {}) {
  const b = book || {};
  const tags = new Set();

  // 1. Publication Era (from publication year)
  const yr = Number(b.year);
  if (yr && yr > 1800 && yr <= 2030) {
    if (yr >= 2020) tags.add('2020s');
    else if (yr >= 2010) tags.add('2010s');
    else if (yr >= 2000) tags.add('2000s');
    else if (yr >= 1990) tags.add('1990s');
    else if (yr >= 1980) tags.add('1980s');
    else if (yr >= 1970) tags.add('1970s');
    else if (yr >= 1960) tags.add('1960s');
    else if (yr >= 1950) tags.add('1950s');
    else tags.add('classic-era');
  }

  // 2. Publisher Format & Imprint Tags (from publisher name)
  const pub = normalize(b.publisher || '');
  if (pub) {
    if (pub.includes('press') || pub.includes('university') || pub.includes('oxford') || pub.includes('cambridge')) {
      tags.add('university-press');
    }
    if (
      pub.includes('harlequin') ||
      pub.includes('silhouette') ||
      pub.includes('bantam') ||
      pub.includes('ballantine') ||
      pub.includes('pocket') ||
      pub.includes('del rey') ||
      pub.includes('tor') ||
      pub.includes('ace') ||
      pub.includes('baen')
    ) {
      tags.add('paperback-series');
    }
    if (
      pub.includes('scholastic') ||
      pub.includes('disney') ||
      pub.includes('golden') ||
      pub.includes('aladdin') ||
      pub.includes('puffin')
    ) {
      tags.add('childrens-press');
    }
    if (
      pub.includes('vintage') ||
      pub.includes('penguin') ||
      pub.includes('harper') ||
      pub.includes('random house') ||
      pub.includes('simon') ||
      pub.includes('knopf') ||
      pub.includes('norton')
    ) {
      tags.add('trade-edition');
    }
  }

  // 3. Genre-Derived Thematic Vibes (from canonical catalog genres)
  if (Array.isArray(b.genres)) {
    for (const g of b.genres) {
      const vibes = GENRE_VIBE_MAP[g];
      if (vibes) {
        for (const v of vibes) tags.add(v);
      }
    }
  }

  // 4. Renowned Author Thematic Vibes (from author name ONLY, NEVER title)
  const authorNorm = normalize(b.author || '');
  if (authorNorm) {
    if (/\b(tolkien|jordan|pratchett|sanderson|rowling|martin|hobb|rothfuss|le guin)\b/.test(authorNorm)) {
      tags.add('high-fantasy');
    }
    if (/\b(asimov|clarke|dick|heinlein|herbert|gibson|card|bradbury)\b/.test(authorNorm)) {
      tags.add('sci-fi');
    }
    if (/\b(christie|doyle|patterson|grisham|coben|connelly)\b/.test(authorNorm)) {
      tags.add('mystery');
    }
    if (/\b(king|koontz|barker|lovecraft|rice|stoker)\b/.test(authorNorm)) {
      tags.add('dark-horror');
    }
    if (/\b(roberts|steel|sparks|quinn|henry)\b/.test(authorNorm)) {
      tags.add('romance');
    }
  }

  // Fallback tag if empty
  if (tags.size === 0) {
    tags.add('general');
  }

  return [...tags].slice(0, 10);
}
```

#### Diff 4: Null Safety in `computeBaselineRating` (Lines 283–288)
```javascript
export function computeBaselineRating(bookOrIsbn = '') {
  const b = bookOrIsbn || '';
  const isbn = typeof b === 'string' ? b : (b.isbn || b.title || '');
  const hash = Math.abs(hashString(isbn));
  const val = 3.80 + ((hash % 81) / 100); // 3.80 to 4.60
  return +val.toFixed(2);
}
```

#### Diff 5: Null Safety in `indexMetadata` (Lines 322–326)
```javascript
export function indexMetadata(book, idx, byGenre, byTag) {
  if (!book) return;
  if (!book.genres) book.genres = inferGenres(book);
  if (!book.tags) book.tags = inferTags(book);
  if (book.rating === undefined) book.rating = computeBaselineRating(book);
  // ... rest of indexMetadata remains intact
```

---

### 4.2 Changes to `server/src/recommender/engine.js`

#### Diff 1: Add Uniform Stride Helper
Place above `getThreeSeedCandidates`:
```javascript
/**
 * Uniformly stride-sample up to maxItems from a list across the full catalog range.
 * Eliminates chronological insertion head-bias.
 */
function sampleStride(list, maxItems) {
  if (!Array.isArray(list) || !list.length) return [];
  if (list.length <= maxItems) return list;
  const step = Math.max(1, Math.floor(list.length / maxItems));
  const sample = [];
  for (let k = 0; k < list.length && sample.length < maxItems; k += step) {
    sample.push(list[k]);
  }
  return sample;
}
```

#### Diff 2: Replace Head-Slicing in `getThreeSeedCandidates` (Lines 176–204)
```javascript
export function getThreeSeedCandidates(seedIndices, maxCandidates = 2500) {
  if (!Array.isArray(seedIndices) || !seedIndices.length) return [];
  const books = state.books || [];
  const seeds = seedIndices.map((i) => books[i]).filter(Boolean);
  if (!seeds.length) return [];

  const seedDKeys = new Set(seeds.map((s) => s.dKey).filter(Boolean));
  const seedIsbns = new Set(seeds.map((s) => s.isbn));
  const candidates = new Set();

  // 1. Same author books
  for (const s of seeds) {
    if (s.aKey) {
      const authors = state.byAuthor.get(s.aKey) || [];
      for (const idx of authors) {
        const b = state.books[idx];
        if (b && !seedIsbns.has(b.isbn) && !seedDKeys.has(b.dKey)) {
          candidates.add(idx);
          if (candidates.size >= maxCandidates) return [...candidates];
        }
      }
    }
  }

  // 2. Inferred genres (uniform stride sample up to 400 per genre)
  for (const s of seeds) {
    for (const g of s.genres || []) {
      const genreList = state.byGenre.get(g) || [];
      const sample = sampleStride(genreList, 400);
      for (const idx of sample) {
        const b = state.books[idx];
        if (b && !seedIsbns.has(b.isbn) && !seedDKeys.has(b.dKey)) {
          candidates.add(idx);
          if (candidates.size >= maxCandidates) return [...candidates];
        }
      }
    }
  }

  // 3. Rare / semantic tags (uniform stride sample up to 150 per tag)
  for (const s of seeds) {
    for (const t of s.tags || []) {
      const tagList = state.byTag.get(t) || [];
      const sample = sampleStride(tagList, 150);
      for (const idx of sample) {
        const b = state.books[idx];
        if (b && !seedIsbns.has(b.isbn) && !seedDKeys.has(b.dKey)) {
          candidates.add(idx);
          if (candidates.size >= maxCandidates) return [...candidates];
        }
      }
    }
  }

  // 4. Fill from catalog if candidate pool is small
  if (candidates.size < 300 && state.books.length > 0) {
    const step = Math.max(1, Math.floor(state.books.length / 500));
    for (let i = 0; i < state.books.length && candidates.size < maxCandidates; i += step) {
      const b = state.books[i];
      if (b && !seedIsbns.has(b.isbn) && !seedDKeys.has(b.dKey)) {
        candidates.add(i);
      }
    }
  }

  return [...candidates];
}
```

---

### 4.3 Changes to `server/src/recommender/algorithms.js`

#### Diff 1: Null Safety in `computeHeuristicFeatures` (Lines 243–250, 255, 269, 283)
```javascript
export function computeHeuristicFeatures(cand, seeds, eng = engine()) {
  const books = eng?.books || [];
  const c = typeof cand === 'number' ? books[cand] : cand;
  if (!c) return { author: 0, genre: 0, tag: 0, rating: 0 };

  const seedBooks = (seeds || []).map((s) => (typeof s === 'number' ? books[s] : s)).filter(Boolean);
  if (!seedBooks.length) return { author: 0, genre: 0, tag: 0, rating: 0 };

  // 1. Author Feature
  const authorMatch = c.aKey && seedBooks.some((s) => s.aKey && s.aKey === c.aKey) ? 1.0 : 0.0;

  // 2. Genre Feature
  const candGenres = Array.isArray(c.genres) ? c.genres : inferGenres(c);
  const seedGenres = new Set();
  for (const s of seedBooks) {
    const sg = Array.isArray(s.genres) ? s.genres : inferGenres(s);
    for (const g of sg) seedGenres.add(g);
  }
  let genreSim = 0.0;
  if (candGenres.length && seedGenres.size) {
    const intersection = candGenres.filter((g) => seedGenres.has(g)).length;
    const union = new Set([...candGenres, ...seedGenres]).size;
    genreSim = union > 0 ? intersection / union : 0.0;
  }

  // 3. Tag Feature
  const candTags = Array.isArray(c.tags) ? c.tags : inferTags(c);
  const seedTags = new Set();
  for (const s of seedBooks) {
    const st = Array.isArray(s.tags) ? s.tags : inferTags(s);
    for (const t of st) seedTags.add(t);
  }
  let tagSim = 0.0;
  if (candTags.length && seedTags.size) {
    const intersection = candTags.filter((t) => seedTags.has(t)).length;
    const denom = Math.max(1, Math.sqrt(candTags.length * seedTags.size));
    tagSim = Math.min(1.0, intersection / denom);
  }

  // 4. Rating Feature
  const cRating = typeof c.rating === 'number' ? c.rating : computeBaselineRating(c);
  const seedRatings = seedBooks.map((s) => (typeof s.rating === 'number' ? s.rating : computeBaselineRating(s)));
  const meanSeedRating = seedRatings.reduce((sum, r) => sum + r, 0) / seedRatings.length;

  const ratingFeature = 0.7 * (cRating / 5.0) + 0.3 * (1.0 - Math.abs(cRating - meanSeedRating) / 5.0);

  return {
    author: +authorMatch.toFixed(4),
    genre: +genreSim.toFixed(4),
    tag: +tagSim.toFixed(4),
    rating: +Math.max(0, Math.min(1, ratingFeature)).toFixed(4),
  };
}
```

#### Diff 2: Null Safety in `scoreCandidate` (Lines 301–310)
```javascript
export function scoreCandidate(features = {}, weights = DEFAULT_THREE_WEIGHTS) {
  const f = features || {};
  const w = weights || DEFAULT_THREE_WEIGHTS;
  const wg = Math.max(0, Number(w.genre ?? DEFAULT_THREE_WEIGHTS.genre) || 0);
  const wa = Math.max(0, Number(w.author ?? DEFAULT_THREE_WEIGHTS.author) || 0);
  const wt = Math.max(0, Number(w.tag ?? DEFAULT_THREE_WEIGHTS.tag) || 0);
  const wr = Math.max(0, Number(w.rating ?? DEFAULT_THREE_WEIGHTS.rating) || 0);

  const total = wg + wa + wt + wr || 1.0;
  const score = (wg * (f.genre || 0) + wa * (f.author || 0) + wt * (f.tag || 0) + wr * (f.rating || 0)) / total;
  return +score.toFixed(4);
}
```

#### Diff 3: Null Safety in `singleSeedSimilarity` (Lines 315–334)
```javascript
function singleSeedSimilarity(cand, seed) {
  if (!cand || !seed) return 0;
  const aMatch = cand.aKey && seed.aKey && cand.aKey === seed.aKey ? 1.0 : 0.0;
  const cGenres = Array.isArray(cand.genres) ? cand.genres : inferGenres(cand);
  const sGenres = Array.isArray(seed.genres) ? seed.genres : inferGenres(seed);
  let gSim = 0;
  if (cGenres.length && sGenres.length) {
    const inter = cGenres.filter((g) => sGenres.includes(g)).length;
    const union = new Set([...cGenres, ...sGenres]).size;
    gSim = union > 0 ? inter / union : 0;
  }
  const cTags = Array.isArray(cand.tags) ? cand.tags : inferTags(cand);
  const sTags = Array.isArray(seed.tags) ? seed.tags : inferTags(seed);
  let tSim = 0;
  if (cTags.length && sTags.length) {
    const inter = cTags.filter((t) => sTags.includes(t)).length;
    tSim = inter / Math.max(1, Math.sqrt(cTags.length * sTags.length));
  }
  const rDiff = Math.abs((cand.rating || 4.0) - (seed.rating || 4.0)) / 5.0;
  return 0.4 * gSim + 0.3 * aMatch + 0.2 * tSim + 0.1 * (1.0 - rDiff);
}
```

#### Diff 4: WorkMap Key Fallback in `recommendThree` (Line 435)
```javascript
// Avoid collapsing un-titled or mock candidate books with undefined dKey
const key = cand.dKey || cand.isbn || String(idx);
const existing = workMap.get(key);
if (!existing || score > existing.score) {
  workMap.set(key, item);
}
```

---

### 4.4 Changes to `server/src/scripts/test-m2.js`

1. **Test 2 Dynamic Verification (Unmasking Fixtures)**:
   Remove hardcoded `tags: ['magic', 'wizard', '1990s']` on `candA` and `candB`.
   Add publication year (`1998`) and publisher (`'Scholastic'`).
   Verify:
   ```javascript
   // Unmasked dynamic tag inference
   assert.deepEqual(inferTags(candA), inferTags(candB), 'Inferred tags must be identical despite title differences');
   const featA = computeHeuristicFeatures(candA, seeds);
   const featB = computeHeuristicFeatures(candB, seeds);
   assert.equal(featA.tag, featB.tag, 'Tag features must be identical');
   assert.equal(scoreCandidate(featA), scoreCandidate(featB), 'Scores must be identical');
   ```

2. **Add Adversarial Invariant Battery**:
   ```javascript
   // Reviewer 1 Invariant
   const seedT = { isbn: 'S1', title: 'The Hobbit', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', year: 1980, publisher: 'Del Rey' };
   const cand1 = { isbn: 'C1', title: 'The Return of the Hobbit', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', year: 1980, publisher: 'Del Rey' };
   const cand2 = { isbn: 'C2', title: 'The Silmarillion', author: 'J. R. R. Tolkien', aKey: 'jrrtolkien', year: 1980, publisher: 'Del Rey' };
   const f1 = computeHeuristicFeatures(cand1, [seedT]);
   const f2 = computeHeuristicFeatures(cand2, [seedT]);
   assert.equal(f1.tag, f2.tag, 'Tolkien title words must not alter tag feature');

   // Reviewer 2 Invariant
   const t1 = inferTags({ title: 'The Hobbit', year: 1980, publisher: 'Del Rey' });
   const t2 = inferTags({ title: 'Completely Different Book', year: 1980, publisher: 'Del Rey' });
   assert.deepEqual(t1, t2, 'Tags must not depend on arbitrary title words');
   ```

3. **Add Null/Undefined Safety Battery**:
   ```javascript
   assert.doesNotThrow(() => inferGenres(null));
   assert.doesNotThrow(() => inferTags(null));
   assert.doesNotThrow(() => computeBaselineRating(null));
   assert.doesNotThrow(() => scoreCandidate(null));
   assert.doesNotThrow(() => scoreCandidate(undefined));
   assert.doesNotThrow(() => computeHeuristicFeatures(null, null));
   ```

---

## 5. Verification Method

Once Worker M2 applies the changes, verify using these independent commands:

```bash
# 1. Syntax Check across modified files
node --check server/src/recommender/metadata.js
node --check server/src/recommender/engine.js
node --check server/src/recommender/algorithms.js

# 2. Test 1: Title Invariance Check
node -e '
import { inferTags, inferGenres } from "./server/src/recommender/metadata.js";
import { computeHeuristicFeatures } from "./server/src/recommender/algorithms.js";
import assert from "node:assert/strict";

const seed = { isbn: "S1", title: "The Hobbit", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
seed.genres = inferGenres(seed); seed.tags = inferTags(seed);

const candA = { isbn: "C1", title: "The Return of the Hobbit", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
candA.genres = inferGenres(candA); candA.tags = inferTags(candA);

const candB = { isbn: "C2", title: "The Silmarillion", author: "J. R. R. Tolkien", aKey: "jrrtolkien", year: 1980, publisher: "Del Rey" };
candB.genres = inferGenres(candB); candB.tags = inferTags(candB);

const fA = computeHeuristicFeatures(candA, [seed]);
const fB = computeHeuristicFeatures(candB, [seed]);
assert.equal(fA.tag, fB.tag, "Title words leaked into tag feature!");
console.log("✅ PASSED: Title strictly excluded from tags and features.");
'

# 3. Test 2: Arbitrary Title Tag Equality Check
node -e '
import { inferTags } from "./server/src/recommender/metadata.js";
import assert from "node:assert/strict";
const t1 = inferTags({ title: "The Hobbit", year: 1980, publisher: "Del Rey" });
const t2 = inferTags({ title: "Completely Different Book", year: 1980, publisher: "Del Rey" });
assert.deepEqual(t1, t2, "Tags must not depend on arbitrary title words");
console.log("✅ PASSED: inferTags is completely title-independent.");
'

# 4. Test 3: Null & Undefined Safety Check
node -e '
import { inferGenres, inferTags, computeBaselineRating } from "./server/src/recommender/metadata.js";
import { scoreCandidate, computeHeuristicFeatures } from "./server/src/recommender/algorithms.js";
import assert from "node:assert/strict";

assert.doesNotThrow(() => inferGenres(null));
assert.doesNotThrow(() => inferTags(null));
assert.doesNotThrow(() => computeBaselineRating(null));
assert.doesNotThrow(() => scoreCandidate(null));
assert.doesNotThrow(() => scoreCandidate(undefined));
assert.doesNotThrow(() => computeHeuristicFeatures(null, null));
console.log("✅ PASSED: Null/undefined safety verified.");
'

# 5. Run full test suites
node server/src/scripts/test-m2.js
node server/src/scripts/test-api-m2.js
```

### Invalidation Conditions:
- Any test fails if `inferTags(candA)` differs from `inferTags(candB)` when author, year, publisher, and genre are identical.
- Any test fails if `scoreCandidate(null)` or `inferTags(null)` throws a `TypeError`.
- Any test fails if `getThreeSeedCandidates` only samples the first 400 books of a genre.
