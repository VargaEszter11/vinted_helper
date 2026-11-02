/** Vinted countries the app can search, with a local marketplace and default currency. */

export const COUNTRY_CODES = [
  'HU',
  'AT',
  'BE',
  'CZ',
  'DE',
  'ES',
  'FR',
  'GB',
  'IT',
  'LT',
  'LU',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
];

export const CURRENCY_CODES = ['HUF', 'EUR', 'USD', 'GBP', 'PLN', 'CZK', 'RON', 'CHF'];

/** Approximate forints per unit, used as a pivot when converting between currencies. */
export const RATES_TO_HUF = { HUF: 1, EUR: 400, USD: 370, GBP: 470, CHF: 420, PLN: 92, CZK: 16, RON: 80 };

export const MARKETS = {
  HU: {
    vinted: 'vinted.hu',
    extra: 'jofogas.hu',
    currency: 'HUF',
    priceQuery: '{phrase} ár Ft -site:pinterest.com',
    usedQuery: '{phrase} használt eladó -site:pinterest.com',
    ori: 'Használt ruha eladó ár Magyarország Vinted Jófogás',
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
  CZ: {
    vinted: 'vinted.cz',
    extra: 'sbazar.cz',
    currency: 'CZK',
    priceQuery: '{phrase} cena -site:pinterest.com',
    usedQuery: '{phrase} použité prodej -site:pinterest.com',
    ori: 'Second hand clothes for sale Czechia Vinted Sbazar',
  },
  DE: {
    vinted: 'vinted.de',
    extra: 'kleinanzeigen.de',
    currency: 'EUR',
    priceQuery: '{phrase} Preis -site:pinterest.com',
    usedQuery: '{phrase} gebraucht kaufen -site:pinterest.com',
    ori: 'Second hand clothes for sale Germany Vinted Kleinanzeigen',
  },
  ES: {
    vinted: 'vinted.es',
    extra: 'wallapop.com',
    currency: 'EUR',
    priceQuery: '{phrase} precio -site:pinterest.com',
    usedQuery: '{phrase} segunda mano -site:pinterest.com',
    ori: 'Second hand clothes for sale Spain Vinted Wallapop',
  },
  FR: {
    vinted: 'vinted.fr',
    extra: 'leboncoin.fr',
    currency: 'EUR',
    priceQuery: '{phrase} prix -site:pinterest.com',
    usedQuery: '{phrase} occasion -site:pinterest.com',
    ori: 'Second hand clothes for sale France Vinted Leboncoin',
  },
  GB: {
    vinted: 'vinted.co.uk',
    extra: 'ebay.co.uk',
    currency: 'GBP',
    priceQuery: '{phrase} price -site:pinterest.com',
    usedQuery: '{phrase} used for sale -site:pinterest.com',
    ori: 'Second hand clothes for sale UK Vinted eBay',
  },
  IT: {
    vinted: 'vinted.it',
    extra: 'subito.it',
    currency: 'EUR',
    priceQuery: '{phrase} prezzo -site:pinterest.com',
    usedQuery: '{phrase} usato in vendita -site:pinterest.com',
    ori: 'Second hand clothes for sale Italy Vinted Subito',
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
};

export function resolveMarket(country, currency) {
  const market = MARKETS[country] ?? MARKETS.HU;
  const target = CURRENCY_CODES.includes(currency) ? currency : market.currency;
  return { ...market, country: MARKETS[country] ? country : 'HU', currency: target };
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
