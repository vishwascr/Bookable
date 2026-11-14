# Milestone 2 Round 2 Fix Strategy: Sentiment Analyzer (`sentiment.js`)

**Agent**: `teamwork_explorer_m2_r2_2` (Explorer 2)  
**Parent Conversation ID**: `5b5e5d28-614b-498e-b981-66f748495970`  
**State Folder**: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_m2_r2_2`  
**Target File**: `server/src/recommender/sentiment.js` (and auxiliary `server/src/routes/reviews.js`)  
**Date**: 2026-11-13T19:28:00Z  

---

## 1. Observation

### 1.1 Empirical Defect Reproduction
Running `node server/src/scripts/challenge-sentiment.js` exits with code `1` and prints 2 explicit test failures:

```
⚔️  CHALLENGER 2: Starting Adversarial Empirical Stress Tests...

--- SECTION 1: Adversarial Linguistic Test Battery ---
  ✅ [PASS] Pure Positive: "A breathtaking masterpiece of storytelling."
  ✅ [PASS] Pure Negative: "An unreadable, boring waste of paper."
  ❌ [FAIL] Double Negation: "It is not without merit." -> assert polarity > 0 -> Expected polarity > 0.0, observed: 0 (lexiconMatches: 0, label: "neutral")
  ❌ [FAIL] Double Negation: "It is not without genius." -> assert polarity > 0 -> Expected polarity > 0.0, observed: -0.586 (classified as: "negative", negators: ["not"])
  ✅ [PASS] Double Negation: "It is not unreadable." (negator + negative word)
  ✅ [PASS] Negated Positive: "Not good, not captivating at all."
  ✅ [PASS] Negated Negative: "Not boring, not dull."
...
📊 CHALLENGE SUMMARY: 19 PASSED | 2 FAILED
🏁 FINAL VERDICT: REQUEST_CHANGES
```

### 1.2 Missing Export Contract Mismatch
In `server/src/routes/reviews.js:86-91`:
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
In `server/src/recommender/sentiment.js:135`:
```javascript
export function analyzeReviewSentiment(text, starRating = null) {
```
Running `node -e 'import("./server/src/recommender/sentiment.js").then(m => console.log(typeof m.analyzeSentiment))'` outputs:
```
undefined
```
Because `analyzeSentiment` is `undefined`, `reviews.js` silently executes the fallback stub `computeSentiment(rating, text)`, completely bypassing the 250-term literary lexicon, negation logic, aspect extraction, and star calibration when real users submit reviews.

### 1.3 Lexicon Omission for Literary Merit
In `server/src/recommender/sentiment.js:22-31` (`LITERARY_LEXICON`), the term `merit` is absent.
Evaluating `"It is not without merit."`:
`rawTokens = ['it', 'is', 'not', 'without', 'merit']`.
Because `LITERARY_LEXICON['merit'] === undefined`, `scoreAccumulator` remains `0`, `textPolarity = 0.0`, and composite polarity is `0.0` (`neutral`), failing the DISPATCH requirement `assert polarity > 0.0`.

### 1.4 Lookback Window Early Break Inverting Double Negations
In `server/src/recommender/sentiment.js:159-169`:
```javascript
// Look back for active negator within 3 tokens
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
When evaluating token `'genius'` in `"It is not without genius."`:
`rawTokens = ['it', 'is', 'not', 'without', 'genius']`.
At index $i = 4$, the lookback scans $j \in [1, 3]$:
- At $j = 2$: `rawTokens[2] = 'not'`. `NEGATORS.has('not')` is `true`.
- The code sets `isNegated = true`, pushes `'not'`, and executes `break;`.
- The loop terminates immediately, skipping `rawTokens[3] = 'without'`.
- The code applies `multiplier *= -0.80` to `'genius'` (valence $+3.5$), resulting in `weightedValence = -2.80` and `polarity = -0.586` (negative classification).

### 1.5 Aspect Extraction False Positives via Substring Matching
In `server/src/recommender/sentiment.js:83-120` and `266-340`:
All aspect category checks use unanchored substring matching:
```javascript
// server/src/recommender/sentiment.js:272, 276, 280, 311
if (def.slowBurnTerms.some((t) => lowerText.includes(t))) {
  tags.add('slow-burn');
  breakdown['slow-burn'] = docPolarity >= 0 ? 'positive' : 'neutral';
}
if (def.slowDragTerms.some((t) => lowerText.includes(t))) {
  tags.add('slow-dragging');
  breakdown['slow-dragging'] = 'negative';
}
...
if (def.triggers.some((t) => lowerText.includes(t))) {
  tags.add('world-building');
  breakdown['world-building'] = docPolarity >= 0 ? 'positive' : 'neutral';
}
```
1. **`slow-burn` collision**: `def.slowDragTerms` includes `'slow'`. `"wonderful slow-burn romance".includes('slow')` returns `true`, simultaneously adding `slow-burn: 'positive'` and `slow-dragging: 'negative'`. In `adaptRecommendationsBySentiment`, `criticizedAspects` picks up `slow-dragging` and triggers `negative_contrast` mode.
2. **`explores` collision**: `def.triggers` for `world-building` includes `'lore'`. `"The author explores human grief".includes('lore')` returns `true` (exp**lore**s), erroneously tagging `world-building`.
3. **`upsetting` collision**: `def.triggers` for `world-building` includes `'setting'`. `"An upsetting and grim tragedy".includes('setting')` returns `true` (up**setting**), erroneously tagging `world-building`.

---

## 2. Logic Chain

1. **Integration Failure**:
   - `reviews.js:88` checks for `sentimentModule.analyzeSentiment`.
   - `sentiment.js` exports only `analyzeReviewSentiment`.
   - Result: `reviews.js` falls back to `computeSentiment(rating, text)`.
   - Logic: Aliasing `analyzeSentiment = analyzeReviewSentiment` in `sentiment.js` immediately resolves the contract mismatch.

2. **Lexicon Omission**:
   - "merit" is an established literary term used in litotes ("not without merit").
   - Valences in Moderate Positive range from $+1.5$ to $+2.9$.
   - Adding `merit: 2.5` provides a valence for the token, allowing `scoreAccumulator` to score the phrase.

3. **Double Negation Dynamics**:
   - Double negation with consecutive negators (e.g. "not without") represents litotes—an affirmative statement of praise, though slightly attenuated compared to superlative acclaim.
   - In single negation ("not good"), `multiplier *= -0.80` inverts positive to negative.
   - In double negation, two negators cancel out: $(-0.80) \times (-0.80) = +0.64 \approx 0.65$.
   - When scanning backward from $j = i - 1$ down to $\max(0, i - 3)$, the scan must:
     a) Stop if an intervening word in `LITERARY_LEXICON` is encountered (preventing "not good, not captivating" from bleeding `good`'s negator into `captivating`).
     b) Accumulate all active negators in the immediate window.
     c) If `negatorCount % 2 === 1`: apply single negation (`multiplier *= -0.80`).
     d) If `negatorCount >= 2` (or even): apply double negation litotes (`multiplier *= 0.65`).

