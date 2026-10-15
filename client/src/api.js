const j = async (url) => {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
};

export const api = {
  health: () => j('/api/health'),
  algorithms: () => j('/api/algorithms'),
  search: (q) => j(`/api/books/search?q=${encodeURIComponent(q)}&limit=12`),
  recommend: (isbn, algo, weights, limit = 12) => {
    const p = new URLSearchParams({ algo, limit });
    if (weights) for (const [k, v] of Object.entries(weights)) p.set(`w_${k}`, v);
    return j(`/api/recommend/${isbn}?${p}`);
  },
};
