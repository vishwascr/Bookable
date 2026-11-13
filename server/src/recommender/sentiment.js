// Pure on-device rule-based sentiment analyzer with literary domain lexicon,
// aspect extraction, star rating calibration, and dynamic recommendation adaptation.
// STRICT CONSTRAINT: Title similarity weighting is strictly excluded (w_title = 0).
import { engine } from './engine.js';
import { publicBook } from './algorithms.js';
import { inferGenres } from './metadata.js';

/**
 * Tailored literary sentiment lexicon.
 * Valences range from -4.0 (extreme literary failure) to +4.0 (masterpiece / peak acclaim).
 */
export const LITERARY_LEXICON = {
  // High Positive (+3.0 to +4.0)
  masterpiece: 4.0, 'magnum opus': 4.0, breathtaking: 3.8, spellbinding: 3.7, unputdownable: 3.8,
  brilliant: 3.5, magnificent: 3.5, profound: 3.5, captivating: 3.5, flawless: 3.8, phenomenal: 3.6,
  sublime: 3.6, riveting: 3.6, astonishing: 3.5, stellar: 3.4, exceptional: 3.5, genius: 3.5,
  exquisite: 3.3, lyrical: 3.2, poignant: 3.4, evocative: 3.3, engrossing: 3.5, triumph: 3.5,
  perfection: 3.8, treasure: 3.3, unforgettable: 3.4, compelling: 3.2, beloved: 3.2, mesmerizing: 3.6,
  masterful: 3.6, 'page-turner': 3.5, pageturner: 3.5, electrifying: 3.4, astounding: 3.5,
  transcendent: 3.7, extraordinary: 3.5, superb: 3.4,

  // Moderate Positive (+1.5 to +2.9)
  merit: 2.5, charm: 2.2, charming: 2.3, great: 2.5, good: 2.0, enjoyable: 2.2, engaging: 2.3, delightful: 2.4,
  witty: 2.2, thoughtful: 2.2, clever: 2.2, imaginative: 2.4, insightful: 2.5, entertaining: 2.2,
  satisfying: 2.4, solid: 1.8, pleasant: 1.8, readable: 1.8, recommend: 2.3, recommended: 2.5,
  love: 2.8, loved: 2.8, loving: 2.4, liked: 2.0, like: 1.8, impressive: 2.4, fresh: 2.0,
  heartfelt: 2.3, moving: 2.5, touching: 2.2, vivid: 2.2, rich: 2.2, dynamic: 2.0, nuanced: 2.3,
  rewarding: 2.4, fascinating: 2.6, gripping: 2.8, accessible: 1.8, polished: 2.2, authentic: 2.2,
  inviting: 1.9, memorable: 2.4, original: 2.3, wellwritten: 2.5, 'well-written': 2.5, beautiful: 2.6,
  resonant: 2.5, atmospheric: 2.6, favorite: 2.8, favourite: 2.8,

  // Mild Positive (+0.8 to +1.4)
  fine: 1.0, decent: 1.2, okay: 0.8, neat: 1.2, fair: 1.0, serviceable: 1.1, adequate: 1.0,
  promising: 1.4, competent: 1.2, crisp: 1.3, breezy: 1.4,

  // Mild Negative (-0.8 to -1.4)
  meh: -1.0, mediocre: -1.4, confusing: -1.4, average: -0.8, ordinary: -0.9, forgettable: -1.4,
  uneven: -1.2, inconsistent: -1.3, dated: -1.1,

  // Moderate Negative (-1.5 to -2.9)
  slow: -1.8, dragged: -2.3, dragging: -2.2, drag: -2.0, dull: -2.4, boring: -2.6,
  predictable: -2.2, cliche: -2.2, clichéd: -2.2, flat: -2.2, shallow: -2.2, formulaic: -2.3,
  uninspired: -2.3, plodding: -2.4, disappointing: -2.5, disappointed: -2.4, slog: -2.5,
  tedious: -2.5, wooden: -2.4, bland: -2.2, underwhelming: -2.4, contrived: -2.4, rushed: -2.0,
  bloated: -2.2, tiring: -2.0, overrated: -2.4, repetitive: -2.1, 'heavy-handed': -2.3,
  pretentious: -2.4, awkward: -2.0, melodramatic: -2.2, disjointed: -2.2, flawed: -1.8,
  annoying: -2.0, frustrating: -2.2, pointless: -2.5, unconvincing: -2.2, meandering: -2.1,

  // Severe Negative (-3.0 to -4.0)
  unreadable: -3.9, abysmal: -3.8, atrocious: -3.8, dreadful: -3.6, terrible: -3.5, awful: -3.5,
  horrific: -3.5, horrible: -3.6, waste: -3.6, garbage: -3.9, trash: -3.8, disaster: -3.5,
  hated: -3.5, hate: -3.4, worst: -3.8, pathetic: -3.5, insufferable: -3.6, intolerable: -3.5,
  painful: -3.4, cringe: -3.2, appalling: -3.6, repulsive: -3.5, worthless: -3.7, hopeless: -3.3,
};

