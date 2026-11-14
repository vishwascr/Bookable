# Milestone 2 — Explorer 1 Investigation Report: 3-Seed Recommendation Heuristics & Engine Design

## 1. Executive Summary & Problem Boundary

The objective is to overhaul Bookable's recommendation engine to fulfill **Requirements R3 & AC3**:
1. **Strict Exclusion of Title Similarity**: Eliminate title similarity weighting ($w_{\text{title}} = 0$) from recommendation candidate generation and scoring.
2. **Metadata Heuristic Scoring**: Rank candidates using metadata signals: **Author**, **Genre**, **Tag**, and **Rating**.
3. **Metadata Inference & Tagging**: Overcome the limitation of `Books.csv` (which lacks genre and tag fields) by introducing an on-device rule-based metadata inference classifier (`server/src/recommender/metadata.js`).
4. **Candidate Generation Overhaul**: Replace title token inverted-index scans (`titleNeighbours`) with candidate generation based on author, inferred genre, and semantic tags.
5. **Seed Diversity Re-Ranking**: Implement greedy diversity re-ranking to prevent a single seed or prolific author from dominating the 3-seed recommendations.

---

## 2. Existing Codebase Audit & Mapping

### 2.1 `server/src/models/Book.js`
- **Current State**:
  ```javascript
  const bookSchema = new mongoose.Schema({
    isbn: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    year: { type: Number, default: null },
    publisher: { type: String, default: '' },
    imageS: String, imageM: String, imageL: String,
  }, { versionKey: false });
  ```
- **Observations**:
  - The schema contains only catalog bibliographic fields.
  - There are **no fields** for genres, tags, or ratings in MongoDB or `Books.csv`.
  - In-memory indexing in `engine.js` loads all records into `state.books`.

### 2.2 `server/src/recommender/engine.js`
- **Current State**:
  - Maintains `state`: `books[]`, `vectors[]` (TF-IDF title vectors), `postings` (Map of tokenId $\to$ bookIdx[]), `vocab` (token $\to$ id), `idf[]`, `byAuthor` (Map of aKey $\to$ bookIdx[]), `byPublisher` (Map of pKey $\to$ bookIdx[]), `byIsbn` (Map of isbn $\to$ bookIdx).
  - `buildIndex()`: Streams 270,000+ books from MongoDB, computes title TF-IDF vectors, and builds inverted index postings.
  - `titleNeighbours(seed, maxDf = 15000)`: Accumulates cosine similarities by traversing postings of terms in the seed's title.
- **Flaws Identified**:
  - Candidate generation is almost entirely title-token driven.
  - No inverted indices exist for genres, tags, or ratings.

### 2.3 `server/src/recommender/algorithms.js`
- **Current State**:
  - `features(seed, cand)` calculates `{ title, author, publisher, year }` where `title: +cosine(seed, cand).toFixed(4)`.
  - `DEFAULT_WEIGHTS = { title: 0.45, author: 0.3, publisher: 0.15, year: 0.1 }`.
  - All five algorithms (`tfidf`, `author`, `publisher`, `year`, `hybrid`) incorporate `f.title`.
  - `recommendProfile(algoKey, seeds, ...)` computes per-seed scores using the selected algorithm and applies a greedy diversity penalty ($\delta = 0.85$).
- **Flaws Identified**:
  - Direct violation of R3: Title similarity is currently the heaviest weighted signal (0.45).
  - Genres, tags, and ratings are completely absent from the feature set.

---

## 3. Implementation Strategy: 3-Seed Recommendation Heuristic Engine

### 3.1 Strict Exclusion of Title Similarity ($w_{\text{title}} = 0$)
- **Enforcement Rules**:
  1. The feature computation function for 3-seed recommendations (`computeHeuristicFeatures`) must **not** compute TF-IDF cosine similarity or read `state.vectors`.
  2. The weight schema for `POST /api/recommend/three` strictly accepts only:
     ```json
     { "genre": 0.35, "author": 0.25, "tag": 0.25, "rating": 0.15 }
     ```
  3. If a request provides `w_title` or `weights.title`, the engine sets $w_{\text{title}} = 0$.
  4. Diagnostics response explicitly returns:
     ```json
     "diagnostics": {
       "seedCount": 3,
       "titleExcluded": true,
       "weightsUsed": { "genre": 0.35, "author": 0.25, "tag": 0.25, "rating": 0.15 }
     }
     ```

---

### 3.2 Metadata Inference & Classification (`server/src/recommender/metadata.js`)

Because `Books.csv` lacks genre and tag annotations, `metadata.js` must implement deterministic, fast on-device taxonomy mapping.

