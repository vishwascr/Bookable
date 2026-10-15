// Text normalisation shared by all algorithms.
const STOP = new Set(
  ('a an the of and or in on at to for from by with without into is are was be as it its this that ' +
    'vol volume book books edition ed novel series no part paperback hardcover de la le el les der die das und y ' +
    'audio cd cassette unabridged abridged grade grades large print mass market reprint tome collector')
    .split(' ')
);

// The dataset contains raw HTML entities such as "&amp;" in titles.
export function decode(s = '') {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function normalize(s = '') {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(s = '') {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
    .map(stem);
}

// Tiny suffix stemmer: good enough to merge "dragons"/"dragon", "stories"/"story".
function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

// Normalise author names so "J. K. Rowling" == "J.K. Rowling" == "j k rowling".
export function authorKey(a = '') {
  return normalize(a).replace(/\s/g, '');
}
