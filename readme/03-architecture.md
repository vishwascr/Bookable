# 03 · Architecture

```mermaid
flowchart LR
  CSV["Books.csv (73 MB)"] -->|"npm run import (stream, batch 5k)"| DB[("MongoDB: bookable.books")]
  DB -->|"startup: stream all docs"| ENG["In-memory engine: TF-IDF vectors, inverted index, author & publisher maps"]
  DB -->|"$text search"| API
  ENG --> API["Express API :5050"]
  API -->|"JSON /api/*"| UI["React (Vite) :5173"]
```

## Why an in-memory engine?
- Similarity needs to compare a seed against many books; doing that in MongoDB per request is slow.
- 271k short titles fit comfortably in memory (~66k-term vocabulary); index builds in ~8 s.
- MongoDB remains the system of record (and powers text search); the engine is rebuilt on boot.

## Request flow – `GET /api/recommend/:isbn?algo=hybrid`
```mermaid
sequenceDiagram
  participant U as React UI
  participant A as Express
  participant E as Engine
  U->>A: GET /api/recommend/0439136350?algo=hybrid&w_title=0.45...
  A->>E: recommend("hybrid", seedIdx, weights)
  E->>E: candidates() via inverted index / author map / publisher map
  E->>E: features(seed, cand) for each, score = formula
  E->>E: sort, collapse editions by work key, top N
  E-->>A: results + features + meta(candidates, ms)
  A-->>U: { seed, runs: [...] }
```

## Folder layout
```
Bookable/
├── Books.csv
├── readme/                 ← all documentation
├── server/
│   └── src/
│       ├── index.js        ← Express bootstrap, triggers index build
│       ├── db.js           ← Mongo connection (MONGO_URI)
│       ├── models/Book.js
│       ├── scripts/import.js
│       ├── routes/api.js
│       └── recommender/
│           ├── text.js       ← normalise, tokenise, stem, decode
│           ├── engine.js     ← index building, cosine, neighbours
│           └── algorithms.js ← 5 algorithms + recommend()
└── client/
    ├── vite.config.js      ← proxies /api → :5050
    └── src/
        ├── App.jsx, api.js, styles.css
        └── components/ SearchBar, Cover, SeedPanel, AlgorithmPicker,
                         WeightSliders, HowItWorks, ResultsRun
```

## Key design pattern
Every algorithm is defined as **candidate generation + scoring formula** over a **shared feature
vector** `{title, author, publisher, year}` (all in [0,1]). This makes algorithms directly
comparable and lets the UI show the same breakdown for every result.
