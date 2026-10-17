// The items table has no category column, so a category is guessed from the item's name
// (Hungarian and English). Used only to find "similar" sold items for Buy check.

// Short words must match a whole word; longer stems match anywhere in a word, which also
// catches endings and compounds ("kisruha" is a dress, "pulcsik" are jumpers).
const CATEGORY_WORDS = {
  tops: {
    exact: ['top', 'ing', 'body', 'polo', 'tee'],
    stems: ['polo', 'felso', 'bluz', 'pulcsi', 'pulover', 'kardigan', 'trik', 'atleta', 'shirt', 'sweater',
      'sweatshirt', 'hoodie', 'cardigan', 'crop', 'shoulder', 'ujju', 'mikina', 'kapucnis'],
  },
  bottoms: {
    exact: [],
    stems: ['nadrag', 'farmer', 'jeans', 'szoknya', 'short', 'rovidnadrag', 'leggings', 'jogger',
      'skirt', 'pants', 'trousers', 'flared', 'szabadido'],
  },
  dresses: { exact: [], stems: ['ruha', 'dress', 'overall', 'jumpsuit', 'kosztum'] },
  outerwear: {
    exact: [],
    stems: ['kabat', 'dzseki', 'blezer', 'blazer', 'melleny', 'coat', 'jacket', 'parka', 'bunda'],
  },
  shoes: {
    exact: [],
    stems: ['cipo', 'csizma', 'szandal', 'papucs', 'sneaker', 'boots', 'bakancs', 'tornacipo', 'balerina'],
  },
  bags: { exact: ['bag'], stems: ['taska', 'hatizsak', 'penztarca', 'backpack'] },
  accessories: {
    exact: ['ov', 'belt', 'hat', 'sal', 'ora', 'scarf'],
    stems: ['sapka', 'kalap', 'kesztyu', 'szemuveg', 'ekszer', 'nyaklanc', 'karkoto', 'gyuru', 'fulbevalo'],
  },
};

/** Lowercases and strips accents: "Pólo Ő" -> "polo o". */
export function plainText(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[őÕ]/gi, 'o')
    .replace(/[űŰ]/gi, 'u')
    .toLowerCase();
}

const words = (text) => plainText(text).split(/[^a-z0-9]+/).filter(Boolean);

function categoryOfWord(word) {
  for (const [category, { exact, stems }] of Object.entries(CATEGORY_WORDS)) {
    if (exact.includes(word)) return category;
    if (stems.some((stem) => stem.length >= 3 && word.includes(stem))) return category;
  }
  return null;
}

/**
 * Guesses an item's category from its name. In Hungarian (and English) the last word of a
 * name is usually the noun, so words are checked from the end. Returns null if unknown.
 */
export function categoryFromName(name) {
  for (const word of words(name ?? '').reverse()) {
    const category = categoryOfWord(word);
    if (category) return category;
  }
  return null;
}

/** True when the brand is the item's brand field or appears as a word in its name. */
export function matchesBrand(item, brand) {
  if (!brand) return false;
  const wanted = words(brand).join(' ');
  if (wanted === '') return false;
  if (item.brand && words(item.brand).join(' ') === wanted) return true;
  return ` ${words(item.name ?? '').join(' ')} `.includes(` ${wanted} `);
}
