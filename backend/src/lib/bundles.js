import { pool } from '../db.js';

/**
 * Removes the user's bundles that have fewer than 2 items left; a remaining item just stays
 * listed on its own. Sold bundles always keep at least 2 items, so they are never touched.
 */
export async function dissolveSmallBundles(userId, client = pool) {
  await client.query(
    `delete from bundles b
     where b.user_id = $1 and (select count(*) from items i where i.bundle_id = b.id) < 2`,
    [userId],
  );
}

/**
 * Splits a price evenly into `count` shares that add up exactly to it. Whole forints when
 * the price is whole (10 000 / 3 -> 3 334, 3 333, 3 333), otherwise to the fillér.
 */
export function splitEvenly(total, count) {
  const cents = Math.round(total * 100);
  const unit = cents % 100 === 0 ? 100 : 1;
  const units = cents / unit;
  const base = Math.floor(units / count);
  const remainder = units % count;
  return Array.from({ length: count }, (_, i) => ((base + (i < remainder ? 1 : 0)) * unit) / 100);
}
