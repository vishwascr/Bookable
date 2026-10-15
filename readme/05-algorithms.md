# 05 · Algorithms

All algorithms share the same **feature vector** for a (seed, candidate) pair:

| Feature | Definition | Range |
|---|---|---|
| `title` | cosine similarity of TF-IDF title vectors | 0–1 |
| `author` | 1 if normalised authors match, else 0 | {0,1} |
| `publisher` | 1 if normalised publishers match, else 0 | {0,1} |
| `year` | Gaussian proximity $e^{-\Delta y^2 / (2\sigma^2)}$, $\sigma = 5$ years (0 if unknown) | 0–1 |

Each algorithm = **candidate generation** → **score formula** → sort → collapse editions → top N.

## 1. Title Similarity (TF-IDF) — `tfidf`
- **Tokenise:** lower-case, strip accents/punctuation, drop stop-words (incl. format words like "audio", "paperback") and numbers, light plural stemming.
- **Weight:** $w = (1 + \ln tf) \cdot idf$, $idf = \ln\frac{N+1}{df+1} + 1$, then L2-normalise.
- **Candidates:** books sharing ≥1 term via the inverted index (terms with df > 15,000 skipped for speed); top 600.
- **Score:** $\cos(\vec{s}, \vec{c})$.
- **Good for:** same topic/series words ("hobbit", "azkaban"). **Weak:** synonyms, generic titles.

## 2. Same Author — `author`
- **Candidates:** all books with the same author key.
- **Score:** $author \times (0.7 + 0.3 \cdot title)$ — series siblings rank first.
- **Good for:** "more by this author". **Weak:** inconsistent author spellings.

## 3. Same Publisher & Era — `publisher`
- **Candidates:** all books from the same publisher.
- **Score:** $publisher \times (0.6 \cdot year + 0.4 \cdot title)$.
- **Good for:** imprints that specialise in genres (Harlequin, Tor, Scholastic). **Weak:** big generalist publishers.

## 4. Era + Theme — `year`
- **Candidates:** top 3,000 TF-IDF neighbours (must share a title word).
- **Score:** $0.65 \cdot year + 0.35 \cdot title$.
- **Good for:** "what else on this subject was published around then". **Weak:** year-dominated ranking can surface loosely related books.

## 5. Weighted Hybrid — `hybrid` (default)
- **Candidates:** TF-IDF top 800 ∪ same author ∪ same publisher (capped 5,000).
- **Score:** $\dfrac{\sum_i w_i f_i}{\sum_i w_i}$ with defaults title 0.45, author 0.30, publisher 0.15, year 0.10 — adjustable via UI sliders / `w_*` query params.
- **Good for:** balanced results (e.g. Prisoner of Azkaban → Chamber of Secrets, Sorcerer's Stone, Goblet of Fire).

## Post-processing (all algorithms)
1. Exclude the seed and any book with the seed's work key (other editions).
2. Collapse results sharing a work key (keep the highest-scoring).
3. Return top `limit` (default 12, max 50) with `features`, `score`, `meta.candidatesConsidered`, `meta.ms`.

## Why no collaborative filtering?
`Books.csv` has no users or ratings. CF would need `Ratings.csv`/`Users.csv` from the same
dataset — see [10-future-work.md](10-future-work.md).