export const INTENSIFIERS = new Map([
  ['very', 1.5], ['really', 1.4], ['extremely', 1.7], ['deeply', 1.6],
  ['incredibly', 1.7], ['profoundly', 1.7], ['remarkably', 1.6], ['absolutely', 1.8],
  ['truly', 1.5], ['utterly', 1.8], ['exceptionally', 1.6], ['highly', 1.5],
  ['completely', 1.5], ['totally', 1.5], ['especially', 1.4], ['immensely', 1.6],
  ['wildly', 1.6], ['unbelievably', 1.7], ['so', 1.4],
]);

export const DIMINISHERS = new Map([
  ['slightly', 0.65], ['somewhat', 0.70], ['marginally', 0.60],
  ['mildly', 0.70], ['barely', 0.45], ['hardly', 0.45],
  ['partially', 0.70], ['a bit', 0.65],
]);

export const NEGATORS = new Set([
  'not', 'never', 'no', 'neither', 'nor', 'scarcely', 'hardly', 'barely',
  'lacks', 'lacking', 'without', 'rarely', 'seldom', 'cannot', 'cant', "can't",
  'wont', "won't", 'dont', "don't", 'didnt', "didn't", 'doesnt', "doesn't",
  'isnt', "isn't", 'arent', "aren't", 'wasnt', "wasn't", 'werent', "weren't",
  'hasnt', "hasn't", 'havent', "haven't", 'hadnt', "hadn't", 'wouldnt', "wouldn't",
  'couldnt', "couldn't", 'shouldnt', "shouldn't",
]);

export const CONTRAST_CONJUNCTIONS = new Set([
  'but', 'however', 'although', 'yet', 'though', 'nevertheless', 'nonetheless', 'except',
]);

export const ASPECT_DEFINITIONS = [
  {
    category: 'pacing',
    fastTerms: ['fast-paced', 'fast paced', 'page-turner', 'unputdownable', 'breezy', 'action-packed', 'breakneck', 'rapid'],
    slowBurnTerms: ['slow-burn', 'slow burn', 'deliberate pace', 'unhurried', 'leisurely'],
    slowDragTerms: ['slow', 'slow-dragging', 'slow dragging', 'plodding', 'dragged', 'dragging', 'slog', 'sluggish', 'crawls', 'tedious'],
  },
  {
    category: 'world-building',
    triggers: ['world-building', 'world building', 'lore', 'setting', 'universe', 'mythology', 'magic system', 'realm', 'fictional world'],
  },
  {
    category: 'characters',
    richTerms: ['character-driven', 'character driven', 'complex characters', 'well-developed', 'compelling protagonist', 'character arc'],
    flatTerms: ['flat characters', 'cardboard characters', 'wooden characters', 'unlikable protagonist', 'one-dimensional'],
  },
  {
    category: 'tone',
    darkTerms: ['dark', 'gritty', 'bleak', 'grim', 'macabre', 'sinister', 'chilling', 'haunting', 'noir'],
    cozyTerms: ['cozy', 'comforting', 'wholesome', 'heartwarming', 'warm', 'feel-good', 'lighthearted', 'gentle'],
    humorTerms: ['funny', 'humorous', 'witty', 'hilarious', 'satirical', 'comic', 'amusing', 'laugh out loud'],
    philTerms: ['philosophical', 'thought-provoking', 'existential', 'intellectual', 'deep', 'profound themes'],
  },
  {
    category: 'prose',
    richTerms: ['lyrical', 'beautiful writing', 'poetic', 'atmospheric prose', 'eloquent', 'evocative'],
    flawTerms: ['purple prose', 'clunky writing', 'awkward dialogue', 'poorly written', 'heavy-handed'],
  },
  {
    category: 'plot',
    richTerms: ['gripping plot', 'twists', 'unpredictable', 'clever plot', 'intricate plot', 'satisfying ending'],
    flawTerms: ['predictable plot', 'clichéd plot', 'plot holes', 'formulaic', 'anticlimactic', 'contrived'],
  },
  {
    category: 'emotional',
    triggers: ['emotional', 'heartbreaking', 'tearjerker', 'moving', 'cried', 'poignant', 'gut-wrenching', 'touching'],
  },
];

