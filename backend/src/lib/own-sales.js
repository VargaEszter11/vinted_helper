import { pool } from '../db.js';
import { categoryFromName, matchesBrand } from './item-category.js';
import { median } from './stats.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** With fewer brand+category matches than this, the wider category-only group is used instead. */
const MIN_BRAND_MATCHES = 3;

/**
 * The user's own sold items that are similar to the one being checked: same brand and
 * category when there are enough of them, otherwise the same category. Only the user's own
 * items are read. Days to sell = sold date minus the first time the item was listed, and is
 * left out for items that were never listed in the app.
 */
export async function findOwnSales(userId, { brand, category }) {
  const empty = { count: 0, match: null, median_sold_for: null, median_days_to_sell: null, days_samples: 0 };
  if (!category) return empty;

  const { rows } = await pool.query(
    `select i.name, i.brand, i.sold_for, i.sold_date,
            (select min(h.changed_at) from item_status_history h
             where h.item_id = i.id and h.status = 'listed') as listed_at
     from items i
     where i.user_id = $1 and i.status = 'sold' and i.sold_for is not null
     limit 5000`,
    [userId],
  );

  const sameCategory = rows.filter((row) => categoryFromName(row.name) === category);
  const sameBrand = sameCategory.filter((row) => matchesBrand(row, brand));
  const useBrand = sameBrand.length >= MIN_BRAND_MATCHES;
  const matches = useBrand ? sameBrand : sameCategory;
  if (matches.length === 0) return empty;

  const days = matches
    .filter((row) => row.listed_at && row.sold_date)
    // Whole calendar days between the day it was listed and the sold date.
    .map((row) => (new Date(`${row.sold_date}T00:00:00Z`) - new Date(`${row.listed_at.toISOString().slice(0, 10)}T00:00:00Z`)) / MS_PER_DAY)
    .map((value) => Math.max(0, value));

  return {
    count: matches.length,
    match: useBrand ? 'brand_category' : 'category',
    median_sold_for: Math.round(median(matches.map((row) => Number(row.sold_for)))),
    median_days_to_sell: days.length > 0 ? median(days) : null,
    days_samples: days.length,
  };
}
