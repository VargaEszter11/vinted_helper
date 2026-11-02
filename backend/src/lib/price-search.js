import { config } from '../config.js';
import { mentionsBrand } from './brand.js';
import { convertAmount, ratesNote, searchesFor } from './markets.js';
import { median } from './stats.js';

// ---------------------------------------------------------------------------
// Settings. To switch provider or model, change this block and callSearch()/callModel().
//
// How it works: several web searches go through DeepSeek's Search API (open web plus the
// country's Vinted and a local marketplace), then the chat model reads ONLY those search
// results and picks out prices. The model refers to results by number, never by URL, and
// every price it reports must appear in that result's own text, so it cannot invent links
// or prices.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const SEARCH_PATH = '/v1/tools/search';
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const SEARCH_TIMEOUT_MS = 20_000;
const MODEL_TIMEOUT_MS = 45_000;
const RESULTS_PER_SEARCH = 20;
const MAX_RESULTS_FOR_MODEL = 28;
const MAX_OUTPUT_TOKENS = 2500;
/** Longest piece of a marketplace listing's text given to the model, in characters. */
const MAX_MARKETPLACE_TEXT = 1400;
const MAX_OTHER_TEXT = 700;

/** Search queries. {phrase} is the item's search phrase. Hungarian: "ár" = price, "használt eladó" = used, for sale. */
/** Bump when the searches change, so results cached by an older version are not reused. */
export const SEARCH_VERSION = 4;

/** Hosts that sell second-hand or private ads: never a source of new prices. */
const NOT_NEW_PRICE_HOSTS = ['vinted.', 'ebay.', 'facebook.', 'olx.', 'jofogas.', 'marketplace', 'aprohirdetes.', 'hardverapro.'];
const MARKETPLACE_HOSTS = ['vinted.', 'jofogas.', 'olx.', 'ebay.', 'facebook.', 'marketplace'];

const SYSTEM_PROMPT = `You read web search results to find prices for one clothing item that a second-hand reseller might buy. You are given the item and a numbered list of search results (id, title, site, link, text). Use ONLY these results.

Reply with ONLY one JSON object, no other text and no markdown:
{
  "new_price_sources": [ { "id": number, "price": number, "currency": string } ],
  "used_listings": [ { "id": number, "price": number, "currency": string, "size": string or null, "condition": string or null, "same_item": boolean, "reason": string } ],
  "note": string or null
}

Rules:
- If the item has a brand, use ONLY results about that exact brand. Skip results about any other brand, even for a very similar item. For a second-hand listing of another brand, set "same_item" to false and "reason" to "different brand".
- Prefer listings on the local Vinted and the country's marketplace: include every one of that brand and kind of item that has a price.
- "id" is the number of a search result. Never write links.
- "price" is a number exactly as written in that result's text, in the currency shown there ("HUF" for Ft or forint, "EUR", "USD", "GBP", "PLN", ...). Prices look like "5.990 Ft", "12,99 €", "£15" — copy the number. Never invent, estimate or adjust a price, and never take it from a result that does not state it.
- "new_price_sources": results from online shops that sell this item, or the closest equivalent, NEW, with its current price. One entry per shop. Skip second-hand sites and marketplaces, news, blogs and results without a clear price.
- "used_listings": results that are second-hand or private listings (Vinted, Jofogas, eBay, Facebook Marketplace, other resale sites, or a shop's used section) for this kind of item, with an asking price. Include every such listing that has a price, not just a few. A result can be in only one of the two lists.
- Set "same_item" to true for a useful price comparison: the same kind of garment from the same brand (the exact model is a plus, not required), a similar size range (one size away is fine), the adult version. Set it to false for the wrong kind of item, a clearly different size range, a kids' version, a bundle or lot of several items, "wanted" posts, accessories or parts, and give a short "reason" for every false. For true, "reason" is a few words on why it matches.
- Use null for "size" or "condition" when the text does not say.
- Use empty lists when nothing fits. "note" is one short sentence about anything the reseller should know (for example that few results were found), or null.`;

const RETRY_PROMPT = 'That was not a valid JSON object in the required format. Reply again with ONLY the JSON object.';

// ---------------------------------------------------------------------------

/** The lookup could not be completed. The message is safe to show to the user. */
export class LookupUnavailableError extends Error {
  constructor(message = 'The price lookup is unavailable right now. Try again later.') {
    super(message);
  }
}

