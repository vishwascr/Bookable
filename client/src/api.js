const TOKEN_KEY = 'bookable_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

const j = async (url, opts = {}) => {
  const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(url, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
};

const weightParams = (p, weights) => {
  if (weights) {
    for (const [k, v] of Object.entries(weights)) {
      p.set(`w_${k}`, v);
    }
  }
  return p;
};

export const api = {
  health: () => j('/api/health'),
  algorithms: () => j('/api/algorithms'),
  search: (q) => j(`/api/books/search?q=${encodeURIComponent(q)}&limit=10`),
  searchPaginated: (q, page = 1, limit = 24) =>
    j(`/api/books/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  popular: () => j('/api/books/popular'),
  recommend: (isbn, algo, weights, limit = 12) =>
    j(`/api/recommend/${isbn}?${weightParams(new URLSearchParams({ algo, limit }), weights)}`),

  // User accounts & shelves
  signup: (body) => j('/api/auth/signup', { method: 'POST', body }),
  login: (body) => j('/api/auth/login', { method: 'POST', body }),
  me: () => j('/api/me'),
  setFavorites: (isbns) => j('/api/me/favorites', { method: 'PUT', body: { isbns } }),
  addWant: (isbn) => j(`/api/me/want/${isbn}`, { method: 'POST' }),
  removeWant: (isbn) => j(`/api/me/want/${isbn}`, { method: 'DELETE' }),
  forYou: (algo, weights, limit = 12) =>
    j(`/api/me/recommend?${weightParams(new URLSearchParams({ algo, limit }), weights)}`),

  // Shelves & Reading Status (M3)
  updateShelfStatus: (isbn, status) =>
    j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
  updateReadingStatus: (isbn, status) =>
    j(`/api/me/shelf/${isbn}`, { method: 'PUT', body: { status } }),
  getShelves: () => j('/api/me/shelves'),
  resetBooks: () => j('/api/me/reset-books', { method: 'POST' }),

  // Book Reviews & Ratings (M3)
  getBookReviews: (isbn) => j(`/api/books/${isbn}/reviews`),
  submitReview: (isbn, body) =>
    j(`/api/books/${isbn}/reviews`, { method: 'POST', body }),
  deleteReview: (reviewId) =>
    j(`/api/reviews/${reviewId}`, { method: 'DELETE' }),
  getMyReviews: () => j('/api/me/reviews'),
  deleteAllReviews: () => j('/api/me/reviews', { method: 'DELETE' }),
};

