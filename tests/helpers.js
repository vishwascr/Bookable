/**
 * E2E Test Helpers for Bookable
 * Uses Node 24 native fetch, buffer, and assertions.
 */

import crypto from 'node:crypto';

export const API_BASE = process.env.API_URL || 'http://127.0.0.1:5050/api';

/**
 * Standard known ISBNs verified against Books.csv and POPULAR_ISBNS
 */
export const KNOWN_SEEDS = Object.freeze({
  HOBBIT: '0345339681',               // The Hobbit - J.R.R. Tolkien
  DUNE: '0441172660',                 // Dune - Frank Herbert
  HP_AZKABAN: '0439136350',           // Harry Potter & Prisoner of Azkaban - J.K. Rowling
  NINETEEN_EIGHTY_FOUR: '0451524934', // 1984 - George Orwell
  HP_SORCERER: '059035342X',          // Harry Potter & Sorcerer's Stone - J.K. Rowling
  DA_VINCI: '0385504209',             // The Da Vinci Code - Dan Brown
  MOCKINGBIRD: '0446310786',          // To Kill a Mockingbird - Harper Lee
  STAR_TREK: '0671461494',            // Star Trek
  CATCHER: '0316769487',              // The Catcher in the Rye - J.D. Salinger
  BRAVE_NEW_WORLD: '0060929871',      // Brave New World - Aldous Huxley
  FAHRENHEIT_451: '0345342968',       // Fahrenheit 451 - Ray Bradbury
  NON_EXISTENT_ISBN: '9999999999999'  // Guaranteed non-existent ISBN
});

/**
 * Uniform HTTP request wrapper using native fetch
 */
export async function request(method, path, body = null, token = null, timeoutMs = 15000) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  const headers = {
    Accept: 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody = null;
  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(timeoutMs)
    });

    let parsedBody = null;
    const contentType = res.headers.get('content-type') || '';
    if (res.status !== 204) {
      if (contentType.includes('application/json')) {
        parsedBody = await res.json();
      } else {
        parsedBody = await res.text();
      }
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      body: parsedBody
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      headers: new Headers(),
      body: { error: err.message },
      networkError: true
    };
  }
}

/**
 * Generate a unique valid username matching /^[a-z0-9_.-]{3,30}$/
 */
export function uniqueUsername(prefix = 'u') {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'user';
  const rand = Math.random().toString(36).slice(2, 7);
  const time = Date.now().toString(36).slice(-6);
  return `${cleanPrefix}_${time}_${rand}`.slice(0, 30);
}

/**
 * Register a fresh user and return credentials and session token
 */
export async function createTestUser(prefix = 'test_u') {
  const username = uniqueUsername(prefix);
  const password = 'Password123!';
  const displayName = `${prefix.toUpperCase()} Test`;

  const res = await request('POST', '/auth/signup', {
    username,
    password,
    displayName
  });

  return {
    status: res.status,
    ok: res.ok,
    username,
    password,
    displayName,
    token: res.body?.token || null,
    user: res.body?.user || null,
    res
  };
}

/**
 * Log in an existing user and return token and user profile
 */
export async function loginUser(username, password) {
  const res = await request('POST', '/auth/login', {
    username,
    password
  });

  return {
    status: res.status,
    ok: res.ok,
    token: res.body?.token || null,
    user: res.body?.user || null,
    res
  };
}

/**
 * Check if the backend API and recommender index are ready
 */
export async function checkServerReady(maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await request('GET', '/health', null, null, 2000);
      if (res.ok && res.body?.ok === true && res.body?.ready === true) {
        return true;
      }
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Attempt cleanup of user books and reviews via API
 */
export async function cleanupUser(token) {
  if (!token) return;
  try {
    await request('POST', '/me/reset-books', {}, token, 3000);
  } catch {
    // Ignore if endpoint is in-progress
  }
  try {
    await request('DELETE', '/me/reviews', null, token, 3000);
  } catch {
    // Ignore if endpoint is in-progress
  }
}

/**
 * Decode JWT claims without signature verification (for test assertions on payload)
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Generate a JWT token using Node.js native crypto
 */
export function createSignedToken(payload, secret = process.env.JWT_SECRET || 'bookable-dev-secret-change-me') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
    exp: now + 7 * 24 * 60 * 60,
    ...payload
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${sig}`;
}

