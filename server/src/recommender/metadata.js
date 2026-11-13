// Metadata inference, taxonomy classification, and Bayesian catalog rating.
import { normalize } from './text.js';

export const GENRES = [
  'Fantasy',
  'Science Fiction',
  'Mystery & Thriller',
  'Romance',
  'Historical Fiction',
  'Horror',
  'Classics & Literature',
  'Biography & Memoir',
  'Philosophy & Religion',
  'Science & Nature',
  'History & Politics',
  'Self-Help & Psychology',
  'Young Adult & Children',
  'Poetry & Plays',
  'Art, Cooking & Lifestyle',
  'General Fiction',
];

const GENRE_RULES = [
  {
    genre: 'Fantasy',
    keywords: [
      'dragon', 'dragons', 'sword', 'swords', 'magic', 'magical', 'wizard', 'wizards',
      'witch', 'witches', 'realm', 'realms', 'chronicles', 'quest', 'quests', 'sorcery',
      'sorcerer', 'elf', 'elves', 'elven', 'kingdom', 'tolkien', 'jordan', 'pratchett',
      'sanderson', 'del rey', 'tor books', 'hobbit', 'narnia', 'potter', 'fellowship',
      'gandalf', 'valdemar', 'shannara', 'dune', 'mythology', 'fairy tale', 'enchanted',
    ],
  },
  {
    genre: 'Science Fiction',
    keywords: [
      'space', 'star', 'stars', 'galaxy', 'galaxies', 'alien', 'aliens', 'cyber',
      'cyberpunk', 'robot', 'robots', 'future', 'futuristic', 'planet', 'planets',
      'asimov', 'clarke', 'philip k dick', 'heinlein', 'baen', 'android', 'androids',
      'spaceship', 'spaceships', 'sci fi', 'scifi', 'interstellar', 'martian', 'mars',
      'time travel', 'time machine', 'matrix', 'star trek', 'star wars', 'nebula',
    ],
  },
  {
    genre: 'Mystery & Thriller',
    keywords: [
      'murder', 'murders', 'death', 'homicide', 'detective', 'detectives', 'killer',
      'killers', 'crime', 'crimes', 'conspiracy', 'case', 'investigation', 'grisham',
      'christie', 'patterson', 'forensic', 'suspense', 'thriller', 'thrillers', 'sherlock',
      'holmes', 'clue', 'mystery', 'mysteries', 'blackmail', 'victim', 'victims', 'spy',
      'spies', 'espionage', 'le carre', 'coben', 'baldacci', 'courtroom', 'guilty',
    ],
  },
  {
    genre: 'Romance',
    keywords: [
      'love', 'heart', 'hearts', 'passion', 'passionate', 'bride', 'brides', 'kiss',
      'kisses', 'romance', 'romantic', 'desire', 'forever', 'harlequin', 'silhouette',
      'sparks', 'beloved', 'wedding', 'darling', 'seduction', 'flirt', 'lover', 'lovers',
      'nora roberts', 'danielle steel', 'nicholas sparks', 'passion', 'sweetheart',
    ],
  },
  {
    genre: 'Historical Fiction',
    keywords: [
      'war', 'wars', 'empire', 'empires', 'normandy', 'holocaust', 'medieval', 'century',
      'rebellion', 'king', 'queen', 'victorian', 'civil war', 'roman', 'crusade',
      'crusades', 'dynasty', 'tudor', 'revolution', 'world war', 'battle', 'churchill',
      'confederacy', 'plantation', 'regency', 'gladiator', 'ancient rome',
    ],
  },
  {
    genre: 'Horror',
    keywords: [
      'blood', 'nightmare', 'nightmares', 'darkness', 'curse', 'cursed', 'ghost', 'ghosts',
      'haunted', 'shadow', 'shadows', 'vampire', 'vampires', 'stephen king', 'koontz',
      'zombie', 'zombies', 'demon', 'demons', 'horror', 'dracula', 'terror', 'macabre',
      'frankenstein', 'werewolf', 'werewolves', 'clive barker', 'lovecraft', 'fright',
    ],
  },
  {
    genre: 'Classics & Literature',
    keywords: [
      'oxford university press', 'cambridge', 'penguin classics', 'plume contemporary',
      'shakespeare', 'homer', 'dostoevsky', 'dickens', 'jane austen', 'fitzgerald',
      'hemingway', 'bronte', 'tolstoy', 'virginia woolf', 'kafka', 'joyce', 'odyssey',
      'iliad', 'great gatsby', 'classic literature', 'greatest works', 'anthology',
    ],
  },
  {
    genre: 'Biography & Memoir',
    keywords: [
      'memoir', 'memoirs', 'biography', 'biographies', 'autobiography', 'diary', 'diaries',
      'letters', 'life of', 'story of', 'personal history', 'portrait', 'collected letters',
      'an autobiography', 'my life', 'chronicle of', 'memories', 'reflections',
    ],
  },
  {
    genre: 'Philosophy & Religion',
    keywords: [
      'philosophy', 'philosophical', 'ethics', 'god', 'theology', 'faith', 'soul',
      'souls', 'meditation', 'bible', 'biblical', 'buddha', 'buddhism', 'spiritual',
      'spirituality', 'jesus', 'christ', 'christianity', 'testament', 'quran', 'koran',
      'zen', 'tao', 'nietzsche', 'plato', 'aristotle', 'descartes', 'kant', 'prayer',
    ],
  },
  {
    genre: 'Science & Nature',
    keywords: [
      'physics', 'chemistry', 'biology', 'evolution', 'universe', 'influenza', 'pandemic',
      'dinosaur', 'dinosaurs', 'quantum', 'nature', 'wild', 'wilderness', 'ocean',
      'oceans', 'astronomy', 'ecology', 'animal', 'animals', 'genetics', 'cosmos',
      'hawking', 'carl sagan', 'richard dawkins', 'scientific', 'geology',
    ],
  },
  {
    genre: 'History & Politics',
    keywords: [
      'history', 'historical', 'revolution', 'politics', 'political', 'democracy',
      'presidency', 'warfare', 'foreign affairs', 'government', 'constitution', 'cold war',
      'congress', 'election', 'diplomat', 'diplomacy', 'geopolitics', 'capitalism',
      'socialism', 'parliament',
    ],
  },
  {
    genre: 'Self-Help & Psychology',
    keywords: [
      'chicken soup', 'habits', 'psychology', 'psychological', 'guide', 'success',
      'healing', 'mind', 'happiness', 'self help', 'self-help', 'inspire', 'inspiring',
      'inspiration', 'motivation', 'anxiety', 'therapy', 'mindfulness', 'leadership',
      'wealth', 'how to', 'living', 'overcome', 'counseling',
    ],
  },
  {
    genre: 'Young Adult & Children',
    keywords: [
      'scholastic', 'fairy', 'fairies', 'boy', 'boys', 'girl', 'girls', 'puppy',
      'puppies', 'adventure', 'adventures', 'aladdin', 'disney', 'mary kate and ashley',
      'golden books', 'goosebumps', 'dr seuss', 'potter', 'narnia', 'young adult', 'ya',
      'children', 'kids', 'junior', 'middle grade', 'babysitters club', 'animorphs',
    ],
  },
  {
    genre: 'Poetry & Plays',
    keywords: [
      'poem', 'poems', 'poetry', 'sonnet', 'sonnets', 'verse', 'verses', 'play',
      'plays', 'dramatic', 'anthology of verse', 'collected poems', 'broadway', 'tragedy',
      'comedy of', 'poet', 'robert frost', 'emily dickinson', 'neruda', 'whitman',
    ],
  },
  {
    genre: 'Art, Cooking & Lifestyle',
    keywords: [
      'recipe', 'recipes', 'cooking', 'cook', 'cookbook', 'cookbooks', 'vegetarian',
      'vegan', 'photography', 'design', 'art', 'arts', 'baking', 'bake', 'meals',
      'kitchen', 'diet', 'diets', 'wine', 'gardening', 'crafts', 'fashion', 'interior design',
      'culinary', 'gourmet',
    ],
  },
];

