import { config } from '../config.js';
import { median } from './stats.js';

// ---------------------------------------------------------------------------
// Settings. To switch provider or model, change this block and callSearch()/callModel().
//
// How it works: two plain web searches go through DeepSeek's Search API (no site restriction,
// so results can come from any shop or marketplace), then the chat model reads ONLY those search
// results and picks out prices. The model refers to results by number, never by URL, and every
// price it reports must appear in that result's own text, so it cannot invent links or prices.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const SEARCH_PATH = '/v1/tools/search';
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const SEARCH_TIMEOUT_MS = 15_000;
const MODEL_TIMEOUT_MS = 45_000;
const RESULTS_PER_SEARCH = 10;
const MAX_OUTPUT_TOKENS = 1500;
/** Longest piece of a result's text given to the model, in characters. */
const MAX_RESULT_TEXT = 450;

/** Search queries. {phrase} is the item's search phrase. Hungarian: "ár" = price, "használt eladó" = used, for sale. */
const PRICE_QUERY = '{phrase} ár Ft';
const USED_QUERY = '{phrase} használt eladó';
/** Hosts that sell second-hand or private ads: never a source of new prices. */
const NOT_NEW_PRICE_HOSTS = ['vinted.', 'ebay.', 'facebook.', 'olx.', 'jofogas.', 'marketplace', 'aprohirdetes.', 'hardverapro.'];

/** Approximate forints per unit of foreign currency, used only to show other currencies in Ft. */
export const RATES_TO_HUF = { HUF: 1, EUR: 400, USD: 370, GBP: 470, CHF: 420, PLN: 92, CZK: 16, RON: 80 };
export const RATES_NOTE =
  'Converted at approximate rates: 1 EUR = 400 Ft, 1 USD = 370 Ft, 1 GBP = 470 Ft, 1 CHF = 420 Ft, 1 PLN = 92 Ft, 1 CZK = 16 Ft, 1 RON = 80 Ft.';

