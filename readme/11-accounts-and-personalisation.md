# 11 · User Accounts & Personalised Recommendations

Inspired by Goodreads' onboarding ("rate a few books to get started") and its *"Because you
liked…"* recommendation rows.

## Design interview outcomes (grill-me, round 3)
| # | Question | Decision |
|---|---|---|
| 1 | How do accounts work? | **Real accounts**: username + password (bcrypt, cost 10) in MongoDB; **JWT** (7-day) stored in `localStorage`; signup / login / logout. |
| 2 | Brand Tagline | Prominently display the official slogan: **“Bookable - Where wisdom meets technology”** across auth and logout screens. |
| 3 | Mascot Slot | Reserve a dedicated, responsive container (`.mascot-slot`) centered above the auth card for an upcoming character/mascot asset. |
| 4 | Logout Experience | Dedicated **Logout Page** confirming session termination with an immediate button to log back in. |
| 5 | Onboarding selection | **Goodreads-style**: after signup, *"Pick 3–5 books you love"* with search + curated **Popular** grid; at least 3 required. Saved as the **Favourites** shelf, editable later. |
| 6 | Combining favourites | **Profile aggregation**: run each algorithm for every favourite, average scores per candidate, exclude favourites; each result shows *"Because you liked X, Y"* + per-favourite contribution bars. Same algorithm tabs + Compare all. |
| 7 | Fit with existing app | Logged-in users land on **For You**; search & single-book explorer remain public. Simple **Want to Read** shelf (one-click add from any recommendation). |

## User journey
```mermaid
flowchart TD
  V["Visitor (logged out)"] -->|"Sign up"| SU["Signup form with Mascot Slot & Tagline"]
  V -->|"Log in"| LI["Login form with Mascot Slot & Tagline"]
  V -->|"search / explore"| EX["Public search & single-book explorer"]
  SU --> OB["Onboarding: pick 3-5 favourite books"]
  LI -->|"has >= 3 favourites"| FY["For You page"]
  LI -->|"not onboarded"| OB
  OB -->|"Save (>= 3)"| FY
  FY -->|"switch algorithm / compare all / sliders"| FY
  FY -->|"+ Want to Read"| SH["My Books: Favourites + Want to Read"]
  FY -->|"Log out"| LO["Logout Page: Mascot Slot + Confirmation"]
  LO -->|"Log Back In"| LI
  LO -->|"Continue as guest"| EX
  FY -->|"Edit favourites"| OB
  FY -->|"click a title"| EX
  SH --> EX
```

## Data model (`server/src/models/User.js`)
```js
{
  username: String (unique, lowercase, /^[a-z0-9_.-]{3,30}$/),
  displayName: String,
  passwordHash: String,          // bcrypt — the plain password is never stored
  favorites: [ISBN],             // 3–5 seeds
  wantToRead: [ISBN],            // newest first
  createdAt, updatedAt
}
// virtual: onboarded = favorites.length >= 3
```

## Profile algorithm (`recommendProfile` in `recommender/algorithms.js`)
For favourites $S = \{s_1..s_n\}$ and a chosen algorithm $A$:

1. For each favourite $s$: generate $A$'s candidates and compute $score_s(c)$ with $A$'s formula.
   Per favourite, keep the best-scoring edition of each *work* (work key, see [04-data.md](04-data.md)).
2. Skip any work that is itself a favourite or on the Want to Read shelf.
3. **Aggregate:** $\text{profile}(c) = \frac{1}{n}\sum_{s \in S} score_s(c)$ (missing = 0) — books
   recommended by several favourites rise to the top.