export const CONTRAST_ASPECT_MAP = {
  'slow-dragging': ['fast-paced', 'gripping-plot'],
  'slow': ['fast-paced', 'gripping-plot'],
  'flat-characters': ['character-driven', 'complex-characters'],
  'dark-tone': ['cozy', 'wholesome', 'humorous'],
  'purple-prose': ['accessible', 'fast-paced'],
  'predictable-plot': ['twists', 'gripping-plot', 'unpredictable'],
};

/**
 * Analyzes review text and star rating to produce a calibrated sentiment analysis object.
 * Pure on-device rule-based, sub-millisecond execution.
 */
function analyzeReviewSentiment(text, starRating = null) {
  const cleanStr = String(text || '').trim();
  const lowerText = cleanStr.toLowerCase();

  const rawTokens = lowerText.match(/[a-z0-9'-]+/g) || [];

  let scoreAccumulator = 0;
  const positiveWords = [];
  const negativeWords = [];
  const intensifiersDetected = [];
  const negatorsDetected = [];

  let afterContrast = false;

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];

    if (CONTRAST_CONJUNCTIONS.has(token)) {
      afterContrast = true;
      continue;
    }

    let multiplier = afterContrast ? 1.4 : 1.0;

    // Look back for active negators within 3 tokens (scanning backward, stopping at prior lexicon word)
    const windowNegators = [];
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (LITERARY_LEXICON[rawTokens[j]] !== undefined) break; // Belongs to prior sentiment clause
      if (NEGATORS.has(rawTokens[j])) {
        windowNegators.unshift(rawTokens[j]);
      }
    }
    if (windowNegators.length > 0) {
      negatorsDetected.push(...windowNegators);
      if (windowNegators.length % 2 === 1) {
        multiplier *= -0.80; // Single negation: invert valence
      } else {
        multiplier *= 0.65;  // Double negation ("not without X"): affirms positive acclaim
      }
    }

    // Look back for immediate intensifier or diminisher (1 token prior)
    if (i > 0) {
      const prev = rawTokens[i - 1];
      if (INTENSIFIERS.has(prev)) {
        multiplier *= INTENSIFIERS.get(prev);
        intensifiersDetected.push(prev);
      } else if (DIMINISHERS.has(prev)) {
        multiplier *= DIMINISHERS.get(prev);
      }
    }

    // Lexicon evaluation (single word or bigram)
    let valence = LITERARY_LEXICON[token];
    let matchedToken = token;
    if (valence === undefined && i < rawTokens.length - 1) {
      const bigram = `${token} ${rawTokens[i + 1]}`;
      if (LITERARY_LEXICON[bigram] !== undefined) {
        valence = LITERARY_LEXICON[bigram];
        matchedToken = bigram;
        i++; // skip next token
      }
    }

    if (valence !== undefined) {
      const weightedValence = +(valence * multiplier).toFixed(2);
      scoreAccumulator += weightedValence;
      if (weightedValence > 0) {
        positiveWords.push({ word: matchedToken, weight: weightedValence });
      } else if (weightedValence < 0) {
        negativeWords.push({ word: matchedToken, weight: weightedValence });
      }
    }
  }

  // Hyperbolic curve bounded smoothly in [-1.0, +1.0]
  const hasTextSentiment = (positiveWords.length + negativeWords.length) > 0;
  const textPolarity = hasTextSentiment
    ? Math.max(-1, Math.min(1, scoreAccumulator / Math.sqrt(scoreAccumulator * scoreAccumulator + 15)))
    : 0.0;

  // Star rating normalization: 1 -> -1.0, 3 -> 0.0, 5 -> +1.0
  const hasStar = typeof starRating === 'number' && starRating >= 1 && starRating <= 5;
  const starPolarity = hasStar ? (starRating - 3) / 2.0 : 0.0;

  // Composite score calculation
  let compositeScore = 0.0;
  if (hasTextSentiment && hasStar) {
    compositeScore = 0.65 * textPolarity + 0.35 * starPolarity;
  } else if (hasStar) {
    compositeScore = starPolarity;
  } else if (hasTextSentiment) {
    compositeScore = textPolarity;
  }
  compositeScore = +Math.max(-1.0, Math.min(1.0, compositeScore)).toFixed(3);

  // Classification: positive (>= 0.20), negative (<= -0.20), neutral
  const classification = compositeScore >= 0.20 ? 'positive' : compositeScore <= -0.20 ? 'negative' : 'neutral';

  const detectedAspects = extractAspects(lowerText, compositeScore);

  const keywords = [...positiveWords, ...negativeWords]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 8)
    .map((k) => k.word);

  const matchCount = positiveWords.length + negativeWords.length;
  const confidence = +(Math.min(1.0, 0.5 + Math.abs(compositeScore) * 0.4 + Math.min(matchCount, 5) * 0.02)).toFixed(2);

  return {
    // Dual-field aliases for compatibility across all milestones
    score: compositeScore,
    polarity: compositeScore,
    label: classification,
    classification,
    confidence,

    aspects: detectedAspects.tags,
    aspectTags: detectedAspects.tags,
    aspectBreakdown: detectedAspects.breakdown,
    keywords,

    // Telemetry for Dev Mode Diagnostics HUD
    positiveWords,
    negativeWords,
    intensifiersDetected: [...new Set(intensifiersDetected)],
    negatorsDetected: [...new Set(negatorsDetected)],
    metrics: {
      rawScore: +scoreAccumulator.toFixed(2),
      textPolarity: +textPolarity.toFixed(3),
      starPolarity: +starPolarity.toFixed(3),
      tokensScanned: rawTokens.length,
      lexiconMatches: matchCount,
    },
  };
}