#### A. Genre Taxonomy (16 Primary Genres)
A rule-based classifier assigns 1–3 genres per book based on keyword tokens in `title`, `author`, and `publisher`:
1. **Fantasy**: `dragon`, `sword`, `magic`, `wizard`, `realm`, `chronicles`, `witch`, `quest`, `tolkien`, `jordan`, `pratchett`, `del rey`, `tor books`.
2. **Science Fiction**: `space`, `star`, `galaxy`, `alien`, `cyber`, `robot`, `future`, `planet`, `asimov`, `clarke`, `dick`, `heinlein`, `baen`.
3. **Mystery & Thriller**: `murder`, `death`, `homicide`, `detective`, `killer`, `crime`, `conspiracy`, `case`, `investigation`, `grisham`, `christie`, `patterson`.
4. **Romance**: `love`, `heart`, `passion`, `bride`, `kiss`, `romance`, `desire`, `forever`, `harlequin`, `silhouette`, `sparks`.
5. **Historical Fiction**: `war`, `empire`, `normandy`, `holocaust`, `medieval`, `century`, `rebellion`, `king`, `queen`, `victorian`.
6. **Horror**: `blood`, `nightmare`, `darkness`, `curse`, `ghost`, `haunted`, `shadow`, `vampire`, `stephen king`, `koontz`.
7. **Classics & Literature**: `oxford university press`, `cambridge`, `penguin classics`, `plume contemporary`, `shakespeare`, `homer`, `dostoevsky`, `dickens`.
8. **Biography & Memoir**: `memoir`, `biography`, `autobiography`, `diary`, `letters`, `life of`, `story of`.
9. **Philosophy & Religion**: `philosophy`, `ethics`, `god`, `theology`, `faith`, `soul`, `meditation`, `bible`, `buddha`.
10. **Science & Nature**: `physics`, `chemistry`, `biology`, `evolution`, `universe`, `influenza`, `pandemic`, `dinosaur`.
11. **History & Politics**: `history`, `revolution`, `politics`, `democracy`, `presidency`, `warfare`, `foreign affairs`.
12. **Self-Help & Psychology**: `chicken soup`, `habits`, `psychology`, `guide`, `success`, `healing`, `mind`, `happiness`.
13. **Young Adult & Children**: `scholastic`, `fairy`, `boy`, `girl`, `puppy`, `adventure`, `aladdin`, `disney`, `olsen`.
14. **Poetry & Plays**: `poems`, `poetry`, `sonnets`, `verses`, `plays`, `dramatic`.
15. **Art, Cooking & Lifestyle**: `recipes`, `cooking`, `cookbook`, `vegetarian`, `photography`, `design`, `art`.
16. **General Fiction**: Fallback default if no specific genre keywords trigger.

#### B. Tag Inference
Extract 3–8 descriptive semantic tags:
- Filter title tokens against a stop-word list and normalize.
- Extract era tags: `1980s`, `1990s`, `2000s`, `classic-era` based on publication year.
- Extract format/imprint tags: `hardcover-specialty`, `university-press`, `paperback-series`.
- Extract thematic sub-tags: `military`, `pandemic`, `time-travel`, `mythology`, `espionage`, `cozy`, `courtroom`.

#### C. Rating Inference & Aggregation
To calculate a rating for any catalog book:
- **Baseline Acclaim**: Deterministically hash catalog features (seed rating in [3.8, 4.6] range based on publisher acclaim and publication era).
- **User Reviews Blend (Bayesian Mean)**:
  $$\text{effectiveRating}(b) = \frac{C \cdot m + \sum_{r \in \text{reviews}(b)} r.\text{rating}}{C + |\text{reviews}(b)|}$$
  where $m = 4.0$ (catalog prior mean) and $C = 3$ (prior weight confidence).

---

### 3.3 Candidate Generation Pipeline (Without Title Indexing)

For 3 selected seeds $S = [s_1, s_2, s_3]$:
1. **Source Pools**:
   - $\mathcal{C}_{\text{author}} = \bigcup_{s \in S} \text{byAuthor}(s.\text{aKey})$
   - $\mathcal{C}_{\text{genre}} = \bigcup_{s \in S} \text{sampleTop}(\text{byGenre}(g), 400)$ for each $g \in G(s)$
   - $\mathcal{C}_{\text{tag}} = \bigcup_{s \in S} \text{sampleTop}(\text{byTag}(t), 150)$ for top rare tags $t \in T(s)$
2. **Work Deduplication & Self-Exclusion**:
   - Exclude the seed books and any other editions matching the seeds' work keys ($dKey$).
   - Collapse candidates by work key ($dKey$) so different ISBN editions of the same book do not duplicate.
3. **Bounded Candidate Pool**:
   - Restrict total candidates evaluated to 1,500–2,500 top candidates to guarantee query times under 40ms.

---

### 3.4 3-Seed Heuristic Scoring Formulas

For candidate $c$ against seeds $S = \{s_1, s_2, s_3\}$:

1. **Author Feature ($f_{\text{author}} \in [0, 1]$)**:
   $$f_{\text{author}}(c, S) = \begin{cases} 
   1.0 & \text{if } c.\text{aKey} \in \{s_1.\text{aKey}, s_2.\text{aKey}, s_3.\text{aKey}\} \\
   0.0 & \text{otherwise}
   \end{cases}$$

2. **Genre Feature ($f_{\text{genre}} \in [0, 1]$)**:
   Let $G(c)$ be candidate genres and $G(S) = \bigcup_{s \in S} G(s)$.
   $$f_{\text{genre}}(c, S) = \frac{|G(c) \cap G(S)|}{|G(c) \cup G(S)|}$$