4. **Aspect Extraction Boundary Anchoring**:
   - Raw `.includes(t)` matches substrings inside words (`exp-lore-s`, `up-setting`).
   - Using word boundary lookarounds `(?<![a-z0-9-])${escaped}(?![a-z0-9-])`:
     - Prevents `lore` from matching `explores` because `p` is preceded in `[a-z0-9-]`.
     - Prevents `setting` from matching `upsetting` because `p` is preceded in `[a-z0-9-]`.
   - For `slow`, standard `\b` fails on `slow-burn` because hyphen `-` is a non-word character (`\w` does not include `-`).
   - Furthermore, reviews may write `"slow burn"` (with space) or `"slow-burn"` (with hyphen).
   - Therefore, the pattern for `slow` must explicitly reject following burn words: `/(?<![a-z0-9-])slow(?!([\s-]+burn)|[a-z0-9-])/i`.
   - To ensure explicit coverage for actual negative drag phrases, add `'slow-dragging'` and `'slow dragging'` to `slowDragTerms`.
   - Precompiling / caching the regexes in a `Map` guarantees sub-millisecond execution ($0.19\text{ ms/review} \ll 1.0\text{ ms}$).

---

## 3. Caveats

1. **Title Similarity Leakage in `metadata.js` / `engine.js`**:
   - Title similarity issues (`inferTags` tokenizing `book.title`) and candidate head-slicing in `engine.js` are investigated separately by Explorer 1.
   - This strategy strictly focuses on `server/src/recommender/sentiment.js` and its integration with `server/src/routes/reviews.js`.
2. **Read-Only Constraint**:
   - Explorer 2 made no direct edits to production code files. All proposed changes were empirically verified via isolated in-memory test scripts.

---

## 4. Conclusion & Actionable Fix Strategy

The worker must apply the following 4 precise modifications:

### 4.1 Fix 1: Export `analyzeSentiment` Alias in `server/src/recommender/sentiment.js`

**Location**: `server/src/recommender/sentiment.js`  
**Target Lines**: Around line 135 or end of file.

**Proposed Code Change**:
Export `analyzeSentiment` alongside `analyzeReviewSentiment`:

```javascript
// In server/src/recommender/sentiment.js:
export function analyzeReviewSentiment(text, starRating = null) {
  // ... implementation ...
}

// Alias for integration compatibility across routes (e.g. server/src/routes/reviews.js)
export const analyzeSentiment = analyzeReviewSentiment;
```
Or as a combined export statement:
```javascript
export { analyzeReviewSentiment, analyzeReviewSentiment as analyzeSentiment };
```

