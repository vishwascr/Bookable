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

// ---- accounts & personalised recommendations ----
const send = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const uname = `smoke_${Date.now()}`;
const su = await send('POST', '/auth/signup', { username: uname, password: 'secret123' });
check('signup → 201 + token', su.status === 201 && !!su.body.token && su.body.user.onboarded === false);
check('duplicate signup → 409', (await send('POST', '/auth/signup', { username: uname, password: 'secret123' })).status === 409);
check('bad password login → 401', (await send('POST', '/auth/login', { username: uname, password: 'nope' })).status === 401);
const li = await send('POST', '/auth/login', { username: uname, password: 'secret123' });
const T = li.body.token;
check('login → token', li.status === 200 && !!T);
check('/me without token → 401', (await get('/me')).status === 401);
check('popular books for onboarding', (await get('/books/popular')).body.length >= 20);
check('favorites < 3 → 400', (await send('PUT', '/me/favorites', { isbns: ['0345339681'] }, T)).status === 400);
const favs = ['0345339681', '0441172660', '0671461494'];
const fv = await send('PUT', '/me/favorites', { isbns: favs }, T);
check('set 3 favorites → onboarded', fv.status === 200 && fv.body.user.onboarded === true);
const fy = await send('GET', '/me/recommend?algo=all&limit=10', null, T);
check('for-you runs all 5 algorithms', fy.status === 200 && fy.body.runs.length === 5);
for (const run of fy.body.runs || []) {
  const noFav = run.results.every((x) => !favs.includes(x.book.isbn));
  const contribOk = run.results.every((x) => Object.keys(x.contributions).every((i) => favs.includes(i)) && x.matchedSeeds >= 1);
  const seedsUsed = new Set(run.results.map((x) => x.bestSeed)).size;
  check(`  ${run.algorithm}: favourites excluded, contributions valid`, run.results.length > 0 && noFav && contribOk, `${run.results.length} results, ${seedsUsed} favourites represented, ${run.meta.ms}ms`);
}
const target = fy.body.runs[0].results[0].book.isbn;
await send('POST', `/me/want/${target}`, null, T);
const fy2 = await send('GET', '/me/recommend?algo=tfidf&limit=10', null, T);
check('want-to-read book excluded from For You', fy2.body.runs[0].results.every((x) => x.book.isbn !== target));
const me = await send('GET', '/me', null, T);
check('/me returns shelves', me.body.favorites.length === 3 && me.body.wantToRead.length === 1);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);