4. **Diversity re-rank (greedy):** each time a favourite is the main reason (highest contributor) for a
   pick, further candidates driven by that favourite are multiplied by $0.85^{k}$. This stops one
   prolific author (e.g. Douglas Adams' many *Hitchhiker* editions) from filling the whole list.
5. Return top N with `contributions` (favourite ISBN → score), `matchedSeeds`, `bestSeed`, and
   `features` versus the strongest favourite.

**How each algorithm behaves as a profile:**
| Algorithm | Profile interpretation |
|---|---|
| TF-IDF | Books whose titles share distinctive words with any of your favourites |
| Same Author | More by the authors you love (score diluted by 1/n, so each author ≈ equal share) |
| Same Publisher & Era | Imprints + periods common in your taste |
| Era + Theme | Thematically related books from the eras you read |
| Weighted Hybrid | Balanced blend; books that match **several** favourites on multiple signals win |

## API
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | `{username, password, displayName?}` → `201 {token, user}`; 400 invalid, 409 taken |
| POST | `/api/auth/login` | – | `{username, password}` → `{token, user}`; 401 invalid |
| GET | `/api/me` | Bearer | `{user, favorites: [book], wantToRead: [book]}` |
| PUT | `/api/me/favorites` | Bearer | `{isbns: [3..5]}` → `{user}`; 400 if count/ISBN invalid |
| POST | `/api/me/want/:isbn` | Bearer | add to Want to Read |
| DELETE | `/api/me/want/:isbn` | Bearer | remove from Want to Read |
| GET | `/api/me/recommend?algo=&limit=&w_*=` | Bearer | profile recommendations (`algo=all` for compare) |
| GET | `/api/books/popular` | – | curated onboarding grid (28 well-known titles) |

Example `/api/me/recommend` result item:
```json
{
  "book": { "isbn": "0553293370", "title": "Foundation", "author": "Isaac Asimov", "...": "..." },
  "score": 0.2881,
  "contributions": { "0441172660": 0.51, "0671461494": 0.35 },
  "matchedSeeds": 2,
  "bestSeed": "0441172660",
  "features": { "title": 0.0, "author": 0, "publisher": 1, "year": 0.92 }
}
```

## Frontend
| Component | Role |
|---|---|
| `AuthPage.jsx` | Signup & login card featuring the SVG brand mascot, tagline **“Bookable - Where wisdom meets technology”**, and auth state switching |
| `LogoutPage.jsx` | Dedicated session termination screen displaying the SVG brand mascot, tagline, and direct **“Log Back In →”** button returning to the login form |
| `Mascot.jsx` | Scalable vector SVG of the Bookable Panda mascot inspired by `readme/tibbixel-dot-com-37658-svg.svg`, wearing reading glasses, reading an orange book (`#E88051`, without text), holding green bamboo (`#145D3C`), sitting on a royal blue cushion (`#0B4D91`) |
| `Onboarding.jsx` | Progress dots (x/5), selected-book chips, search, Popular grid with ✓ overlay; also used for editing favourites |
| `ForYou.jsx` | Favourites strip, algorithm tabs + Compare all, hybrid sliders, explanation panel, results with *Because you liked…*, per-favourite contribution bars, expandable feature breakdown, **+ Want to Read** |
| `Shelves.jsx` | *My Books*: Favourites and Want to Read grids |
| `App.jsx` | View state machine: `home · search · explore · login · signup · logout · onboarding · foryou · shelves`; restores session from the stored JWT on load |

## Mascot Character & Design Specification
The Bookable mascot is implemented directly as a scalable vector SVG, styled after the cartoon line art in `readme/tibbixel-dot-com-37658-svg.svg`:
- **Format**: Pure SVG (`<svg viewBox="0 0 217 231">`) with responsive sizes (`sm`, `md`, `lg`) and standalone vector assets at `client/public/mascot.svg` and `client/src/assets/mascot.svg`.
- **Character**: Friendly, bold-outline cartoon panda with cheek tufts, teardrop eye patches, shining eyes, and a sweet smile; full white face with a clean rounded chin (no black neck/chin covering).
- **Reading Glasses**: Round honey-gold wireframe glasses perched on the nose, framing the eyes with glass gleams.
- **Book**: Held perpendicularly to the ground in front of the chest, displaying the solid orange **`#E88051`** **hard bind** (spine with embossed ribs and debossed cover borders) facing the user, with clean blank white page tops visible from above (no printed text).
- **Bamboo**: Holding a fresh green bamboo stalk with segmented nodes and tender leaves in the other hand using exact color **`#145D3C`**.
- **Cushion**: Sitting cross-legged comfortably atop a plush, tufted cushion using exact color **`#0B4D91`**.
- **Placement**: Prominently featured on the **Login / Signup page (`AuthPage.jsx`)**, the **Logout confirmation page (`LogoutPage.jsx`)**, and the **Home landing hero (`App.jsx`)**.

## Security notes
- Passwords hashed with bcrypt; login errors don't reveal whether the username exists.
- Set `JWT_SECRET` in `server/.env` for anything beyond local use (a dev fallback is built in).
- JWT in `localStorage` is fine for this demo; for production prefer httpOnly cookies + CSRF protection.

