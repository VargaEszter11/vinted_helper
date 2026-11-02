/** Official Vinted country sites, with a local marketplace and default currency. */

export const COUNTRY_CODES = [
  'AU',
  'AT',
  'BE',
  'HR',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'GB',
  'US',
];

export const CURRENCY_CODES = ['HUF', 'EUR', 'USD', 'GBP', 'PLN', 'CZK', 'RON', 'CHF', 'AUD', 'DKK', 'SEK'];

/** Approximate forints per unit, used as a pivot when converting between currencies. */
export const RATES_TO_HUF = {
  HUF: 1,
  EUR: 400,
  USD: 370,
  GBP: 470,
  CHF: 420,
  PLN: 92,
  CZK: 16,
  RON: 80,
  AUD: 245,
  DKK: 54,
  SEK: 36,
};

/** Generic TLDs that must not count as "this country" (vinted.com would otherwise match every .com shop). */
const GENERIC_TLDS = new Set(['com', 'net', 'org']);

export const MARKETS = {
  AU: {
    vinted: 'vinted.com.au',
    extra: 'gumtree.com.au',
    currency: 'AUD',
    priceQuery: '{phrase} price AUD -site:pinterest.com',
    usedQuery: '{phrase} used for sale -site:pinterest.com',
    ori: 'Second hand clothes for sale Australia Vinted Gumtree',
  },
  AT: {
    vinted: 'vinted.at',
    extra: 'willhaben.at',
    currency: 'EUR',
    priceQuery: '{phrase} Preis -site:pinterest.com',
    usedQuery: '{phrase} gebraucht kaufen -site:pinterest.com',
    ori: 'Second hand clothes for sale Austria Vinted Willhaben',
  },
  BE: {
    vinted: 'vinted.be',
    extra: '2ememain.be',
    currency: 'EUR',
    priceQuery: '{phrase} prijs -site:pinterest.com',
    usedQuery: '{phrase} tweedehands te koop -site:pinterest.com',
    ori: 'Second hand clothes for sale Belgium Vinted',
  },
  HR: {
    vinted: 'vinted.hr',
    extra: 'njuskalo.hr',
    currency: 'EUR',
    priceQuery: '{phrase} cijena -site:pinterest.com',
    usedQuery: '{phrase} rabljeno prodaja -site:pinterest.com',
    ori: 'Second hand clothes for sale Croatia Vinted Njuskalo',
  },
  CZ: {
    vinted: 'vinted.cz',
    extra: 'sbazar.cz',
    currency: 'CZK',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} použité prodej -site:pinterest.com',
    ori: 'Second hand clothes for sale Czechia Vinted Sbazar',
  },
  DK: {
    vinted: 'vinted.dk',
    extra: 'dba.dk',
    currency: 'DKK',
    priceQuery: '{phrase} pris -site:pinterest.com',
    usedQuery: '{phrase} brugt til salg -site:pinterest.com',
    ori: 'Second hand clothes for sale Denmark Vinted DBA',
  },
  EE: {
    vinted: 'vinted.ee',
    extra: 'osta.ee',
    currency: 'EUR',
    priceQuery: '{phrase} hind -site:pinterest.com',
    usedQuery: '{phrase} kasutatud müük -site:pinterest.com',
    ori: 'Second hand clothes for sale Estonia Vinted',
  },
  FI: {
    vinted: 'vinted.fi',
    extra: 'tori.fi',
    currency: 'EUR',
    priceQuery: '{phrase} hinta -site:pinterest.com',
    usedQuery: '{phrase} käytetty myydään -site:pinterest.com',
    ori: 'Second hand clothes for sale Finland Vinted Tori',
  },
  FR: {
    vinted: 'vinted.fr',
    extra: 'leboncoin.fr',
    currency: 'EUR',
    priceQuery: '{phrase} prix -site:pinterest.com',
    usedQuery: '{phrase} occasion -site:pinterest.com',
    ori: 'Second hand clothes for sale France Vinted Leboncoin',
  },
  DE: {
    vinted: 'vinted.de',
    extra: 'kleinanzeigen.de',
    currency: 'EUR',
    priceQuery: '{phrase} Preis -site:pinterest.com',
    usedQuery: '{phrase} gebraucht kaufen -site:pinterest.com',
    ori: 'Second hand clothes for sale Germany Vinted Kleinanzeigen',
  },
  GR: {
    vinted: 'vinted.gr',
    extra: 'xe.gr',
    currency: 'EUR',
    priceQuery: '{phrase} τιμή -site:pinterest.com',
    usedQuery: '{phrase} μεταχειρισμένο -site:pinterest.com',
    ori: 'Second hand clothes for sale Greece Vinted',
  },
  HU: {
    vinted: 'vinted.hu',
    extra: 'jofogas.hu',
    currency: 'HUF',
    priceQuery: '{phrase} ár Ft -site:pinterest.com',
    usedQuery: '{phrase} használt eladó -site:pinterest.com',
    ori: 'Használt ruha eladó ár Magyarország Vinted Jófogás',
  },
  IE: {
    vinted: 'vinted.ie',
    extra: 'donedeal.ie',
    currency: 'EUR',
    priceQuery: '{phrase} price -site:pinterest.com',
    usedQuery: '{phrase} used for sale -site:pinterest.com',
    ori: 'Second hand clothes for sale Ireland Vinted DoneDeal',
  },
  IT: {
    vinted: 'vinted.it',
    extra: 'subito.it',
    currency: 'EUR',
    priceQuery: '{phrase} prezzo -site:pinterest.com',
    usedQuery: '{phrase} usato in vendita -site:pinterest.com',
    ori: 'Second hand clothes for sale Italy Vinted Subito',
  },
  LV: {
    vinted: 'vinted.lv',
    extra: 'ss.lv',
    currency: 'EUR',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} lietoti pārdod -site:pinterest.com',
    ori: 'Second hand clothes for sale Latvia Vinted SS.lv',
  },
  LT: {
    vinted: 'vinted.lt',
    extra: null,
    currency: 'EUR',
    priceQuery: '{phrase} kaina -site:pinterest.com',
    usedQuery: '{phrase} naudoti parduoda -site:pinterest.com',
    ori: 'Second hand clothes for sale Lithuania Vinted',
  },
  LU: {
    vinted: 'vinted.lu',
    extra: null,
    currency: 'EUR',
    priceQuery: '{phrase} prix -site:pinterest.com',
    usedQuery: '{phrase} occasion -site:pinterest.com',
    ori: 'Second hand clothes for sale Luxembourg Vinted',
  },
  NL: {
    vinted: 'vinted.nl',
    extra: 'marktplaats.nl',
    currency: 'EUR',
    priceQuery: '{phrase} prijs -site:pinterest.com',
    usedQuery: '{phrase} tweedehands te koop -site:pinterest.com',
    ori: 'Second hand clothes for sale Netherlands Vinted Marktplaats',
  },
  PL: {
    vinted: 'vinted.pl',
    extra: 'olx.pl',
    currency: 'PLN',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} używane na sprzedaż -site:pinterest.com',
    ori: 'Second hand clothes for sale Poland Vinted OLX',
  },
  PT: {
    vinted: 'vinted.pt',
    extra: 'olx.pt',
    currency: 'EUR',
    priceQuery: '{phrase} preço -site:pinterest.com',
    usedQuery: '{phrase} usado venda -site:pinterest.com',
    ori: 'Second hand clothes for sale Portugal Vinted OLX',
  },
  RO: {
    vinted: 'vinted.ro',
    extra: 'olx.ro',
    currency: 'RON',
    priceQuery: '{phrase} pret -site:pinterest.com',
    usedQuery: '{phrase} second hand -site:pinterest.com',
    ori: 'Second hand clothes for sale Romania Vinted OLX',
  },
  SK: {
    vinted: 'vinted.sk',
    extra: 'bazos.sk',
    currency: 'EUR',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} použité predaj -site:pinterest.com',
    ori: 'Second hand clothes for sale Slovakia Vinted Bazos',
  },
  SI: {
    vinted: 'vinted.si',
    extra: 'bolha.com',
    currency: 'EUR',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} rabljeno prodaja -site:pinterest.com',
    ori: 'Second hand clothes for sale Slovenia Vinted Bolha',
  },
  ES: {
    vinted: 'vinted.es',
    extra: 'wallapop.com',
    currency: 'EUR',
    priceQuery: '{phrase} precio -site:pinterest.com',
    usedQuery: '{phrase} segunda mano -site:pinterest.com',
    ori: 'Second hand clothes for sale Spain Vinted Wallapop',
  },
  SE: {
    vinted: 'vinted.se',
    extra: 'blocket.se',
    currency: 'SEK',
    priceQuery: '{phrase} pris -site:pinterest.com',
    usedQuery: '{phrase} begagnat -site:pinterest.com',
    ori: 'Second hand clothes for sale Sweden Vinted Blocket',
  },
  GB: {
    vinted: 'vinted.co.uk',
    extra: 'ebay.co.uk',
    currency: 'GBP',
    priceQuery: '{phrase} price -site:pinterest.com',
    usedQuery: '{phrase} used for sale -site:pinterest.com',
    ori: 'Second hand clothes for sale UK Vinted eBay',
  },
  US: {
    vinted: 'vinted.com',
    extra: 'ebay.com',
    currency: 'USD',
    priceQuery: '{phrase} price USD -site:pinterest.com',
    usedQuery: '{phrase} used for sale -site:pinterest.com',
    ori: 'Second hand clothes for sale United States Vinted eBay',
  },
};