/**
 * Characters that act as search operators (quotes, colons, brackets, a leading minus) are
 * removed from text put into a query. Apostrophes stay: they are part of names like Levi's.
 */
const plain = (text) =>
  text
    .replace(/["():]/g, ' ')
    .replace(/(^|\s)-+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The phrase for a query. With a brand, the brand goes first in quotes (an exact-phrase search),
 * so the search engine keeps to that brand: `"Zara" black wool coat`. A brand with punctuation
 * (Levi's, H&M) stays unquoted, because an exact phrase would not match every spelling.
 */
function hungarianNoun(item) {
  const hay = `${item.item_type ?? ''} ${item.search_phrase ?? ''} ${item.category ?? ''}`.toLowerCase();
  const pairs = [
    [/jeans|farmer/, 'farmer'],
    [/sweater|jumper|hoodie|sweatshirt|pulover|pulcsi/, 'pulóver'],
    [/t-?shirt|póló|polo/, 'póló'],
    [/dress|ruha/, 'ruha'],
    [/skirt|szoknya/, 'szoknya'],
    [/coat|kabát|kabat/, 'kabát'],
    [/jacket|dzseki|blazer/, 'dzseki'],
    [/sneaker|trainers|tornacip/, 'tornacipő'],
    [/boot|csizma/, 'csizma'],
    [/bag|táska|taska/, 'táska'],
    [/jeans|pants|trousers|nadrág|nadrag/, 'nadrág'],
  ];
  for (const [pattern, noun] of pairs) {
    if (pattern.test(hay)) return noun;
  }
  return null;
}

function queryPhrase(item) {
  let phrase = plain(item.search_phrase);
  const brand = item.brand ? plain(item.brand) : '';
  if (brand && /^[\p{L}\p{N} ]+$/u.test(item.brand)) {
    // The brand holds only letters, digits and spaces here, so it is safe inside a RegExp.
    const rest = phrase.replace(new RegExp(brand, 'ig'), ' ').replace(/\s+/g, ' ').trim();
    phrase = `"${brand}" ${rest}`.trim();
  }
  const colour = item.colour ? plain(item.colour) : '';
  if (colour && !phrase.toLowerCase().includes(colour.toLowerCase())) {
    phrase = `${phrase} ${colour}`.trim();
  }
  const noun = hungarianNoun(item);
  if (noun && !phrase.toLowerCase().includes(noun.toLowerCase())) {
    phrase = `${phrase} ${noun}`.trim();
  }
  return phrase;
}

/** Fills a query template, keeping operators (site:, -site:) inside the 128-character limit. */
function fill(template, item) {
  const extra = template.replace('{phrase}', '').trim();
  const budget = Math.max(16, 128 - (extra ? extra.length + 1 : 0));
  const phrase = queryPhrase(item).slice(0, budget).trim();
  return (extra ? `${phrase} ${extra}` : phrase).slice(0, 128);
}

async function callSearch(query, { needContent = false, oriQuestion } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${SEARCH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({
        query,
        count: RESULTS_PER_SEARCH,
        ori_question: oriQuestion,
        need_content: needContent,
      }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch {
    throw new LookupUnavailableError();
  }
  if (!response.ok) {
    const error = new LookupUnavailableError(
      response.status === 429
        ? 'The price lookup is busy right now. Try again in a moment.'
        : 'The price lookup is unavailable right now. Try again later.',
    );
    error.providerStatus = response.status;
    error.providerDetail = (await response.text().catch(() => '')).slice(0, 300);
    throw error;
  }
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.results) ? body.results : [];
}

async function callModel(messages) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        thinking: { type: 'disabled' },
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
  } catch {
    throw new LookupUnavailableError();
  }
  if (!response.ok) {
    const error = new LookupUnavailableError();
    error.providerStatus = response.status;
    error.providerDetail = (await response.text().catch(() => '')).slice(0, 300);
    throw error;
  }
  const body = await response.json().catch(() => null);
  const content = body?.choices?.[0]?.message?.content;
  return {
    content: typeof content === 'string' ? content : '',
    usage: {
      prompt_tokens: body?.usage?.prompt_tokens ?? 0,
      completion_tokens: body?.usage?.completion_tokens ?? 0,
    },
  };
}

// --- Search results ---------------------------------------------------------

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isMarketplace(host) {
  return MARKETPLACE_HOSTS.some((part) => host.includes(part));
}

function resultText(result) {
  const parts = [result.snippet, result.summary, result.content].filter(
    (part) => typeof part === 'string' && part.trim() !== '',
  );
  const host = typeof result?.url === 'string' ? hostOf(result.url) : '';
  const limit = isMarketplace(host) ? MAX_MARKETPLACE_TEXT : MAX_OTHER_TEXT;
  return parts.join('\n').slice(0, limit);
}

/** Numbered results from all searches, without duplicate links or entries without a usable link. */
function numberResults(...searches) {
  const list = [];
  const seen = new Set();
  for (const results of searches) {
    for (const result of results) {
      const host = typeof result?.url === 'string' ? hostOf(result.url) : null;
      if (!host || !/^https?:/i.test(result.url) || seen.has(result.url)) continue;
      seen.add(result.url);
      list.push({
        id: 0,
        title: String(result.title ?? '').slice(0, 200),
        url: result.url,
        host,
        text: resultText(result),
        rerank: typeof result.rerank_score === 'number' ? result.rerank_score : 0,
      });
    }
  }
  list.sort((a, b) => Number(isMarketplace(b.host)) - Number(isMarketplace(a.host)) || b.rerank - a.rerank);
  return list.slice(0, MAX_RESULTS_FOR_MODEL).map((result, index) => ({
    id: index + 1,
    title: result.title,
    url: result.url,
    host: result.host,
    text: result.text,
  }));
}

function itemDescription(item) {
  const parts = [
    ['Search phrase', item.search_phrase],
    ['Brand', item.brand],
    ['Item type', item.item_type],
    ['Category', item.category],
    ['Size', item.size],
    ['Colour', item.colour],
    ['Condition', item.condition],
  ];
  return parts.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
}

function userMessage(item, results) {
  const shown = results.map(({ id, title, host, url, text }) => ({ id, title, site: host, link: url, text }));
  return `Item:\n${itemDescription(item)}\n\nSearch results:\n${JSON.stringify(shown)}`;
}

// --- Checking what the model said -------------------------------------------

/** Removes thousands separators so "5 990", "5.990" and "5,990" all read 5990. */
const joinThousands = (text) => text.replace(/(\d)[\s .,](?=\d{3}(?!\d))/g, '$1');

/** True when the amount is written in the text, so the model cannot have made it up. */
function priceAppearsIn(text, amount) {
  const haystack = joinThousands(text);
  // A whole amount must appear as that whole number; a decimal one as written (12.5 / 12,50).
  const candidates = new Set([String(amount)]);
  if (!Number.isInteger(amount)) candidates.add(amount.toFixed(2));
  return [...candidates].some((candidate) =>
    new RegExp(`(?<![\\d.,])${candidate.replace(/[.,]/g, '[.,]')}(?!\\d)`).test(haystack),
  );
}

const MIN_LISTING_HUF = 500;
const MAX_LISTING_HUF = 500_000;

function parseListedNumber(raw) {
  const text = String(raw).trim();
  if (text.includes(',') && text.includes('.')) {
    return Number(text.replace(/\./g, '').replace(',', '.'));
  }
  if (text.includes(',')) {
    const parts = text.split(',');
    if (parts[1]?.length === 3 && !parts[0].includes('.')) return Number(text.replace(/[.\s ,]/g, ''));
    return Number(text.replace(/\s/g, '').replace(',', '.'));
  }
  return Number(text.replace(/[\s ]/g, '').replace(/\.(?=\d{3}\b)/g, ''));
}

/** Amounts written next to a currency in the snippet. */
function extractListedAmounts(text) {
  const found = [];
  const patterns = [
    { currency: 'HUF', re: /(\d{1,3}(?:[.\s ]\d{3})+|\d{3,7})\s*(?:Ft|ft|HUF|forint)/gi },
    { currency: 'EUR', re: /(?:€|EUR)\s*(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi },
    { currency: 'EUR', re: /(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)/gi },
    { currency: 'GBP', re: /(?:£|GBP)\s*(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi },
    { currency: 'GBP', re: /(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:£|GBP)/gi },
    { currency: 'PLN', re: /(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:zł|zl|PLN)/gi },
    { currency: 'CZK', re: /(\d{1,3}(?:[.\s ]\d{3})+|\d{3,7})\s*(?:Kč|Kc|CZK)/gi },
    { currency: 'RON', re: /(\d{1,3}(?:[.\s ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:lei|RON)/gi },
    { currency: 'USD', re: /(?:\$|USD)\s*(\d{1,3}(?:[,\s ]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi },
  ];
  for (const { currency, re } of patterns) {
    for (const match of text.matchAll(re)) {
      const value = parseListedNumber(match[1]);
      const huf = convertAmount(value, currency, 'HUF');
      if (huf != null && huf >= MIN_LISTING_HUF && huf <= MAX_LISTING_HUF) {
        found.push({ amount: value, currency });
      }
    }
  }
  return found;
}

/** The model's price if the snippet confirms it, otherwise a single listed amount from the text. */
function confirmedAmount(text, reported) {
  if (typeof reported === 'number' && Number.isFinite(reported) && reported > 0 && priceAppearsIn(text, reported)) {
    return { amount: reported, fromSnippet: false };
  }
  const amounts = extractListedAmounts(text);
  if (typeof reported === 'number' && Number.isFinite(reported)) {
    const rounded = Math.round(reported);
    const match = amounts.find(
      (entry) =>
        Math.round(entry.amount) === rounded ||
        Math.round(entry.amount) === Math.round(reported * 1000) ||
        Math.abs(entry.amount - rounded) <= 1,
    );
    if (match) return { amount: match.amount, currency: match.currency, fromSnippet: true };
  }
  return amounts.length === 1
    ? { amount: amounts[0].amount, currency: amounts[0].currency, fromSnippet: true }
    : null;
}

function parseReply(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const data = JSON.parse(content.slice(start, end + 1));
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
    if (!Array.isArray(data.new_price_sources) || !Array.isArray(data.used_listings)) return null;
    return data;
  } catch {
    return null;
  }
}

const cleanText = (value, max = 60) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;

/** Converts a found price into the user's currency. */
function toTarget(price, currency, target) {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : target;
  const amount = convertAmount(price, code, target);
  if (amount == null) return null;
  return { amount, code, converted: code !== target };
}

/**
 * Turns the model's reply into the final result, keeping only what the search results
 * back up. Anything rejected goes to `dropped` with the reason.
 */
function assemble(reply, results, item, market) {
  const byId = new Map(results.map((result) => [result.id, result]));
  // The link is included too: shop domains and listing addresses often carry the brand name.
  const textOf = (result) => `${result.title} ${result.text} ${result.url}`;
  // Marketplace hits already came from a branded query (`"Zara" … site:vinted.hu`), so the
  // snippet often omits the brand even when the listing is for that brand.
  const wrongBrand = (result) =>
    Boolean(item.brand) && !mentionsBrand(textOf(result), item.brand) && !isMarketplace(result.host);
  let converted = false;

  const sources = [];
  const seenShops = new Set();
  const usedAsNew = new Set();
  for (const entry of reply.new_price_sources) {
    const result = byId.get(entry?.id);
    const confirmed = result ? confirmedAmount(textOf(result), entry?.price) : null;
    const from = confirmed?.fromSnippet ? (confirmed.currency ?? market.currency) : entry?.currency;
    const price = confirmed ? toTarget(confirmed.amount, from, market.currency) : null;
    if (!result || !price) continue;
    // Only the item's own brand: a result that does not name it is not used.
    if (wrongBrand(result)) continue;
    if (NOT_NEW_PRICE_HOSTS.some((host) => result.host.includes(host))) continue;
    if (seenShops.has(result.host)) continue;
    seenShops.add(result.host);
    usedAsNew.add(result.id);
    if (price.converted) converted = true;
    sources.push({
      title: result.title,
      url: result.url,
      price: price.amount,
      original: price.converted ? { amount: confirmed.amount, currency: price.code } : null,
    });
  }

  const listings = [];
  const dropped = [];
  const seenListings = new Set();
  for (const entry of reply.used_listings) {
    const result = byId.get(entry?.id);
    if (!result || usedAsNew.has(result.id) || seenListings.has(result.id)) continue;
    seenListings.add(result.id);
    const confirmed = confirmedAmount(textOf(result), entry?.price);
    const from = confirmed?.fromSnippet ? (confirmed.currency ?? market.currency) : entry?.currency;
    const price = confirmed ? toTarget(confirmed.amount, from, market.currency) : null;
    const base = {
      title: result.title,
      url: result.url,
      site: result.host,
      size: cleanText(entry?.size, 30),
      condition: cleanText(entry?.condition),
    };
    if (wrongBrand(result)) {
      dropped.push({ ...base, price: price?.amount ?? null, reason: `The listing does not mention the brand ${item.brand}.` });
    } else if (!price) {
      dropped.push({ ...base, price: null, reason: 'The price could not be confirmed in the search result.' });
    } else if (entry.same_item !== true) {
      dropped.push({ ...base, price: price.amount, reason: cleanText(entry?.reason, 140) ?? 'Not the same kind of item.' });
    } else {
      if (price.converted) converted = true;
      listings.push({ ...base, price: price.amount, reason: cleanText(entry?.reason, 140) });
    }
  }

  // Marketplace pages the model skipped, when the snippet has exactly one price and names the brand.
  const claimed = new Set([
    ...reply.new_price_sources.map((entry) => entry?.id),
    ...reply.used_listings.map((entry) => entry?.id),
  ]);
  for (const result of results) {
    if (claimed.has(result.id) || usedAsNew.has(result.id) || seenListings.has(result.id)) continue;
    if (!isMarketplace(result.host)) continue;
    if (item.brand && !mentionsBrand(textOf(result), item.brand)) continue;
    const confirmed = confirmedAmount(textOf(result), null);
    const price = confirmed
      ? toTarget(confirmed.amount, confirmed.currency ?? market.currency, market.currency)
      : null;
    if (!price) continue;
    seenListings.add(result.id);
    listings.push({
      title: result.title,
      url: result.url,
      site: result.host,
      size: null,
      condition: null,
      price: price.amount,
      reason: 'Taken from the listing snippet.',
    });
  }

  const prices = sources.map((source) => source.price);
  return {
    new_price:
      sources.length > 0
        ? {
            min: Math.min(...prices),
            median: Math.round(median(prices)),
            max: Math.max(...prices),
            currency: market.currency,
            sources,
          }
        : null,
    used: { listings, dropped },
    note: cleanText(reply.note, 200),
    rates_note: converted ? ratesNote(market.currency) : null,
    search_version: SEARCH_VERSION,
  };
}

/**
 * Looks up new prices and second-hand asking prices for an item with plain web searches.
 * Throws LookupUnavailableError when the searches fail. Never retries a search.
 */
export async function searchPrices(item, market) {
  if (!config.deepseekApiKey) {
    throw new LookupUnavailableError('Price lookup is not set up on this server.');
  }

  const planned = searchesFor(market);
  const searches = await Promise.allSettled(
    planned.map((search) =>
      callSearch(fill(search.template, item), { needContent: search.needContent, oriQuestion: market.ori }),
    ),
  );
  const failures = searches.filter((search) => search.status === 'rejected');
  if (failures.length === searches.length) throw failures[0].reason;

  const results = numberResults(...searches.map((search) => (search.status === 'fulfilled' ? search.value : [])));
  const partialNote =
    failures.length > 0 ? 'One of the searches failed, so the result may be incomplete.' : null;

  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  if (results.length === 0) {
    return {
      web: {
        new_price: null,
        used: { listings: [], dropped: [] },
        note: partialNote ?? 'The search found nothing for this item.',
        rates_note: null,
        search_version: SEARCH_VERSION,
      },
      usage,
      searches: searches.length - failures.length,
    };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage(item, results) },
  ];
  let reply = await callModel(messages);
  usage.prompt_tokens += reply.usage.prompt_tokens;
  usage.completion_tokens += reply.usage.completion_tokens;
  let parsed = parseReply(reply.content);
  if (!parsed) {
    reply = await callModel([
      ...messages,
      { role: 'assistant', content: reply.content.slice(0, 2000) },
      { role: 'user', content: RETRY_PROMPT },
    ]);
    usage.prompt_tokens += reply.usage.prompt_tokens;
    usage.completion_tokens += reply.usage.completion_tokens;
    parsed = parseReply(reply.content);
  }
  if (!parsed) throw new LookupUnavailableError('Could not read the price lookup result. Try again.');

  const web = assemble(parsed, results, item, market);
  if (partialNote) web.note = [web.note, partialNote].filter(Boolean).join(' ');
  return { web, usage, searches: searches.length - failures.length };
}
