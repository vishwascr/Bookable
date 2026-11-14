# Task Assignment: Milestone 2 Sub-Orchestrator

## 🔒 My Identity
- Archetype: orchestrator (self)
- Roles: orchestrator, successor
- Working directory: /Users/admin/Documents/Bookable
- State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2
- Parent Conversation ID: 54805123-e26b-42d5-8dac-b0d9c2d12bdd (Top-level Project Orchestrator)

## Milestone Scope: M2 — 3-Book Recommendation Engine & Local Sentiment Analyzer
Your scope is to implement the local recommendation engine from 3 seed books using metadata heuristics (genres, authors, tags, and ratings) without title similarity weighting, and the local review sentiment analysis engine:
1. **3-Seed Recommendation Heuristics (`server/src/recommender/algorithms.js` & `engine.js`)**:
   - Accepts 3 seed books.
   - Computes candidate score using weights for:
     - $w_{\text{genre}}$ (genre Jaccard / matching similarity)
     - $w_{\text{author}}$ (author match / canonical author similarity)
     - $w_{\text{tag}}$ (topical / thematic tag overlap)
     - $w_{\text{rating}}$ (rating / popularity heuristic)
   - **STRICT MANDATORY CONSTRAINT**: Title similarity weight MUST be EXCLUDED ($w_{\text{title}} = 0$). No title TF-IDF cosine comparison in scoring.
   - Candidate generation must expand candidates via author, genre, and tags rather than title tokens alone.
2. **Dynamic Parameter & Weight Customization**:
   - Provide flexible weight overrides in `recommendThree(seeds, weights)`.
   - Default weights: e.g. genre 0.35, author 0.25, tag 0.25, rating 0.15.
3. **Local Review Sentiment Analysis Engine (`server/src/recommender/sentiment.js`)**:
   - Pure on-device rule-based sentiment engine with literary sentiment lexicon (positive/negative terms, intensifiers, negations, aspects).
   - Generates polarity score (-1.0 to +1.0), sentiment label ('positive' | 'neutral' | 'negative'), and key sentiment aspects/words.
   - Calibrates with star rating (e.g. 5 stars gives positive boost, 1 star gives negative boost).
4. **Sentiment-Adapted Recommendations**:
   - Endpoint / function that takes a submitted review's text, target book, and rating, computes local sentiment, and adapts recommendations:
     - Positive sentiment -> expands and reinforces related books sharing positive aspects/genres.
     - Negative sentiment -> adapts recommendations away from negative aspects and suggests contrasting recommendations.
5. **Backend API Endpoints (`server/src/routes/api.js`)**:
   - `POST /api/recommend/three`: accepts `{ seeds: [isbn1, isbn2, isbn3], weights: { genre, author, tag, rating }, limit }`, returns ranked recommendations and algorithm diagnostics.
   - `POST /api/recommend/sentiment-adapted`: accepts `{ reviewText, targetIsbn, rating }`, returns sentiment output and adapted book suggestions.
6. **Write Boundaries**:
   - Exclusively owns: `server/src/recommender/algorithms.js`, `server/src/recommender/sentiment.js`, `server/src/recommender/engine.js`, `server/src/recommender/metadata.js`, `server/src/routes/api.js`.

Follow the Project Pattern procedure: Assess -> Decompose or Iterate (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
Exit when the gate passes.

MANDATORY INPUTS:
- `/Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md`
- Survey report: `/Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3/handoff.md`


## 2026-11-13T18:44:56Z
You are the Milestone 2 Sub-Orchestrator for Bookable.
State folder: /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2
Working directory: /Users/admin/Documents/Bookable

MANDATORY: Read:
1. /Users/admin/Documents/Bookable/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/admin/Documents/Bookable/.agents/teamwork/orchestrator/PROJECT.md
3. /Users/admin/Documents/Bookable/.agents/teamwork/teamwork_explorer_survey_3/handoff.md
4. /Users/admin/Documents/Bookable/.agents/teamwork/sub_orch_m2/DISPATCH.md

Your scope:
M2: 3-Book Recommendation Engine & Local Sentiment Analyzer.
Implement recommendation heuristics using author, genre, tag, and rating heuristics with strict title similarity exclusion (w_title = 0). Implement local rule-based sentiment analyzer, customizable algorithm parameters, and sentiment-adapted recommendations endpoint.
File ownership: server/src/recommender/algorithms.js, server/src/recommender/sentiment.js, server/src/recommender/engine.js, server/src/recommender/metadata.js, server/src/routes/api.js.
Follow the orchestrator procedure (Assess -> Decompose/Iterate with Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
When M2 gate passes, report back via send_message with your handoff.md path.


## 2026-11-13T19:57:48Z
**Context**: New user instruction received.
**Content**: "commit after every substep is completed. Please ensure changes are committed to git (excluding `.agents/` and temporary test artifacts) after every completed substep/milestone. If `git commit` hits a sandbox permission error inside your workers, report each completed substep/milestone immediately with the files to commit so we can escalate to the user/parent agent."
**Action**: Instruct your worker and track git commits upon milestone/substep completion.
