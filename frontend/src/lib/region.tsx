import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { readPreference, writePreference } from '@/lib/preferences';

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
] as const;

export const CURRENCY_CODES = ['HUF', 'EUR', 'USD', 'GBP', 'PLN', 'CZK', 'RON', 'CHF'] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type CountryInfo = {
  code: CountryCode;
  currency: CurrencyCode;
  vintedHost: string;
};

export type CurrencyInfo = {
  code: CurrencyCode;
  /** Shown after the amount, like Ft or €. */
  symbol: string;
  /** Extra tokens parsePrice strips from a typed amount. */
  aliases: string[];
};

export const COUNTRIES: Record<CountryCode, CountryInfo> = {
  HU: { code: 'HU', currency: 'HUF', vintedHost: 'www.vinted.hu' },
  AT: { code: 'AT', currency: 'EUR', vintedHost: 'www.vinted.at' },
  BE: { code: 'BE', currency: 'EUR', vintedHost: 'www.vinted.be' },
  CZ: { code: 'CZ', currency: 'CZK', vintedHost: 'www.vinted.cz' },
  DE: { code: 'DE', currency: 'EUR', vintedHost: 'www.vinted.de' },
  ES: { code: 'ES', currency: 'EUR', vintedHost: 'www.vinted.es' },
  FR: { code: 'FR', currency: 'EUR', vintedHost: 'www.vinted.fr' },
  GB: { code: 'GB', currency: 'GBP', vintedHost: 'www.vinted.co.uk' },
  IT: { code: 'IT', currency: 'EUR', vintedHost: 'www.vinted.it' },
  LT: { code: 'LT', currency: 'EUR', vintedHost: 'www.vinted.lt' },
  LU: { code: 'LU', currency: 'EUR', vintedHost: 'www.vinted.lu' },
  NL: { code: 'NL', currency: 'EUR', vintedHost: 'www.vinted.nl' },
  PL: { code: 'PL', currency: 'PLN', vintedHost: 'www.vinted.pl' },
  PT: { code: 'PT', currency: 'EUR', vintedHost: 'www.vinted.pt' },
  RO: { code: 'RO', currency: 'RON', vintedHost: 'www.vinted.ro' },
  SK: { code: 'SK', currency: 'EUR', vintedHost: 'www.vinted.sk' },
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  HUF: { code: 'HUF', symbol: 'Ft', aliases: ['ft', 'huf', 'forint'] },
  EUR: { code: 'EUR', symbol: '€', aliases: ['eur', 'euro'] },
  USD: { code: 'USD', symbol: '$', aliases: ['usd', 'us$'] },
  GBP: { code: 'GBP', symbol: '£', aliases: ['gbp', 'pound'] },
  PLN: { code: 'PLN', symbol: 'zł', aliases: ['pln', 'zl'] },
  CZK: { code: 'CZK', symbol: 'Kč', aliases: ['czk', 'kc'] },
  RON: { code: 'RON', symbol: 'lei', aliases: ['ron', 'leu'] },
  CHF: { code: 'CHF', symbol: 'CHF', aliases: ['chf', 'fr'] },
};

export const DEFAULT_COUNTRY: CountryCode = 'HU';
export const DEFAULT_CURRENCY: CurrencyCode = 'HUF';

export function isCountry(value: string | null): value is CountryCode {
  return value != null && (COUNTRY_CODES as readonly string[]).includes(value);
}

export function isCurrency(value: string | null): value is CurrencyCode {
  return value != null && (CURRENCY_CODES as readonly string[]).includes(value);
}

type RegionState = {
  country: CountryCode;
  currency: CurrencyCode;
  setCountry: (country: CountryCode) => void;
  setCurrency: (currency: CurrencyCode) => void;
  ready: boolean;
};

let currentCountry: CountryCode = DEFAULT_COUNTRY;
let currentCurrency: CurrencyCode = DEFAULT_CURRENCY;

export function getRegion(): { country: CountryCode; currency: CurrencyCode } {
  return { country: currentCountry, currency: currentCurrency };
}

export function getCurrency(): CurrencyInfo {
  return CURRENCIES[currentCurrency];
}

const RegionContext = createContext<RegionState>({
  country: DEFAULT_COUNTRY,
  currency: DEFAULT_CURRENCY,
  setCountry: () => {},
  setCurrency: () => {},
  ready: false,
});

export function RegionProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [ready, setReady] = useState(false);

  function apply(nextCountry: CountryCode, nextCurrency: CurrencyCode) {
    currentCountry = nextCountry;
    currentCurrency = nextCurrency;
    setCountryState(nextCountry);
    setCurrencyState(nextCurrency);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([readPreference('country'), readPreference('currency')]).then(([storedCountry, storedCurrency]) => {
      if (cancelled) return;
      const nextCountry = isCountry(storedCountry) ? storedCountry : DEFAULT_COUNTRY;
      const nextCurrency = isCurrency(storedCurrency) ? storedCurrency : COUNTRIES[nextCountry].currency;
      apply(nextCountry, nextCurrency);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setCountry(next: CountryCode) {
    apply(next, COUNTRIES[next].currency);
    void writePreference('country', next);
    void writePreference('currency', COUNTRIES[next].currency);
  }

  function setCurrency(next: CurrencyCode) {
    apply(country, next);
    void writePreference('currency', next);
  }

  return (
    <RegionContext.Provider value={{ country, currency, setCountry, setCurrency, ready }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion(): RegionState {
  return useContext(RegionContext);
}