export function resolveMarket(country, currency) {
  const market = MARKETS[country] ?? MARKETS.HU;
  const target = CURRENCY_CODES.includes(currency) ? currency : market.currency;
  return { ...market, country: MARKETS[country] ? country : 'HU', currency: target };
}

/** Country TLD used by this market's Vinted site (`hu`, `de`, `co.uk`). */
export function countryTld(market) {
  return market.vinted.replace(/^vinted\./, '');
}

/**
 * How strongly a host belongs to the user's country: local Vinted, then the
 * country's marketplace, then any other site on the same TLD. 0 = foreign.
 */
export function localHostPriority(host, market) {
  if (!host || !market) return 0;
  if (host === market.vinted || host.endsWith(`.${market.vinted}`)) return 3;
  if (market.extra && (host === market.extra || host.endsWith(`.${market.extra}`))) return 2;
  const tld = countryTld(market);
  if (!GENERIC_TLDS.has(tld) && (host === tld || host.endsWith(`.${tld}`))) return 1;
  return 0;
}

/** Local listings when there are enough of them; otherwise every listing (foreign as fallback). */
export function preferLocalListings(listings, market, minLocal = 2) {
  const local = listings.filter((listing) => localHostPriority(listing.site, market) > 0);
  return local.length >= minLocal ? local : listings;
}

export function convertAmount(price, from, to) {
  const fromRate = RATES_TO_HUF[from];
  const toRate = RATES_TO_HUF[to];
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (fromRate === undefined || toRate === undefined) return null;
  return Math.round((price * fromRate) / toRate);
}

export function ratesNote(target) {
  const others = Object.entries(RATES_TO_HUF).filter(([code]) => code !== target);
  const parts = others.map(([code, rate]) => {
    const inTarget = convertAmount(1, code, target);
    return inTarget != null ? `1 ${code} ≈ ${inTarget} ${target}` : null;
  });
  return `Converted at approximate rates: ${parts.filter(Boolean).join(', ')}.`;
}

export function searchesFor(market) {
  const searches = [
    { template: market.priceQuery, needContent: false },
    { template: market.usedQuery, needContent: false },
    { template: `{phrase} site:${market.vinted}`, needContent: true },
  ];
  if (market.extra) searches.push({ template: `{phrase} site:${market.extra}`, needContent: true });
  return searches;
}
