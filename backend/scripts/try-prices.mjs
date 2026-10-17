// Tries the Buy check price lookup on a list of items, to judge how good the results are.
//
//   APP_USER=you APP_PASSWORD=secret node backend/scripts/try-prices.mjs items.txt
//
// items.txt has one item per line: search phrase | price you would pay (Ft) | category | brand
// (category and brand are optional; categories: tops, bottoms, dresses, outerwear, shoes, bags,
// accessories, other). Lines starting with # are ignored. Example:
//
//   levis 501 blue jeans | 4000 | bottoms | Levi's
//   zara black wool coat | 6000 | outerwear | Zara
//
// Each lookup takes a few seconds and costs well under 1 Ft. Results are cached for 24 hours,
// so running the same list again is free.

import { readFileSync } from 'node:fs';

const { APP_USER, APP_PASSWORD, API_URL = 'http://localhost:8080/api' } = process.env;
const file = process.argv[2];
if (!APP_USER || !APP_PASSWORD || !file) {
  console.error('Usage: APP_USER=... APP_PASSWORD=... node backend/scripts/try-prices.mjs items.txt');
  process.exit(1);
}

const huf = (value) => (value == null ? '-' : `${Math.round(value).toLocaleString('hu-HU')} Ft`);

async function request(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json;
}

const { token } = await request('/auth/login', { username: APP_USER, password: APP_PASSWORD });

const lines = readFileSync(file, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const summary = [];
for (const line of lines) {
  const [phrase, priceText, category = '', brand = ''] = line.split('|').map((part) => part.trim());
  console.log(`\n=== ${phrase} (you pay ${priceText} Ft)`);
  try {
    const r = await request(
      '/buy-check/prices',
      { price: Number(priceText), search_phrase: phrase, category, brand },
      token,
    );
    const w = r.web;
    console.log(w.available ? (r.cache?.hit ? '(saved result)' : '(fresh search)') : `LOOKUP UNAVAILABLE: ${w.message}`);
    if (w.new_price) {
      console.log(`New price: ${huf(w.new_price.min)} - ${huf(w.new_price.max)} from ${w.new_price.sources.length} shop(s)`);
      for (const s of w.new_price.sources) console.log(`   ${huf(s.price)}  ${s.url}`);
    } else {
      console.log('New price: none found');
    }
    console.log(`Second-hand: ${w.used.listings.length} kept, ${w.used.dropped.length} not used`);
    for (const l of w.used.listings) console.log(`   ${huf(l.price)}  ${[l.site, l.size, l.condition].filter(Boolean).join(' ')}  ${l.url}`);
    for (const l of w.used.dropped) console.log(`   (not used) ${huf(l.price)}  ${l.reason}  ${l.url}`);
    if (r.own_sales.count > 0) {
      console.log(`Own sales: ${r.own_sales.count} similar, median ${huf(r.own_sales.median_sold_for)} (${r.own_sales.match})`);
    }
    const v = r.verdict;
    console.log(`VERDICT: ${v.verdict}${v.leaning ? ` (leaning ${v.leaning})` : ''}  - ${v.explanation}`);
    summary.push([phrase, priceText, v.verdict, w.used.listings.length, w.new_price ? 'yes' : 'no']);
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
    summary.push([phrase, priceText, 'ERROR', '-', '-']);
  }
}

console.log('\n--- Summary (item | you pay | verdict | second-hand listings kept | new price found)');
for (const row of summary) console.log(row.join(' | '));
