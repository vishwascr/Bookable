# 06 · REST API

Base URL: `http://localhost:5050/api` (proxied as `/api` by Vite in dev).

## Public Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok, ready, stats: { books, vocabulary, authors, publishers, buildMs } }` |
| GET | `/algorithms` | List of algorithms (`key, name, short, formula, explain[]`) + `defaultWeights` |
| GET | `/books/search?q=&page=&limit=` | Mongo `$text` search on title/author with pagination metadata |
| GET | `/books/:isbn` | `{ book, terms }` — terms = TF-IDF weights of the title |
| GET | `/books/popular` | Curated list of 28 popular books used for onboarding |
| GET | `/recommend/:isbn` | Single-book recommendations (see below) |

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
Single-book recommendations based on a single seed.
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

---

## User Accounts & Personalised Endpoints

All authenticated endpoints require an `Authorization: Bearer <jwt_token>` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | No | Register new user: `{ username, password, displayName? }` → `{ token, user }` |
| POST | `/auth/login` | No | Sign in: `{ username, password }` → `{ token, user }` |
| GET | `/me` | Bearer | Get current user profile, favorites (`[Book]`), and wantToRead (`[Book]`) |
| PUT | `/me/favorites` | Bearer | Update user favorite seeds: `{ isbns: [3..5] }` |
| POST | `/me/want/:isbn` | Bearer | Add book to Want to Read shelf |
| DELETE | `/me/want/:isbn` | Bearer | Remove book from Want to Read shelf |
| GET | `/me/recommend` | Bearer | Personalized recommendations aggregated over all favorite books |

### `GET /me/recommend`
Query parameters:
| Parameter | Default | Notes |
|---|---|---|
| `algo` | `hybrid` | `tfidf` \| `author` \| `publisher` \| `year` \| `hybrid` \| `all` |
| `limit` | 12 | Number of recommendations |
| `w_*` | defaults | Hybrid weight overrides |

Response item includes per-seed contribution breakdown:
```json
{
  "favorites": [ ... ],
  "runs": [{
    "algorithm": "hybrid",
    "name": "Weighted Hybrid",
    "meta": { "seeds": 3, "candidatesConsidered": 8138, "ms": 32.7 },
    "results": [{
      "book": { "isbn": "0441172695", "title": "Children of Dune", "author": "Frank Herbert", "...": "..." },
      "score": 0.2981,
      "features": { "title": 0.42, "author": 1, "publisher": 1, "year": 0.88 },
      "bestSeed": "0441172660",
      "contributions": { "0441172660": 0.89, "0671461494": 0.12 },
      "matchedSeeds": 2
    }]
  }]
}
```

### Errors
| Status | When |
|---|---|
| 400 | Invalid payload, unknown algorithm, or fewer than 3 favorites provided |
| 401 | Not logged in, session expired, or bad credentials |
| 404 | Book or ISBN not found |
| 409 | Username already taken during signup |
| 503 | In-memory engine index is still building on startup (~8 s) |
| 500 | Unexpected internal server error |