// DJB2 hash for deterministic baseline rating calculation
function hashString(str = '') {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Infer 1 to 3 literary genres for a book based on title, author, and publisher.
 * Returns array of matching genres, falling back to ['General Fiction'].
 */
export function inferGenres(book = {}) {
  const b = book || {};
  const titleNorm = normalize(b.title || '');
  const authorNorm = normalize(b.author || '');
  const pubNorm = normalize(b.publisher || '');
  const fullText = `${titleNorm} ${authorNorm} ${pubNorm}`;

  const scores = [];

  for (const rule of GENRE_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      // Word boundary check
      const regex = new RegExp(`\\b${kw.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(titleNorm)) score += 3.0;
      else if (regex.test(authorNorm)) score += 2.0;
      else if (regex.test(pubNorm)) score += 1.5;
      else if (regex.test(fullText)) score += 1.0;
    }
    if (score > 0) {
      scores.push({ genre: rule.genre, score });
    }
  }

  if (scores.length === 0) {
    return ['General Fiction'];
  }

  scores.sort((a, b) => b.score - a.score);

  // Return up to 3 genres that are within 50% score of the top genre
  const topScore = scores[0].score;
  const picked = scores
    .filter((s) => s.score >= topScore * 0.4)
    .slice(0, 3)
    .map((s) => s.genre);

  return picked.length ? picked : [scores[0].genre];
}

/**
 * Canonical 16-genre taxonomy to descriptive vibe tags.
 */
export const GENRE_VIBE_MAP = {
  'Fantasy': ['high-fantasy', 'mythic'],
  'Science Fiction': ['sci-fi', 'speculative'],
  'Mystery & Thriller': ['mystery', 'suspense'],
  'Romance': ['romance', 'relationship-drama'],
  'Historical Fiction': ['historical', 'period-piece'],
  'Horror': ['dark-horror', 'chilling'],
  'Classics & Literature': ['literary-classic', 'canonical'],
  'Biography & Memoir': ['biographical', 'memoir'],
  'Philosophy & Religion': ['philosophical', 'theological'],
  'Science & Nature': ['scientific', 'nature-science'],
  'History & Politics': ['military-history', 'political'],
  'Self-Help & Psychology': ['self-improvement', 'psychological'],
  'Young Adult & Children': ['young-adult', 'coming-of-age'],
  'Poetry & Plays': ['poetry', 'dramatic-works'],
  'Art, Cooking & Lifestyle': ['arts-culture', 'culinary'],
  'General Fiction': ['contemporary-fiction'],
};

/**
 * Infer 3 to 10 semantic tags for a book based strictly on publication era,
 * publisher format/imprint, catalog genres, and author themes.
 * STRICT ENFORCEMENT: book.title is NEVER read or tokenized.
 */
export function inferTags(book = {}) {
  const b = book || {};
  const tags = new Set();

  // 1. Publication Era (from publication year)
  const yr = Number(b.year);
  if (yr && yr > 1800 && yr <= 2030) {
    if (yr >= 2020) tags.add('2020s');
    else if (yr >= 2010) tags.add('2010s');
    else if (yr >= 2000) tags.add('2000s');
    else if (yr >= 1990) tags.add('1990s');
    else if (yr >= 1980) tags.add('1980s');
    else if (yr >= 1970) tags.add('1970s');
    else if (yr >= 1960) tags.add('1960s');
    else if (yr >= 1950) tags.add('1950s');
    else tags.add('classic-era');
  }

  // 2. Publisher Format & Imprint Tags (from publisher name)
  const pub = normalize(b.publisher || '');
  if (pub) {
    if (pub.includes('press') || pub.includes('university') || pub.includes('oxford') || pub.includes('cambridge')) {
      tags.add('university-press');
    }
    if (
      pub.includes('harlequin') ||
      pub.includes('silhouette') ||
      pub.includes('bantam') ||
      pub.includes('ballantine') ||
      pub.includes('pocket') ||
      pub.includes('del rey') ||
      pub.includes('tor') ||
      pub.includes('ace') ||
      pub.includes('baen')
    ) {
      tags.add('paperback-series');
    }
    if (
      pub.includes('scholastic') ||
      pub.includes('disney') ||
      pub.includes('golden') ||
      pub.includes('aladdin') ||
      pub.includes('puffin')
    ) {
      tags.add('childrens-press');
    }
    if (
      pub.includes('vintage') ||
      pub.includes('penguin') ||
      pub.includes('harper') ||
      pub.includes('random house') ||
      pub.includes('simon') ||
      pub.includes('knopf') ||
      pub.includes('norton')
    ) {
      tags.add('trade-edition');
    }
  }

  // 3. Genre-Derived Thematic Vibes (from canonical catalog genres)
  if (Array.isArray(b.genres)) {
    for (const g of b.genres) {
      const vibes = GENRE_VIBE_MAP[g];
      if (vibes) {
        for (const v of vibes) tags.add(v);
      }
    }
  }

  // 4. Renowned Author Thematic Vibes (from author name ONLY, NEVER title)
  const authorNorm = normalize(b.author || '');
  if (authorNorm) {
    if (/\b(tolkien|jordan|pratchett|sanderson|rowling|martin|hobb|rothfuss|le guin)\b/.test(authorNorm)) {
      tags.add('high-fantasy');
    }
    if (/\b(asimov|clarke|dick|heinlein|herbert|gibson|card|bradbury)\b/.test(authorNorm)) {
      tags.add('sci-fi');
    }
    if (/\b(christie|doyle|patterson|grisham|coben|connelly)\b/.test(authorNorm)) {
      tags.add('mystery');
    }
    if (/\b(king|koontz|barker|lovecraft|rice|stoker)\b/.test(authorNorm)) {
      tags.add('dark-horror');
    }
    if (/\b(roberts|steel|sparks|quinn|henry)\b/.test(authorNorm)) {
      tags.add('romance');
    }
  }

  // Fallback tag if empty
  if (tags.size === 0) {
    tags.add('general');
  }

  return [...tags].slice(0, 10);
}

/**
 * Deterministically compute a catalog baseline rating in [3.80, 4.60] for a book.
 */
export function computeBaselineRating(bookOrIsbn = '') {
  const b = bookOrIsbn || '';
  const isbn = typeof b === 'string' ? b : (b.isbn || b.title || '');
  const hash = Math.abs(hashString(isbn));
  const val = 3.80 + ((hash % 81) / 100); // 3.80 to 4.60
  return +val.toFixed(2);
}

/**
 * Compute the Bayesian catalog rating blending catalog prior and user reviews.
 * Formula: (C * prior + sum(ratings)) / (C + N)
 * Default prior = 4.0 (or baseline), C = 3.
 */
export function getCatalogRating(bookOrIsbn, userReviews = []) {
  const b = bookOrIsbn || '';
  const prior = typeof b === 'object' && b ? computeBaselineRating(b) : 4.0;
  const C = 3;

  if (!Array.isArray(userReviews) || userReviews.length === 0) {
    return prior;
  }

  let sum = 0;
  let count = 0;
  for (const r of userReviews) {
    const val = typeof r === 'number' ? r : (r && typeof r.rating === 'number' ? r.rating : null);
    if (val !== null && val >= 1 && val <= 5) {
      sum += val;
      count++;
    }
  }

  if (count === 0) return prior;

  const bayesian = (C * prior + sum) / (C + count);
  return +bayesian.toFixed(2);
}

/**
 * Index a book's inferred genres and tags into inverted maps.
 */
export function indexMetadata(book, idx, byGenre, byTag) {
  if (!book) return;
  if (!book.genres) book.genres = inferGenres(book);
  if (!book.tags) book.tags = inferTags(book);
  if (book.rating === undefined) book.rating = computeBaselineRating(book);

  for (const g of book.genres) {
    let list = byGenre.get(g);
    if (!list) {
      list = [];
      byGenre.set(g, list);
    }
    list.push(idx);
  }

  for (const t of book.tags) {
    let list = byTag.get(t);
    if (!list) {
      list = [];
      byTag.set(t, list);
    }
    list.push(idx);
  }
}
