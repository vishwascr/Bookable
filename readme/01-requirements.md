# 01 · Requirements & Design Decisions

## Goal
Build a book recommendation web app around `Books.csv` that offers **multiple recommendation
algorithms**, lets the user **select an algorithm**, and **shows how the algorithm produced its
results**. Everything is documented in Markdown, including the build phases.

## Design interview outcomes (grill-me)
| # | Question | Decision |
|---|---|---|
| 1 | The CSV has only metadata (ISBN, title, author, year, publisher, cover URLs) — no ratings. Which algorithms? | **Metadata-only**: TF-IDF title similarity, Same Author, Same Publisher & Era, Era + Theme, and a Weighted Hybrid — each with a score breakdown. |
| 2 | Stack & scope | **Vite + React** frontend, **Express** API, **local MongoDB**, plain CSS, **no auth**. |
| 3 | Core UX | Search a book → pick an algorithm **or compare all side-by-side** → results with a **per-result score breakdown** and a **"How it works"** explainer. |

## Functional requirements
- FR1 Import all rows of `Books.csv` into MongoDB (idempotent re-import).
- FR2 Full-text search by title/author.
- FR3 Five algorithms, selectable from the UI.
- FR4 "Compare all" mode runs every algorithm on the same seed.
- FR5 Each result shows its final score and the four underlying features (title, author, publisher, year).
- FR6 Each algorithm has a plain-language explanation and formula.
- FR7 Hybrid weights adjustable live with sliders.
- FR8 Clicking a result makes it the new seed (exploration).

## Non-functional requirements
- Recommendation latency < 50 ms (achieved: ~1–10 ms).
- No external services/keys required.
- Editions/translations of the same work are collapsed so results are diverse.

## Out of scope
User accounts, ratings, collaborative filtering (no interaction data in the CSV) — see [10-future-work.md](10-future-work.md).