const ASPECT_TERM_REGEX_CACHE = new Map();

/**
 * Matches an aspect trigger term against lowerText using word boundaries.
 * Prevents "explores" from matching "lore", "upsetting" from matching "setting",
 * and "slow-burn" / "slow burn" from triggering lone "slow".
 */
function matchesAspectTerm(text, term) {
  let re = ASPECT_TERM_REGEX_CACHE.get(term);
  if (!re) {
    if (term === 'slow') {
      // Matches "slow" but excludes "slow-burn", "slow burn", and "slow-burning"
      re = /(?<![a-z0-9-])slow(?!([\s-]+burn)|[a-z0-9-])/i;
    } else {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`(?<![a-z0-9-])${escaped}(?![a-z0-9-])`, 'i');
    }
    ASPECT_TERM_REGEX_CACHE.set(term, re);
  }
  return re.test(text);
}

function extractAspects(lowerText, docPolarity) {
  const tags = new Set();
  const breakdown = {};

  for (const def of ASPECT_DEFINITIONS) {
    if (def.category === 'pacing') {
      if (def.fastTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('fast-paced');
        breakdown['fast-paced'] = 'positive';
      }
      if (def.slowBurnTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('slow-burn');
        breakdown['slow-burn'] = docPolarity >= 0 ? 'positive' : 'neutral';
      }
      if (def.slowDragTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('slow-dragging');
        breakdown['slow-dragging'] = 'negative';
      }
    } else if (def.category === 'characters') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('character-driven');
        breakdown['character-driven'] = 'positive';
      }
      if (def.flatTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('flat-characters');
        breakdown['flat-characters'] = 'negative';
      }
    } else if (def.category === 'tone') {
      if (def.darkTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('dark-tone');
        breakdown['dark-tone'] = 'neutral';
      }
      if (def.cozyTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('cozy');
        breakdown['cozy'] = 'positive';
      }
      if (def.humorTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('humorous');
        breakdown['humorous'] = 'positive';
      }
      if (def.philTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('philosophical');
        breakdown['philosophical'] = 'positive';
      }
    } else if (def.category === 'world-building') {
      if (def.triggers.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('world-building');
        breakdown['world-building'] = docPolarity >= 0 ? 'positive' : 'neutral';
      }
    } else if (def.category === 'prose') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('lyrical-prose');
        breakdown['lyrical-prose'] = 'positive';
      }
      if (def.flawTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('purple-prose');
        breakdown['purple-prose'] = 'negative';
      }
    } else if (def.category === 'plot') {
      if (def.richTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('gripping-plot');
        breakdown['gripping-plot'] = 'positive';
      }
      if (def.flawTerms.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('predictable-plot');
        breakdown['predictable-plot'] = 'negative';
      }
    } else if (def.category === 'emotional') {
      if (def.triggers.some((t) => matchesAspectTerm(lowerText, t))) {
        tags.add('emotional');
        breakdown['emotional'] = 'positive';
      }
    }
  }

  return { tags: [...tags], breakdown };
}

