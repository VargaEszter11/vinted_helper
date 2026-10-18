import { plainText } from './item-category.js';

/**
 * Lowercase, no accents, no apostrophes or "&", other punctuation (also dots, slashes and dashes
 * in links) as spaces: "Levi's" -> "levis", "www.zara.com" -> "www zara com".
 */
const normalise = (text) =>
  plainText(text)
    .replace(/['’`&]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** True when the brand appears as a word (or words) in the text. An empty brand matches anything. */
export function mentionsBrand(text, brand) {
  const needle = normalise(brand ?? '');
  if (needle === '') return true;
  return ` ${normalise(text)} `.includes(` ${needle} `);
}

/**
 * The search phrase with the brand in it, so a search is always for the item's own brand:
 * "black wool coat" + "Zara" -> "Zara black wool coat". Unchanged if it already names the brand.
 */
export function phraseWithBrand(phrase, brand) {
  if (!brand || mentionsBrand(phrase, brand)) return phrase;
  return `${brand} ${phrase}`.trim();
}
