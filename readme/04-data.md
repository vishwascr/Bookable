# 04 · Data

## Source
`Books.csv` — Book-Crossing dataset, 271,360 rows.

| Column | Example | Mongo field |
|---|---|---|
| ISBN | 0195153448 | `isbn` (unique) |
| Book-Title | Classical Mythology | `title` |
| Book-Author | Mark P. O. Morford | `author` |
| Year-Of-Publication | 2002 | `year` (Number or `null`) |
| Publisher | Oxford University Press | `publisher` |
| Image-URL-S/M/L | amazon.com URLs | `imageS`, `imageM`, `imageL` |

## Cleaning rules (import)
- Trim all strings; rows with missing ISBN/title or a duplicate ISBN are skipped (1 skipped).
- `year` of `0` or `> 2025` (data-entry errors) → `null`; year features then score 0.
- CSV parsed with `relax_quotes` / `relax_column_count` to survive malformed lines.

## Cleaning rules (engine, at load)
- HTML entities decoded (`&amp;` → `&`).
- `aKey` author key: lower-case, accents & punctuation & spaces removed ("J. K. Rowling" = "J.K. Rowling").
- `pKey` publisher key: normalised publisher.
- `dKey` *work key*: sorted unique tokens of the main title (text in `()`/`[]` and after `:`/`;` removed). Used to collapse editions/formats.

## Schema & indexes
```js
{ isbn: String (unique), title: String, author: String, year: Number|null,
  publisher: String, imageS, imageM, imageL }
// indexes: { isbn: 1 } unique, { title: 'text', author: 'text' }, { author: 1 }
```

## Known data quirks
- Many cover URLs return a 1×1 placeholder → UI shows a letter placeholder.
- Some authors are inconsistent across editions ("J.K. ROWLING", "Joanne K. Rowling").
- No genre/description/ratings columns — limits algorithm options (see [05-algorithms.md](05-algorithms.md)).