/**
 * Dynamically adapts and expands recommendations reflecting the sentiment of a user's review.
 * Strictly excludes title similarity weighting (w_title = 0).
 */
export function adaptRecommendationsBySentiment(sentimentResult, targetBookOrIsbn, options = {}) {
  const { limit = 12, exclude = [], devMode = false } = options;
  const t0 = performance.now();
  const eng = engine();
  const books = eng.books || [];
  const byIsbn = eng.byIsbn || new Map();

  // Resolve target book
  let target = null;
  if (typeof targetBookOrIsbn === 'string') {
    const idx = byIsbn.get(targetBookOrIsbn);
    if (idx !== undefined) target = books[idx];
  } else if (targetBookOrIsbn && typeof targetBookOrIsbn === 'object') {
    target = targetBookOrIsbn;
  }

  const excludeIsbns = new Set(exclude);
  let targetDKey = '';
  if (target) {
    excludeIsbns.add(target.isbn);
    targetDKey = target.dKey || '';
  }

  const score = sentimentResult.score !== undefined ? sentimentResult.score : (sentimentResult.polarity !== undefined ? sentimentResult.polarity : 0);
  const label = sentimentResult.label || sentimentResult.classification || (score >= 0.2 ? 'positive' : score <= -0.2 ? 'negative' : 'neutral');
  const aspects = sentimentResult.aspects || sentimentResult.aspectTags || [];
  const breakdown = sentimentResult.aspectBreakdown || {};

  const praisedAspects = aspects.filter((a) => breakdown[a] === 'positive' || (breakdown[a] !== 'negative' && score > 0));
  const criticizedAspects = aspects.filter((a) => breakdown[a] === 'negative' || (score < 0 && (a.includes('slow') || a.includes('flat') || a.includes('predictable'))));

  const contrastingVibes = [];
  if (label === 'negative') {
    for (const c of criticizedAspects) {
      const contrasts = CONTRAST_ASPECT_MAP[c];
      if (contrasts) contrastingVibes.push(...contrasts);
    }
    if (contrastingVibes.length === 0) {
      contrastingVibes.push('fast-paced', 'gripping-plot', 'cozy');
    }
  }

  const mode = label === 'positive' ? 'positive_reinforce' : label === 'negative' ? 'negative_contrast' : 'neutral_balanced';

  // Candidate generation using inverted maps if ready, plus catalog distribution
  const candidateIndices = new Set();
  const maxPoolSize = 1500;

  // 1. Same author (only if positive/neutral; penalized if negative)
  if (target && target.aKey && label !== 'negative' && eng.byAuthor) {
    const authorList = eng.byAuthor.get(target.aKey) || [];
    for (const idx of authorList) {
      candidateIndices.add(idx);
      if (candidateIndices.size >= maxPoolSize) break;
    }
  }

  // 2. Genres from byGenre map
  const targetGenres = target ? (target.genres || inferGenres(target)) : [];
  if (eng.byGenre) {
    for (const g of targetGenres) {
      const gList = eng.byGenre.get(g) || [];
      const sample = gList.slice(0, 300);
      for (const idx of sample) {
        candidateIndices.add(idx);
        if (candidateIndices.size >= maxPoolSize) break;
      }
    }
  }

  // 3. Praised aspects or contrasting vibes from byTag map
  const targetTags = label === 'negative' ? contrastingVibes : praisedAspects;
  if (eng.byTag) {
    for (const t of targetTags) {
      const tList = eng.byTag.get(t) || [];
      const sample = tList.slice(0, 150);
      for (const idx of sample) {
        candidateIndices.add(idx);
        if (candidateIndices.size >= maxPoolSize) break;
      }
    }
  }

  // 4. Fill from catalog if needed
  if (books.length > 0) {
    const step = Math.max(1, Math.floor(books.length / 500));
    for (let i = 0; i < books.length && candidateIndices.size < maxPoolSize; i += step) {
      candidateIndices.add(i);
    }
  }

  // Score candidates with STRICT exclusion of title similarity
  const scored = [];
  for (const idx of candidateIndices) {
    const cand = books[idx];
    if (!cand || excludeIsbns.has(cand.isbn)) continue;
    if (targetDKey && cand.dKey === targetDKey) continue; // collapse alternate editions of seed

    const authorMatch = target && target.aKey && target.aKey === cand.aKey ? 1 : 0;
    const ratingNorm = (cand.rating !== undefined ? cand.rating : 4.0) / 5.0;

    const candGenres = cand.genres || inferGenres(cand);
    const candTags = cand.tags || [];

    // Genre similarity (Jaccard)
    let genreSim = 0;
    if (targetGenres.length > 0 && candGenres.length > 0) {
      const intersection = candGenres.filter((g) => targetGenres.includes(g)).length;
      const union = new Set([...targetGenres, ...candGenres]).size;
      genreSim = union > 0 ? intersection / union : 0;
    }

    let candScore = 0;
    if (mode === 'positive_reinforce') {
      let aspectAffinity = 0;
      if (praisedAspects.length > 0) {
        const matchCount = praisedAspects.filter((a) => candTags.includes(a) || candGenres.some((g) => g.toLowerCase().includes(a))).length;
        aspectAffinity = matchCount / praisedAspects.length;
      }
      candScore = 0.35 * genreSim + 0.25 * authorMatch + 0.25 * aspectAffinity + 0.15 * ratingNorm;
    } else if (mode === 'negative_contrast') {
      let negativePenalty = 0;
      if (authorMatch) negativePenalty += 0.40;
      for (const crit of criticizedAspects) {
        if (candTags.includes(crit)) negativePenalty += 0.30;
      }

      let contrastAffinity = 0;
      if (contrastingVibes.length > 0) {
        const matchCount = contrastingVibes.filter((v) => candTags.includes(v) || candGenres.some((g) => g.toLowerCase().includes(v))).length;
        contrastAffinity = matchCount / contrastingVibes.length;
      }

      candScore = 0.40 * contrastAffinity + 0.35 * ratingNorm + 0.25 * (1.0 - genreSim) - negativePenalty;
    } else {
      // Neutral balanced
      candScore = 0.45 * genreSim + 0.35 * ratingNorm + 0.20 * authorMatch;
    }

    if (candScore > 0) {
      scored.push({
        idx,
        score: +candScore.toFixed(4),
        breakdown: { genreSim: +genreSim.toFixed(3), authorMatch, ratingNorm: +ratingNorm.toFixed(3) },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const seenWorkKeys = new Set();
  const adaptedRecommendations = [];

  for (const s of scored) {
    const b = books[s.idx];
    if (seenWorkKeys.has(b.dKey)) continue;
    seenWorkKeys.add(b.dKey);

    const formatted = publicBook(b);
    if (devMode) {
      formatted._dev = {
        adaptiveScore: s.score,
        breakdown: s.breakdown,
        titleExcluded: true,
      };
    }
    adaptedRecommendations.push(formatted);
    if (adaptedRecommendations.length >= limit) break;
  }

  const targetTitle = target ? target.title : 'your recent book';
  let reason = '';
  if (mode === 'positive_reinforce') {
    const aspectStr = praisedAspects.length ? praisedAspects.join(', ') : 'themes';
    reason = `Because you loved "${targetTitle}": expanding on its ${aspectStr}`;
  } else if (mode === 'negative_contrast') {
    const contrastStr = contrastingVibes.slice(0, 2).join(' & ');
    reason = `Looking for a change of pace from "${targetTitle}"? Contrasting ${contrastStr} alternatives`;
  } else {
    reason = `Refined recommendations for readers of "${targetTitle}"`;
  }

  const diagnostics = {
    mode,
    reason,
    titleExcluded: true,
    candidatesEvaluated: candidateIndices.size,
    praisedAspects,
    criticizedAspects,
    contrastingVibes: [...new Set(contrastingVibes)],
    latencyMs: +(performance.now() - t0).toFixed(2),
  };

  // Provide dual structure: Array that also acts as object with adaptedRecommendations
  const result = [...adaptedRecommendations];
  result.adaptedRecommendations = adaptedRecommendations;
  result.diagnostics = diagnostics;

  return result;
}

export { analyzeReviewSentiment, analyzeReviewSentiment as analyzeSentiment };
