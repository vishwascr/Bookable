# Scope: Milestone 2 — 3-Book Recommendation Engine & Local Sentiment Analyzer

## Architecture
- `server/src/recommender/metadata.js`: Metadata inference & catalog tags/genres.
- `server/src/recommender/algorithms.js`: 3-seed heuristics (author, genre, tag, rating) with strict title exclusion ($w_{\text{title}} = 0$).
- `server/src/recommender/sentiment.js`: Local rule-based literary sentiment analyzer with lexicon, negation/intensifiers, aspect extraction, star calibration.
- `server/src/recommender/engine.js`: Candidate generation & ranking pipeline integrating metadata heuristics.
- `server/src/routes/api.js`: Express endpoints (`POST /api/recommend/three`, `POST /api/recommend/sentiment-adapted`, and integration with existing routes).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 10 | 3-Book Seed Recommendation Engine | Generates suggestions from 3 selected seed books using metadata heuristics (genres, authors, tags, ratings) | M2 | R3, AC3 |
| 11 | Title Similarity Weight Exclusion | Strict exclusion of title similarity weighting (w_title = 0) from the recommendation engine | M2 | R3, AC3 |
| 12 | Algorithm Customization Parameters | Customizable algorithm weights and parameters (genre, author, tag, rating) | M2 | R3, AC3 |
| 13 | Local Review Sentiment Analyzer | Fast, on-device rule-based sentiment analysis scoring review text on submission | M2 | R3, AC3 |
| 14 | Sentiment-Adapted Recommendations | Dynamic adaptation and expansion of recommendations reflecting sentiment of user reviews | M2 | R3, AC3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | Recommendation Engine & Sentiment Analyzer | Complete M2 scope across recommender and API routes | None | DONE |

## Key Outputs
- Files:
  - `server/src/recommender/metadata.js` (NEW: 16-genre classifier, title-decoupled tag inference, Bayesian catalog rating)
  - `server/src/recommender/sentiment.js` (NEW: pure rule-based literary sentiment analyzer, aspect isolation, star calibration, dynamic adaptation)
  - `server/src/recommender/algorithms.js` (3-seed heuristic features with strict $w_{\text{title}} = 0$, customizable weights, diversity re-ranking $\delta = 0.85$, null safety)
  - `server/src/recommender/engine.js` (Inverted maps `byGenre` and `byTag`, metadata indexing, `sampleStride` candidate generation)
  - `server/src/routes/api.js` (`POST /api/recommend/three`, `POST /api/recommend/sentiment-adapted`, `GET /api/dev/diagnostics` exposing `titleExcluded: true`)
  - `server/src/routes/reviews.js` (Integrated with `analyzeSentiment` alias)
- Test Suites:
  - `server/src/scripts/test-m2.js` (6/6 tests passed)
  - `server/src/scripts/challenge-recommender.js` (13/13 tests passed)
  - `server/src/scripts/challenge-sentiment.js` (25/25 tests passed)
  - `server/src/scripts/test-api-m2.js` (8/8 tests passed)
- Git Commit File List (reported for user/parent commit due to worker sandbox restrictions on `.git/`):
  - `server/src/recommender/metadata.js`
  - `server/src/recommender/sentiment.js`
  - `server/src/recommender/algorithms.js`
  - `server/src/recommender/engine.js`
  - `server/src/routes/api.js`
  - `server/src/routes/reviews.js`
  - `server/src/scripts/test-m2.js`
  - `server/src/scripts/challenge-recommender.js`
  - `server/src/scripts/challenge-sentiment.js`
  - `server/src/scripts/test-api-m2.js`
