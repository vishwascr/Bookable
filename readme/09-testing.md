# 09 · Testing & Verification

## Automated smoke test
With MongoDB and the API running:
```bash
cd server && npm run smoke
```
It tests the entire application pipeline across **36 automated checks**:
1. **Engine & Data:** Health endpoint ready, all 271,359 books indexed into memory (~8 s build time).
2. **Algorithms:** All 5 algorithms listed with formulas and descriptions.
3. **Search:** Both lightweight array autocomplete format and paginated metadata search (`total`, `page`, `totalPages`) validated.
4. **Single-Book Recommendations:** Tested across 3 diverse seeds (`Prisoner of Azkaban`, `The Hobbit`, `Decision in Normandy`) across all 5 algorithms: scores normalized in [0, 1] and sorted descending, seed excluded, duplicate editions collapsed, execution latency 0.2–9 ms.
5. **Hybrid Weights:** Proves that setting author weight = 1 and others = 0 strictly surfaces books by the same author.
6. **Error Handling:** Unknown algorithms yield 400; unknown ISBNs yield 404.
7. **User Authentication:** New user registration yields 201 + valid JWT; duplicate usernames yield 409; invalid passwords yield 401; valid login yields JWT token; protected `/me` rejects unauthenticated requests with 401.
8. **Onboarding:** Validates `/books/popular` returns at least 20 curated popular seeds; rejects fewer than 3 favorites with 400; accepts 3–5 favorites and sets user virtual `onboarded = true`.
9. **Personalised Multi-Seed Profile Recommendations:** Runs `/me/recommend?algo=all` across all 5 algorithms: favorites are excluded, per-favorite contribution maps are validated, and diversity re-ranking ensures balanced representation across favorite authors.
10. **Shelves Integration:** Adding a recommended book to the Want to Read shelf immediately excludes it from subsequent recommendations, and `/me` returns updated shelves.

Last run: **36/36 checks passed**.

---

## Manual checks performed
| Action / Screen | Algorithm / View | Observation |
|---|---|---|
| Search input + Enter | Search Results | Dedicated grid appears with 24 books/page and pagination controls |
| Login Page | Auth view | Tagline *"Bookable - Where wisdom meets technology"* and Mascot Slot render cleanly |
| Logout Page | Logout view | Clicking "Log out" clears token, displays session end notice, and "Log Back In" button opens login |
| Onboarding | Book selector | User selects 3 books from popular grid; counter increments to 3/5 and unlocks "Show my recommendations" |
| For You Dashboard | Hybrid & Compare | Recommendations display "Because you liked..." and contribution breakdown bars across favorites |
| The Hobbit (Single) | TF-IDF | Hobbit-related titles (Hobbit Companion, Annotated Hobbit) |
| Prisoner of Azkaban | Same Publisher & Era | Chamber of Secrets, Sorcerer's Stone, Goblet of Fire |
| Decision in Normandy | Same Author | Only 2 other works exist — correctly returns 2 |

---

## Build check
```bash
cd client && npm run build
```
Compiles with 0 errors via Vite / Rollup.

