# 09 · Testing & Verification

## Automated smoke test
With MongoDB and the API running:
```bash
cd server && npm run smoke
```
It checks: health/index ready (271,359 books), 5 algorithms listed, search works, and for 3 seed
books × 5 algorithms that scores are in [0,1] and sorted, the seed is excluded, results are unique;
hybrid weights are honoured (author-only weight ⇒ all results share the author); error codes 400/404.

Last run: **24/24 checks passed**, recommendation latency 0.2 – 9 ms.

## Manual checks performed
| Seed | Algorithm | Observation |
|---|---|---|
| The Hobbit | TF-IDF | Hobbit-related titles (Hobbit Companion, Annotated Hobbit) |
| Prisoner of Azkaban | Same Publisher & Era | Chamber of Secrets, Sorcerer's Stone, Goblet of Fire |
| Prisoner of Azkaban | Hybrid | Rest of the series ranked top |
| Decision in Normandy | Same Author | Only 2 other works exist — correctly returns 2 |

## Quality issues found & fixed (Phase 6)
1. Results flooded by editions/formats ("Book 3, Audio CD") → work-key de-duplication + format stop-words.
2. `&amp;` in titles → HTML entity decoding.
3. Year `0` values → treated as unknown.

## Build check
`cd client && npm run build` — compiles without errors.