*(Optional defense-in-depth in `server/src/routes/reviews.js:87-90`)*:
```javascript
const sentimentModule = await import('../recommender/sentiment.js');
const analyzer = sentimentModule.analyzeSentiment || sentimentModule.analyzeReviewSentiment;
if (typeof analyzer === 'function') {
  sentiment = analyzer(text, rating);
}
```

---

### 4.2 Fix 2: Add `merit: 2.5` to `LITERARY_LEXICON`

**Location**: `server/src/recommender/sentiment.js:22-31`  
**Section**: `// Moderate Positive (+1.5 to +2.9)`

**Proposed Code Change**:
```javascript
<<<< BEFORE (lines 22-26)
  // Moderate Positive (+1.5 to +2.9)
  great: 2.5, good: 2.0, enjoyable: 2.2, engaging: 2.3, delightful: 2.4, charming: 2.3,
  witty: 2.2, thoughtful: 2.2, clever: 2.2, imaginative: 2.4, insightful: 2.5, entertaining: 2.2,
====
>>>> AFTER
  // Moderate Positive (+1.5 to +2.9)
  merit: 2.5, great: 2.5, good: 2.0, enjoyable: 2.2, engaging: 2.3, delightful: 2.4, charming: 2.3,
  witty: 2.2, thoughtful: 2.2, clever: 2.2, imaginative: 2.4, insightful: 2.5, entertaining: 2.2,
====
```

---

### 4.3 Fix 3: Fix Lookback Window Double Negation Handling

**Location**: `server/src/recommender/sentiment.js:159-169`  
**Section**: Inside `for (let i = 0; i < rawTokens.length; i++)` loop in `analyzeReviewSentiment`

**Proposed Code Change**:
Replace the single-negator early break with a backward-scanning lookback that collects negators until a prior lexicon word is encountered, properly applying double negation affirmation:

```javascript
<<<< BEFORE (lines 159-169)
    // Look back for active negator within 3 tokens
    let isNegated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(rawTokens[j])) {
        isNegated = true;
        negatorsDetected.push(rawTokens[j]);
        break;
      }
    }
    if (isNegated) multiplier *= -0.80;
====
>>>> AFTER
    // Look back for active negators within 3 tokens (scanning backward, stopping at prior lexicon word)
    const windowNegators = [];
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (LITERARY_LEXICON[rawTokens[j]] !== undefined) break; // Belongs to prior sentiment clause
      if (NEGATORS.has(rawTokens[j])) {
        windowNegators.unshift(rawTokens[j]);
      }
    }
    if (windowNegators.length > 0) {
      negatorsDetected.push(...windowNegators);
      if (windowNegators.length % 2 === 1) {
        multiplier *= -0.80; // Single negation: invert valence
      } else {
        multiplier *= 0.65;  // Double negation ("not without X"): affirms positive acclaim
      }
    }
====
```

---

### 4.4 Fix 4: Aspect Extraction Word Boundary Anchoring & Slow-Burn Isolation

**Location**: `server/src/recommender/sentiment.js:83-120` and `266-342`  
**Section**: `ASPECT_DEFINITIONS` and `extractAspects`

**Proposed Code Change**:

1. In `ASPECT_DEFINITIONS` (line 88), add `'slow-dragging'` and `'slow dragging'` to `slowDragTerms`:
```javascript
<<<< BEFORE (line 88)
    slowDragTerms: ['slow', 'plodding', 'dragged', 'dragging', 'slog', 'sluggish', 'crawls', 'tedious'],
====
>>>> AFTER
    slowDragTerms: ['slow', 'slow-dragging', 'slow dragging', 'plodding', 'dragged', 'dragging', 'slog', 'sluggish', 'crawls', 'tedious'],
====
```

2. Introduce cached term-matching regex helper right above `extractAspects`:
```javascript
const ASPECT_TERM_REGEX_CACHE = new Map();

/**
 * Matches an aspect trigger term against lowerText using word boundaries.
 * Prevents "explores" from matching "lore", "upsetting" from matching "setting",
 * and "slow-burn" / "slow burn" from triggering lone "slow".
 */
function matchesAspectTerm(text, term) {
  let re = ASPECT_TERM_REGEX_CACHE.get(term);
  if (!re) {
    if (term === 'slow') {
      // Matches "slow" but excludes "slow-burn", "slow burn", and "slow-burning"
      re = /(?<![a-z0-9-])slow(?!([\s-]+burn)|[a-z0-9-])/i;
    } else {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`(?<![a-z0-9-])${escaped}(?![a-z0-9-])`, 'i');
    }
    ASPECT_TERM_REGEX_CACHE.set(term, re);
  }
  return re.test(text);
}
```

