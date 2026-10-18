import { pool } from '../db.js';
import { phraseWithBrand } from '../lib/brand.js';
import { MAX_IMAGE_BYTES, isJpeg } from '../lib/images.js';
import { CATEGORIES, CONDITIONS } from '../lib/item-recognition.js';
import { plainText } from '../lib/item-category.js';
import { findOwnSales } from '../lib/own-sales.js';
import { LookupUnavailableError, SEARCH_VERSION, searchPrices } from '../lib/price-search.js';
import { VERDICT_CONFIG, computeVerdict } from '../lib/verdict.js';
import { addVisualMatch } from '../lib/visual-match.js';
import { price } from './schemas.js';

const CHECKS_PER_HOUR = 20;
const CACHE_HOURS = 24;
/** Photos of the item used for the photo comparison of listings. */
const MAX_COMPARE_IMAGES = 2;

const optionalText = { type: ['string', 'null'], maxLength: 80 };

const pricesSchema = {
  body: {
    type: 'object',
    required: ['price'],
    additionalProperties: false,
    properties: {
      price,
      search_phrase: { type: ['string', 'null'], maxLength: 100 },
      brand: optionalText,
      item_type: optionalText,
      category: { type: ['string', 'null'], enum: [...CATEGORIES, '', null] },
      size: optionalText,
      colour: optionalText,
      condition: { type: ['string', 'null'], enum: [...CONDITIONS, '', null] },
      // Base64 JPEGs of the item, for the photo comparison. Optional: without them the lookup
      // compares text only.
      images: {
        type: 'array',
        maxItems: MAX_COMPARE_IMAGES,
        items: { type: 'string', minLength: 100, maxLength: Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4 },
      },
    },
  },
};

const clean = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Lowercase, no accents, only letters and digits: the same item gets the same cache key. */
const cacheKey = (phrase) => plainText(phrase).replace(/[^a-z0-9]+/g, ' ').trim();

// One price lookup at a time per user (this server runs as a single process).
const running = new Set();

/** Takes one of the user's hourly lookups. Returns its id, or null when they have used them all. */
async function takeSlot(userId) {
  const slot = await pool.query(
    `insert into price_checks (user_id)
     select $1 where (select count(*) from price_checks
                      where user_id = $1 and created_at > now() - interval '1 hour') < $2
     returning id`,
    [userId, CHECKS_PER_HOUR],
  );
  if (slot.rowCount === 0) return null;
  pool.query(`delete from price_checks where created_at < now() - interval '1 day'`).catch(() => {});
  return slot.rows[0].id;
}

const refundSlot = (id) => pool.query('delete from price_checks where id = $1', [id]).catch(() => {});

export default async function buyCheckPriceRoutes(app) {
  app.post('/buy-check/prices', { onRequest: [app.authenticate], schema: pricesSchema }, async (req, reply) => {
    const userId = req.user.sub;
    const body = req.body;
    const item = {
      brand: clean(body.brand),
      item_type: clean(body.item_type),
      category: clean(body.category),
      size: clean(body.size),
      colour: clean(body.colour),
      condition: clean(body.condition),
    };
    // The search is always for the item's own brand, so the phrase names it.
    item.search_phrase = phraseWithBrand(
      clean(body.search_phrase) ?? [item.brand, item.item_type].filter(Boolean).join(' '),
      item.brand,
    );
    const key = cacheKey(item.search_phrase);
    if (key.length < 2) {
      return reply.code(400).send({ message: 'Enter a search phrase (or a brand and item type) first.' });
    }
    const images = body.images ?? [];
    if (!images.every(isJpeg)) {
      return reply.code(400).send({ message: 'Photos must be JPEG files of at most 1.5 MB each.' });
    }

    if (running.has(userId)) {
      return reply.code(429).send({ message: 'A price check is already running. Wait for it to finish.' });
    }
    running.add(userId);
    try {
      const ownSales = await findOwnSales(userId, item);

      const cached = await pool.query(
        `select data, created_at from price_cache
         where key = $1 and (data->>'search_version')::int = $3
           and created_at > now() - make_interval(hours => $2)`,
        [key, CACHE_HOURS, SEARCH_VERSION],
      );

      let web;
      let cache = null;
      // The hourly lookup this request used, if it called a provider.
      let slotId = null;
      if (cached.rowCount > 0) {
        web = { ...cached.rows[0].data, available: true };
        cache = { hit: true, fetched_at: cached.rows[0].created_at };
      } else {
        // Only lookups that call the provider count against the limit; failed ones are refunded.
        slotId = await takeSlot(userId);
        if (slotId === null) {
          return reply
            .code(429)
            .send({ message: `You have used all ${CHECKS_PER_HOUR} price checks for this hour. Try again later.` });
        }

        try {
          const found = await searchPrices(item);
          web = { ...found.web, available: true };
          await pool.query(
            `insert into price_cache (key, data) values ($1, $2)
             on conflict (key) do update set data = excluded.data, created_at = now()`,
            [key, JSON.stringify(found.web)],
          );
          pool.query(`delete from price_cache where created_at < now() - interval '2 days'`).catch(() => {});
          cache = { hit: false, fetched_at: new Date().toISOString() };
          req.log.info({ usage: found.usage, searches: found.searches }, 'buy check prices');
        } catch (error) {
          await refundSlot(slotId);
          slotId = null;
          if (error.providerStatus) {
            req.log.error(
              { providerStatus: error.providerStatus, providerDetail: error.providerDetail },
              'price lookup provider error',
            );
          } else if (!(error instanceof LookupUnavailableError)) {
            req.log.error(error, 'price lookup failed');
          }
          // The lookup is reported as unavailable; your own sales still count. No retry here.
          web = {
            available: false,
            message:
              error instanceof LookupUnavailableError
                ? error.message
                : 'The price lookup is unavailable right now. Try again later.',
            new_price: null,
            used: { listings: [], dropped: [] },
            note: null,
            rates_note: null,
          };
        }
      }

      // Photo comparison: the listings are checked against the user's photos. This depends on
      // the photos, so it is never cached; the cached part above stays the same for everyone.
      let visual = { used: false, compared: 0, dropped: 0, note: null };
      if (images.length > 0 && web.available && web.used.listings.length > 0) {
        const borrowed = slotId === null; // a cache hit: this comparison is the only provider call
        if (borrowed) slotId = await takeSlot(userId);
        if (slotId === null) {
          visual.note = 'The photo comparison was skipped: you have used all your lookups for this hour.';
        } else {
          const result = await addVisualMatch(web, images);
          visual = { used: result.ran, compared: result.compared, dropped: result.dropped, note: result.note };
          if (borrowed && !result.ran) await refundSlot(slotId);
        }
      }

      const verdict = computeVerdict({
        price: body.price,
        ownSales,
        usedPrices: web.used.listings.map((listing) => listing.price),
        newPriceMedian: web.new_price?.median ?? null,
      });

      return {
        item,
        price: body.price,
        web,
        visual,
        cache,
        own_sales: ownSales,
        verdict,
        thresholds: VERDICT_CONFIG,
      };
    } finally {
      running.delete(userId);
    }
  });
}
