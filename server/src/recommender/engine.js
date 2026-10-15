// In-memory recommendation engine.
// Loads every book once from MongoDB at startup and builds:
//   - a TF-IDF vector per title (sparse, L2-normalised)
//   - an inverted index token -> book ids  (for fast candidate generation)
//   - author and publisher lookup maps
import Book from '../models/Book.js';
import { tokenize, normalize, authorKey, decode } from './text.js';

const state = {
  ready: false,
  books: [], // { isbn, title, author, year, publisher, imageM, imageL, aKey, pKey, dKey }
  vectors: [], // per book: { ids: Int32Array, w: Float32Array }
  postings: new Map(), // tokenId -> number[]
  vocab: new Map(), // token -> tokenId
  idf: [], // tokenId -> idf
  byAuthor: new Map(),
  byPublisher: new Map(),
  byIsbn: new Map(),
  stats: {},
};

export function engine() {
  return state;
}

export async function buildIndex() {
  const t0 = Date.now();
  const cursor = Book.find({}, { _id: 0, isbn: 1, title: 1, author: 1, year: 1, publisher: 1, imageM: 1, imageL: 1 })
    .lean()
    .cursor({ batchSize: 10000 });

  const tokenLists = [];
  const df = [];
  for await (const b of cursor) {
    const i = state.books.length;
    b.title = decode(b.title); b.author = decode(b.author); b.publisher = decode(b.publisher);
    b.aKey = authorKey(b.author);
    b.pKey = normalize(b.publisher);
    const toks = tokenize(b.title);
    // dedupe key: sorted unique tokens of the *main* title (no "(Book 3, Audio)" / ": subtitle"),
    // so editions, formats and translations collapse into one "work"
    const main = tokenize(b.title.replace(/\(.*?\)|\[.*?\]/g, ' ').split(/[:;]/)[0]);
    b.dKey = [...new Set(main.length ? main : toks)].sort().join(' ') || normalize(b.title);
    state.books.push(b);
    state.byIsbn.set(b.isbn, i);
    push(state.byAuthor, b.aKey, i);
    push(state.byPublisher, b.pKey, i);

    const counts = new Map();
    for (const t of toks) {
      let id = state.vocab.get(t);
      if (id === undefined) { id = state.vocab.size; state.vocab.set(t, id); df[id] = 0; }
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const id of counts.keys()) { df[id]++; push(state.postings, id, i); }
    tokenLists.push(counts);
  }

  const N = state.books.length;
  state.idf = df.map((d) => Math.log((N + 1) / (d + 1)) + 1);

  for (const counts of tokenLists) {
    const ids = new Int32Array(counts.size);
    const w = new Float32Array(counts.size);
    let k = 0, norm = 0;
    for (const [id, tf] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      const v = (1 + Math.log(tf)) * state.idf[id];
      ids[k] = id; w[k] = v; norm += v * v; k++;
    }
    norm = Math.sqrt(norm) || 1;
    for (let j = 0; j < w.length; j++) w[j] /= norm;
    state.vectors.push({ ids, w });
  }

  state.stats = {
    books: N,
    vocabulary: state.vocab.size,
    authors: state.byAuthor.size,
    publishers: state.byPublisher.size,
    buildMs: Date.now() - t0,
  };
  state.ready = true;
  console.log('[engine] index built', state.stats);
}

function push(map, key, val) {
  if (!key && key !== 0) return;
  const arr = map.get(key);
  if (arr) arr.push(val); else map.set(key, [val]);
}

// Cosine similarity of two L2-normalised sparse vectors (sorted ids).
export function cosine(a, b) {
  const A = state.vectors[a], B = state.vectors[b];
  let i = 0, j = 0, s = 0;
  while (i < A.ids.length && j < B.ids.length) {
    if (A.ids[i] === B.ids[j]) { s += A.w[i] * B.w[j]; i++; j++; }
    else if (A.ids[i] < B.ids[j]) i++;
    else j++;
  }
  return s;
}

// Score every book sharing at least one title term with the seed (inverted-index accumulation).
export function titleNeighbours(seed, maxDf = 15000) {
  const V = state.vectors[seed];
  const acc = new Map();
  for (let k = 0; k < V.ids.length; k++) {
    const list = state.postings.get(V.ids[k]);
    if (!list || list.length > maxDf) continue; // skip ultra-common terms for speed
    for (const d of list) {
      if (d === seed) continue;
      const W = state.vectors[d];
      // locate weight of this term in d
      let wd = 0;
      for (let j = 0; j < W.ids.length; j++) if (W.ids[j] === V.ids[k]) { wd = W.w[j]; break; }
      acc.set(d, (acc.get(d) || 0) + V.w[k] * wd);
    }
  }
  return acc; // Map bookIdx -> cosine
}

export function termsOf(idx) {
  const inv = [];
  const V = state.vectors[idx];
  const rev = reverseVocab();
  for (let k = 0; k < V.ids.length; k++) inv.push({ term: rev[V.ids[k]], weight: +V.w[k].toFixed(3), idf: +state.idf[V.ids[k]].toFixed(2) });
  return inv.sort((a, b) => b.weight - a.weight);
}

let _rev = null;
function reverseVocab() {
  if (_rev) return _rev;
  _rev = [];
  for (const [t, id] of state.vocab) _rev[id] = t;
  return _rev;
}
