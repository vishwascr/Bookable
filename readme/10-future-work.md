# 10 · Limitations & Future Work

## Limitations
- **Metadata only** — no genres, descriptions or ratings, so "taste" is approximated from title words, author, publisher and year.
- **Translations** of the same work are not collapsed (different title words, e.g. "prisionero" vs "prisoner").
- Author spelling variants ("J.K. ROWLING" vs "Joanne K. Rowling") are treated as different authors.
- Index lives in process memory: rebuilt (~8 s) on each server start; re-import requires restart.

## Next steps
1. **Collaborative filtering** — import `Ratings.csv`/`Users.csv` (Book-Crossing) and add item-item CF + matrix factorisation (ALS/SVD) as new algorithm entries (same `candidates + score` interface).
2. **Semantic similarity** — sentence embeddings of titles (e.g. MiniLM) stored in MongoDB Atlas Vector Search.
3. **Author clustering** — fuzzy matching to merge author variants.
4. **Evaluation page** — offline metrics (precision@k, coverage, diversity) per algorithm.
5. **Users & favourites** — JWT auth, saved lists, personalised seeds.
6. Persist the built index to disk for instant startup.
