// Smoke test against a running API. Usage: npm run smoke  (API_URL defaults to http://localhost:5050/api)
const BASE = process.env.API_URL || 'http://localhost:5050/api';
let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${name} ${extra}`); if (!cond) failed++; };
const get = async (p) => { const r = await fetch(BASE + p); return { status: r.status, body: await r.json() }; };

const h = await get('/health');
check('health ready', h.body.ready, JSON.stringify(h.body.stats));
check('all books indexed', h.body.stats?.books > 270000);

const a = await get('/algorithms');
check('5 algorithms listed', a.body.algorithms.length === 5);

const s = await get('/books/search?q=hobbit');
check('search returns results array', Array.isArray(s.body) && s.body.length > 0, `(${s.body.length})`);

const sp = await get('/books/search?q=hobbit&page=1&limit=5');
check('search returns paginated metadata', sp.body.total > 0 && sp.body.books?.length === 5 && sp.body.totalPages >= 1, `total=${sp.body.total}, pages=${sp.body.totalPages}`);

for (const isbn of ['0439136350', '0345339681', '0060973129']) {
  const r = await get(`/recommend/${isbn}?algo=all&limit=10`);
  check(`recommend all for ${isbn}`, r.status === 200 && r.body.runs.length === 5);
  for (const run of r.body.runs || []) {
    const keys = new Set();
    const okScores = run.results.every((x, i, arr) => x.score >= 0 && x.score <= 1 && (i === 0 || arr[i - 1].score >= x.score));
    const noSeed = run.results.every((x) => x.book.isbn !== isbn);
    run.results.forEach((x) => keys.add(x.book.isbn));
    check(`  ${run.algorithm}: sorted scores in [0,1], seed excluded, unique`, okScores && noSeed && keys.size === run.results.length, `${run.results.length} results, ${run.meta.ms}ms`);
  }
}

const w = await get('/recommend/0439136350?algo=hybrid&w_title=0&w_author=1&w_publisher=0&w_year=0');
check('hybrid author-only weight → all same author', w.body.runs[0].results.every((x) => x.features.author === 1));

check('unknown algo → 400', (await get('/recommend/0439136350?algo=bogus')).status === 400);
check('unknown isbn → 404', (await get('/recommend/nope')).status === 404);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