3. **Tag Feature ($f_{\text{tag}} \in [0, 1]$)**:
   Let $T(c)$ be candidate tags and $T(S) = \bigcup_{s \in S} T(s)$.
   $$f_{\text{tag}}(c, S) = \frac{|T(c) \cap T(S)|}{\max(1, \sqrt{|T(c)| \cdot |T(S)|})}$$

4. **Rating Feature ($f_{\text{rating}} \in [0, 1]$)**:
   $$\bar{R}_S = \frac{1}{|S|} \sum_{s \in S} R(s)$$
   $$f_{\text{rating}}(c, S) = 0.7 \cdot \frac{R(c)}{5.0} + 0.3 \cdot \left(1.0 - \frac{|R(c) - \bar{R}_S|}{5.0}\right)$$

5. **Composite Score (Strictly Excluding Title)**:
   $$\text{Score}(c, S) = \frac{w_{\text{genre}} f_{\text{genre}} + w_{\text{author}} f_{\text{author}} + w_{\text{tag}} f_{\text{tag}} + w_{\text{rating}} f_{\text{rating}}}{w_{\text{genre}} + w_{\text{author}} + w_{\text{tag}} + w_{\text{rating}}}$$
   Default weights: $w_{\text{genre}} = 0.35, w_{\text{author}} = 0.25, w_{\text{tag}} = 0.25, w_{\text{rating}} = 0.15$.

---

### 3.5 Seed Diversity Re-Ranking Algorithm

1. For each candidate $c$, record its **best seed match**:
   $$\text{bestSeed}(c) = \arg\max_{s \in S} \text{Sim}(c, s)$$
2. Maintain a counter of picked books per seed: $k(s) = 0$.
3. Greedily select the highest scoring candidate using a diversity penalty factor $\delta = 0.85$:
   $$\text{RankScore}(c) = \text{Score}(c, S) \times \delta^{k(\text{bestSeed}(c))}$$
4. When candidate $c^*$ is selected, increment $k(\text{bestSeed}(c^*)) \leftarrow k(\text{bestSeed}(c^*)) + 1$.
5. Continue until `limit` recommendations are chosen (default 12 to 20).

---

### 3.6 API Interface Contract (`POST /api/recommend/three`)

- **Endpoint**: `POST /api/recommend/three`
- **Request Body**:
  ```json
  {
    "seeds": ["0439136350", "0345339681", "0060973129"],
    "weights": {
      "genre": 0.35,
      "author": 0.25,
      "tag": 0.25,
      "rating": 0.15
    },
    "limit": 20
  }
  ```
- **Validation**:
  - `seeds` must be an array of exactly 3 valid ISBN strings present in the catalog.
  - Weights must be non-negative numbers. Title similarity weight is forbidden ($w_{\text{title}} = 0$).
- **Response Format**:
  ```json
  {
    "candidates": [
      {
        "isbn": "0545010225",
        "title": "Harry Potter and the Deathly Hallows",
        "author": "J. K. Rowling",
        "year": 2007,
        "publisher": "Arthur A. Levine Books",
        "imageM": "http://...",
        "score": 0.8421,
        "features": {
          "author": 1.0,
          "genre": 0.8,
          "tag": 0.65,
          "rating": 0.92
        },
        "bestSeed": "0439136350",
        "matchedSeeds": 2,
        "explanation": "Matches author J. K. Rowling and genres Fantasy & YA from Harry Potter"
      }
    ],
    "diagnostics": {
      "seedCount": 3,
      "titleExcluded": true,
      "weightsUsed": {
        "genre": 0.35,
        "author": 0.25,
        "tag": 0.25,
        "rating": 0.15
      },
      "candidatesEvaluated": 1840,
      "queryTimeMs": 24.3
    }
  }
  ```

---

## 4. Summary of Code Changes for Implementer

1. **`server/src/recommender/metadata.js` (NEW)**:
   - Implement `inferGenres(book)` and `inferTags(book)`.
   - Implement `getCatalogRating(isbn, userReviews)` with Bayesian mean blend.
   - Build inverted lookup maps `state.byGenre` and `state.byTag` at index build time.
2. **`server/src/recommender/algorithms.js`**:
   - Add `computeHeuristicFeatures(candIdx, seedIndices, engine)`.
   - Add `recommendThree(seeds, weights, limit)`.
   - Ensure title cosine similarity is 0 and completely omitted from `computeHeuristicFeatures`.
   - Implement greedy seed diversity re-ranking loop with $\delta = 0.85$.
3. **`server/src/recommender/engine.js`**:
   - Integrate `metadata.js` classification inside `buildIndex()`.
   - Store `genres`, `tags`, and `rating` on each indexed book.
   - Maintain `byGenre` and `byTag` inverted index maps.
4. **`server/src/routes/api.js`**:
   - Mount `POST /api/recommend/three`.
   - Wire parameters, validate 3 seeds, return `{ candidates, diagnostics }` conforming to the contract.
