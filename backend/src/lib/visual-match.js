import { config } from '../config.js';
import { pool } from '../db.js';

// ---------------------------------------------------------------------------
// Settings. The search results only contain text, so the photo of each kept listing is found
// by reading its page through DeepSeek's Fetch API (DeepSeek's servers load the page, not this
// server). The chat model then looks at your photo next to the listing photos.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const FETCH_PATH = '/v1/tools/fetch';
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const FETCH_TIMEOUT_MS = 12_000;
const MODEL_TIMEOUT_MS = 45_000;
/** How many of the kept listings get a photo comparison (the rest keep their text-only result). */
const MAX_CANDIDATES = 6;
/** Fetch has a per-domain rate limit, so pages are read two at a time. */
const FETCH_CONCURRENCY = 2;
/** "low" scales images down: enough to compare colour, cut and style, and much cheaper. */
const IMAGE_DETAIL = 'low';
const MAX_OUTPUT_TOKENS = 700;
const CACHE_HOURS = 24;

const SYSTEM_PROMPT = `You compare photos for a second-hand clothing reseller. The first images are MY ITEM (the item the reseller is thinking of buying). Then come numbered candidate listing photos from the internet.

For each candidate decide whether it shows the same kind of item as MY ITEM, judging colour, cut, pattern, style and details:
- "same": it looks like the same item or the same model/design.
- "similar": a similar item, but you cannot tell if it is the same model.
- "different": clearly a different item (another colour, cut, pattern or type of garment).
- "unclear": the photo is not a usable photo of a clothing item (logo, banner, person, blurry) or you cannot tell.
Use "different" only when you are sure. When in doubt use "unclear".

Reply with ONLY one JSON object, no other text and no markdown:
{ "matches": [ { "id": number, "match": "same" | "similar" | "different" | "unclear", "reason": string } ] }
"reason" is a few words. Include every candidate id exactly once.`;

const MATCHES = ['same', 'similar', 'different', 'unclear'];

// ---------------------------------------------------------------------------

/** Runs `task` over the items, `limit` at a time. */
async function mapLimit(items, limit, task) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length > 0) await task(queue.shift());
    }),
  );
}

// --- Finding a listing's photo ------------------------------------------------

const NOT_AN_ITEM_PHOTO = /(logo|icon|sprite|avatar|favicon|flag|placeholder|badge|banner|apple-touch|\.svg|\.gif)/i;

/** Picks the most likely item photo out of a page's Markdown, or null. */
export function pickItemImage(markdown) {
  const urls = new Set();
  for (const match of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/g)) urls.add(match[1]);
  for (const match of markdown.matchAll(/https?:\/\/[^\s)"'<>\]]+\.(?:jpe?g|png|webp)(?:\?[^\s)"'<>\]]*)?/gi)) {
    urls.add(match[0]);
  }
  const usable = [...urls].filter((url) => url.length <= 1500 && !NOT_AN_ITEM_PHOTO.test(url));
  // Vinted keeps item photos under /t/ on its image servers.
  return usable.find((url) => /vinted\.net\/t\//i.test(url)) ?? usable[0] ?? null;
}

async function readPage(url) {
  try {
    const response = await fetch(`${BASE_URL}${FETCH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    return typeof body?.content === 'string' ? body.content : null;
  } catch {
    return null;
  }
}

/** The listing's photo URL (cached for 24 hours, also when the page has none), or null. */
async function listingImage(url) {
  const key = `image ${url}`;
  const cached = await pool.query(
    `select data from price_cache where key = $1 and created_at > now() - make_interval(hours => $2)`,
    [key, CACHE_HOURS],
  );
  if (cached.rowCount > 0) return cached.rows[0].data.image ?? null;

  const content = await readPage(url);
  // A page that could not be read is not remembered, so the next lookup tries again.
  if (content === null) return null;
  const image = pickItemImage(content);
  await pool
    .query(
      `insert into price_cache (key, data) values ($1, $2)
       on conflict (key) do update set data = excluded.data, created_at = now()`,
      [key, JSON.stringify({ image })],
    )
    .catch(() => {});
  return image;
}

// --- Comparing the photos -----------------------------------------------------

class ComparisonError extends Error {
  constructor(retryable) {
    super('comparison failed');
    this.retryable = retryable;
  }
}

/** One model call comparing the user's photos with these candidates. Returns Map(id -> result). */
async function compare(userImages, candidates) {
  const content = [{ type: 'text', text: 'MY ITEM:' }];
  for (const data of userImages) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}`, detail: IMAGE_DETAIL } });
  }
  for (const candidate of candidates) {
    content.push({ type: 'text', text: `Candidate ${candidate.id}:` });
    content.push({ type: 'image_url', image_url: { url: candidate.image_url, detail: IMAGE_DETAIL } });
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        thinking: { type: 'disabled' },
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
  } catch {
    throw new ComparisonError(false);
  }
  if (!response.ok) {
    // A 400 usually means one of the listing photos could not be loaded.
    throw new ComparisonError(response.status === 400);
  }

  const body = await response.json().catch(() => null);
  const text = body?.choices?.[0]?.message?.content;
  const start = typeof text === 'string' ? text.indexOf('{') : -1;
  const end = typeof text === 'string' ? text.lastIndexOf('}') : -1;
  let data = null;
  try {
    data = start !== -1 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
  } catch {
    data = null;
  }
  if (!Array.isArray(data?.matches)) throw new ComparisonError(false);

  const wanted = new Set(candidates.map((candidate) => candidate.id));
  const results = new Map();
  for (const entry of data.matches) {
    if (!wanted.has(entry?.id) || !MATCHES.includes(entry?.match)) continue;
    const reason = typeof entry.reason === 'string' ? entry.reason.trim().slice(0, 100) : '';
    results.set(entry.id, { match: entry.match, reason: reason || null });
  }
  return { results, usage: body?.usage ?? {} };
}