3. In `extractAspects`, replace `.includes(t)` with `matchesAspectTerm(lowerText, t)`:
```javascript
function extractAspects(lowerText, docPolarity) {
  const tags = new Set();
  const breakdown = {};

  for (const def of ASPECT_DEFINITIONS) {
    if (def.category === 'pacing') {
      if (def.fastTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('fast-paced');
        breakdown['fast-paced'] = 'positive';
      }
      if (def.slowBurnTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('slow-burn');
        breakdown['slow-burn'] = docPolarity >= 0 ? 'positive' : 'neutral';
      }
      if (def.slowDragTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('slow-dragging');
        breakdown['slow-dragging'] = 'negative';
      }
    } else if (def.category === 'characters') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('character-driven');
        breakdown['character-driven'] = 'positive';
      }
      if (def.flatTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('flat-characters');
        breakdown['flat-characters'] = 'negative';
      }
    } else if (def.category === 'tone') {
      if (def.darkTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('dark-tone');
        breakdown['dark-tone'] = 'neutral';
      }
      if (def.cozyTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('cozy');
        breakdown['cozy'] = 'positive';
      }
      if (def.humorTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('humorous');
        breakdown['humorous'] = 'positive';
      }
      if (def.philTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('philosophical');
        breakdown['philosophical'] = 'positive';
      }
    } else if (def.category === 'world-building') {
      if (def.triggers.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('world-building');
        breakdown['world-building'] = docPolarity >= 0 ? 'positive' : 'neutral';
      }
    } else if (def.category === 'prose') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('lyrical-prose');
        breakdown['lyrical-prose'] = 'positive';
      }
      if (def.flawTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('purple-prose');
        breakdown['purple-prose'] = 'negative';
      }
    } else if (def.category === 'plot') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('gripping-plot');
        breakdown['gripping-plot'] = 'positive';
      }
      if (def.flawTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('predictable-plot');
        breakdown['predictable-plot'] = 'negative';
      }
    } else if (def.category === 'emotional') {
      if (def.triggers.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('emotional');
        breakdown['emotional'] = 'positive';
      }
    }
  }

  return { tags: [...tags], breakdown };
}
```

---

## 5. Verification Method

Once the worker implements the proposed strategy, independently verify through the following commands:

### 5.1 Syntax Verification
```bash
node --check server/src/recommender/sentiment.js
node --check server/src/routes/reviews.js
```

### 5.2 Challenger Adversarial Empirical Test Battery
```bash
node server/src/scripts/challenge-sentiment.js
```
**Expected Result**:
- `Exit Code`: `0`
- `21 PASSED | 0 FAILED`
- `🏁 FINAL VERDICT: APPROVE`
- Latency `< 1.0 ms/review` (~0.19 ms/review)

### 5.3 Export Contract Verification
```bash
node -e '
import("./server/src/recommender/sentiment.js").then((m) => {
  if (typeof m.analyzeSentiment !== "function") {
    console.error("FAIL: analyzeSentiment is not exported as a function!");
    process.exit(1);
  }
  console.log("PASS: analyzeSentiment export is verified as a function.");
});
'
```

### 5.4 Aspect Boundary Isolation Verification
```bash
node -e '
import { analyzeReviewSentiment } from "./server/src/recommender/sentiment.js";

// Test 1: slow-burn should NOT trigger slow-dragging
const r1 = analyzeReviewSentiment("A wonderful slow-burn romance with great tension.");
if (r1.aspects.includes("slow-dragging")) {
  console.error("FAIL: slow-burn triggered slow-dragging!", r1.aspects);
  process.exit(1);
}
if (!r1.aspects.includes("slow-burn")) {
  console.error("FAIL: slow-burn aspect not detected!", r1.aspects);
  process.exit(1);
}

// Test 2: explores should NOT trigger world-building
const r2 = analyzeReviewSentiment("The novel explores themes of loss and family.");
if (r2.aspects.includes("world-building")) {
  console.error("FAIL: explores triggered world-building!", r2.aspects);
  process.exit(1);
}

// Test 3: upsetting should NOT trigger world-building
const r3 = analyzeReviewSentiment("An upsetting portrayal of tragedy.");
if (r3.aspects.includes("world-building")) {
  console.error("FAIL: upsetting triggered world-building!", r3.aspects);
  process.exit(1);
}

// Test 4: Genuine world-building should still be detected
const r4 = analyzeReviewSentiment("Breathtaking world-building and rich fantasy lore.");
if (!r4.aspects.includes("world-building")) {
  console.error("FAIL: genuine world-building not detected!", r4.aspects);
  process.exit(1);
}

console.log("PASS: All aspect boundary isolation checks succeeded.");
'
```

### 5.5 Existing Milestone 2 Regression Suites
```bash
node server/src/scripts/test-m2.js
node server/src/scripts/test-api-m2.js
```
Both must exit with code `0` and print all passes.
