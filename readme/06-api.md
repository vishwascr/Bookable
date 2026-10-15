# 06 · REST API

Base URL: `http://localhost:5050/api` (proxied as `/api` by Vite in dev).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok, ready, stats: { books, vocabulary, authors, publishers, buildMs } }` |
| GET | `/algorithms` | List of algorithms (`key, name, short, formula, explain[]`) + `defaultWeights` |
| GET | `/books/search?q=&page=&limit=` | Mongo `$text` search on title/author with pagination metadata |
| GET | `/books/:isbn` | `{ book, terms }` — terms = TF-IDF weights of the title |
| GET | `/recommend/:isbn` | Recommendations (see below) |

### `GET /books/search`
Query parameters:
| Parameter | Default | Description |
|---|---|---|
| `q` | `""` | Search query string (minimum 2 characters) |
| `page` | *(optional)* | Page number (1-indexed). When present or `paginate=true`, returns paginated envelope |
| `limit` | 20 | Number of results per page (1–100) |
| `paginate` | *(optional)* | Set to `'true'` to force paginated envelope |

Response when `page` is provided:
```json
{
  "books": [
    {
      "isbn": "0618134700",
      "title": "The Annotated Hobbit: The Hobbit, Or, There and Back Again",
      "author": "J. R. R. Tolkien",
      "year": 2002,
      "publisher": "Houghton Mifflin Company",
      "imageS": "http://...",
      "imageM": "http://...",
      "imageL": "http://..."
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3,
  "limit": 20
}
```
*(When `page` is omitted, returns array `[...]` directly for lightweight autocomplete requests).*

### `GET /recommend/:isbn`
| Query | Default | Notes |
|---|---|---|
| `algo` | `hybrid` | `tfidf` \| `author` \| `publisher` \| `year` \| `hybrid` \| `all` |
| `limit` | 12 | max 50 |
| `w_title`, `w_author`, `w_publisher`, `w_year` | 0.45 / 0.30 / 0.15 / 0.10 | hybrid weights (≥0) |

Response:
```json
{
  "seed": { "book": { "isbn": "0439136350", "title": "Harry Potter and the Prisoner of Azkaban (Book 3)", "...": "..." },
            "terms": [{ "term": "azkaban", "weight": 0.71, "idf": 11.2 }] },
  "runs": [{
    "algorithm": "hybrid", "name": "Weighted Hybrid",
    "formula": "score = Σ wᵢ·featureᵢ / Σ wᵢ ...",
    "weights": { "title": 0.45, "author": 0.3, "publisher": 0.15, "year": 0.1 },
    "meta": { "candidatesConsidered": 3616, "ms": 7.8 },
    "results": [{ "book": { "...": "..." }, "score": 0.7577,
                  "features": { "title": 0.46, "author": 1, "publisher": 1, "year": 0.98 } }]
  }]
}
```

### Errors
| Status | When |
|---|---|
| 400 | unknown `algo` |
| 404 | ISBN not found |
| 503 | engine index still building (first ~8 s after boot) |
| 500 | unexpected error (`{ error }`) |