/** Compares in one call; if that fails because of a bad photo, retries one candidate at a time. */
async function compareAll(userImages, candidates) {
  try {
    return (await compare(userImages, candidates)).results;
  } catch (error) {
    if (!(error instanceof ComparisonError) || !error.retryable || candidates.length === 1) throw error;
  }
  const results = new Map();
  await mapLimit(candidates, 3, async (candidate) => {
    try {
      for (const [id, value] of (await compare(userImages, [candidate])).results) results.set(id, value);
    } catch {
      // This listing keeps its text-only result.
    }
  });
  return results;
}

/**
 * Adds a photo comparison to the kept second-hand listings of a price lookup (changes `web`).
 * Each compared listing gets `image_url` and `visual`; listings that clearly show a different
 * item move to `dropped`. Never throws: when anything fails, the text-only result stays as it is.
 * Returns whether a comparison really ran, and a note for the user.
 */
export async function addVisualMatch(web, userImages) {
  // Vinted listings come first, since that is where the item would be resold.
  const byVintedFirst = [...web.used.listings].sort(
    (a, b) => Number(b.site.includes('vinted.')) - Number(a.site.includes('vinted.')),
  );
  const candidates = byVintedFirst.slice(0, MAX_CANDIDATES);
  try {
    await mapLimit(candidates, FETCH_CONCURRENCY, async (listing) => {
      listing.image_url = await listingImage(listing.url);
    });
    const withImage = candidates
      .filter((listing) => listing.image_url)
      .map((listing, index) => Object.assign(listing, { id: index + 1 }));
    if (withImage.length === 0) {
      return { ran: false, compared: 0, dropped: 0, note: 'No listing photos could be read, so only the text was compared.' };
    }

    const results = await compareAll(userImages, withImage);
    let dropped = 0;
    for (const listing of withImage) {
      const result = results.get(listing.id);
      delete listing.id;
      if (!result) continue;
      if (result.match === 'different') {
        web.used.listings = web.used.listings.filter((kept) => kept !== listing);
        web.used.dropped.push({
          ...listing,
          reason: `Looks different from your item in the photos${result.reason ? `: ${result.reason}` : ''}.`,
        });
        dropped += 1;
      } else {
        listing.visual = result;
      }
    }
    return { ran: results.size > 0, compared: results.size, dropped, note: null };
  } catch {
    for (const listing of candidates) delete listing.id;
    return { ran: false, compared: 0, dropped: 0, note: 'The photo comparison is unavailable right now, so only the text was compared.' };
  }
}