const SYSTEM_PROMPT = `You read web search results to find prices for one clothing item that a second-hand reseller might buy. You are given the item and a numbered list of search results (id, title, site, link, text). Use ONLY these results.

Reply with ONLY one JSON object, no other text and no markdown:
{
  "new_price_sources": [ { "id": number, "price": number, "currency": string } ],
  "used_listings": [ { "id": number, "price": number, "currency": string, "size": string or null, "condition": string or null, "same_item": boolean, "reason": string } ],
  "note": string or null
}

Rules:
- "id" is the number of a search result. Never write links.
- "price" is a number exactly as written in that result's text, in the currency shown there ("HUF" for Ft or forint, "EUR", "USD", ...). Never invent, estimate or adjust a price, and never take it from a result that does not state it.
- "new_price_sources": results from online shops that sell this item, or the closest equivalent, NEW, with its current price. One entry per shop. Skip second-hand sites and marketplaces, news, blogs and results without a clear price.
- "used_listings": results that are second-hand or private listings (Vinted, Jofogas, eBay, Facebook Marketplace, other resale sites, or a shop's used section) for this kind of item, with an asking price. Include every such listing that has a price. A result can be in only one of the two lists.
- Set "same_item" to true only for a genuine match: the same kind of item, a similar size range (one size away is fine), the adult version. Set it to false for the wrong kind of item, a clearly different size range, a kids' version, a bundle or lot of several items, "wanted" posts, accessories or parts, and give a short "reason" for every false. For true, "reason" is a few words on why it matches.
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

/** Fills a query template. Characters that act as search operators are removed from the phrase. */
const fill = (template, phrase) =>
  template.replace('{phrase}', phrase.replace(/["':()]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 128);

async function callSearch(query) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${SEARCH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({ query, count: RESULTS_PER_SEARCH }),
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

/** Numbered results from all searches, without duplicate links or entries without a usable link. */
function numberResults(...searches) {
  const list = [];
  const seen = new Set();
  for (const results of searches) {
    for (const result of results) {
      const host = typeof result?.url === 'string' ? hostOf(result.url) : null;
      if (!host || !/^https?:/i.test(result.url) || seen.has(result.url)) continue;
      seen.add(result.url);
      const text = [result.snippet, result.summary].filter((part) => typeof part === 'string' && part).join(' ');
      list.push({
        id: list.length + 1,
        title: String(result.title ?? '').slice(0, 200),
        url: result.url,
        host,
        text: text.slice(0, MAX_RESULT_TEXT),
      });
    }
  }
  return list;
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

/** Converts to forints. Returns null for a missing price or an unknown currency. */
function toHuf(price, currency) {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : 'HUF';
  const rate = RATES_TO_HUF[code];
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || rate === undefined) return null;
  return { huf: Math.round(price * rate), code, converted: code !== 'HUF' };
}

/**
 * Turns the model's reply into the final result, keeping only what the search results
 * back up. Anything rejected goes to `dropped` with the reason.
 */
function assemble(reply, results) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const textOf = (result) => `${result.title} ${result.text}`;
  let converted = false;

  const sources = [];
  const seenShops = new Set();
  const usedAsNew = new Set();
  for (const entry of reply.new_price_sources) {
    const result = byId.get(entry?.id);
    const price = toHuf(entry?.price, entry?.currency);
    if (!result || !price || !priceAppearsIn(textOf(result), entry.price)) continue;
    if (NOT_NEW_PRICE_HOSTS.some((host) => result.host.includes(host))) continue;
    if (seenShops.has(result.host)) continue;
    seenShops.add(result.host);
    usedAsNew.add(result.id);
    if (price.converted) converted = true;
    sources.push({
      title: result.title,
      url: result.url,
      price: price.huf,
      original: price.converted ? { amount: entry.price, currency: price.code } : null,
    });
  }

  const listings = [];
  const dropped = [];
  const seenListings = new Set();
  for (const entry of reply.used_listings) {
    const result = byId.get(entry?.id);
    if (!result || usedAsNew.has(result.id) || seenListings.has(result.id)) continue;
    seenListings.add(result.id);
    const price = toHuf(entry?.price, entry?.currency);
    const base = {
      title: result.title,
      url: result.url,
      site: result.host,
      size: cleanText(entry?.size, 30),
      condition: cleanText(entry?.condition),
    };
    if (!price || !priceAppearsIn(textOf(result), entry.price)) {
      dropped.push({ ...base, price: null, reason: 'The price could not be confirmed in the search result.' });
    } else if (entry.same_item !== true) {
      dropped.push({ ...base, price: price.huf, reason: cleanText(entry?.reason, 140) ?? 'Not the same kind of item.' });
    } else {
      if (price.converted) converted = true;
      listings.push({ ...base, price: price.huf, reason: cleanText(entry?.reason, 140) });
    }
  }

  const prices = sources.map((source) => source.price);
  return {
    new_price:
      sources.length > 0
        ? {
            min: Math.min(...prices),
            median: Math.round(median(prices)),
            max: Math.max(...prices),
            currency: 'HUF',
            sources,
          }
        : null,
    used: { listings, dropped },
    note: cleanText(reply.note, 200),
    rates_note: converted ? RATES_NOTE : null,
  };
}

/**
 * Looks up new prices and second-hand asking prices for an item with plain web searches.
 * Throws LookupUnavailableError when the searches fail. Never retries a search.
 */
export async function searchPrices(item) {
  if (!config.deepseekApiKey) {
    throw new LookupUnavailableError('Price lookup is not set up on this server.');
  }

  const searches = await Promise.allSettled([
    callSearch(fill(PRICE_QUERY, item.search_phrase)),
    callSearch(fill(USED_QUERY, item.search_phrase)),
  ]);
  const failures = searches.filter((search) => search.status === 'rejected');
  if (failures.length === searches.length) throw failures[0].reason;

  const results = numberResults(...searches.map((search) => (search.status === 'fulfilled' ? search.value : [])));
  const partialNote = failures.length > 0 ? 'One of the two searches failed, so the result is incomplete.' : null;

  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  if (results.length === 0) {
    return {
      web: {
        new_price: null,
        used: { listings: [], dropped: [] },
        note: partialNote ?? 'The search found nothing for this item.',
        rates_note: null,
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

  const web = assemble(parsed, results);
  if (partialNote) web.note = [web.note, partialNote].filter(Boolean).join(' ');
  return { web, usage, searches: searches.length - failures.length };
}
