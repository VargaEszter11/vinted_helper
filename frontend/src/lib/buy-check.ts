import { api } from '@/lib/api';
import type { LocalPhoto } from '@/lib/types';

export const MAX_BUY_CHECK_PHOTOS = 3;
/**
 * Photos for a check are sent smaller than item photos. The provider scales images down to
 * about 1300 px anyway, but tags are small, so keep enough detail to read them.
 */
export const BUY_CHECK_PHOTO_WIDTH = 1280;

export type ConditionValue = 'new_with_tags' | 'very_good' | 'good' | 'fair';

export const CONDITION_OPTIONS: { value: ConditionValue; label: string }[] = [
  { value: 'new_with_tags', label: 'New with tags' },
  { value: 'very_good', label: 'Very good' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export const CATEGORY_OPTIONS = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'bags', label: 'Bags' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
];

export type Confidence = 'low' | 'medium' | 'high';

export const RESULT_FIELDS = [
  'brand',
  'model',
  'item_type',
  'category',
  'size',
  'colour',
  'material',
  'condition',
  'suggested_name',
  'search_phrase',
  'visible_text',
] as const;

export type ResultField = (typeof RESULT_FIELDS)[number];

export type BuyCheckResult = {
  fields: Record<ResultField, string | null>;
  /** Where each field came from: typed by the user, filled by the AI, or not visible. */
  sources: Record<ResultField, 'user' | 'ai' | null>;
  confidence: Confidence;
  /** The price the user entered, echoed back for the price comparison step to come. */
  price: number;
};

export type BuyCheckInput = {
  photos: LocalPhoto[];
  price: number;
  brand: string;
  colour: string;
  size: string;
  condition: ConditionValue | null;
};

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Sends the photos and any typed details to the backend. Nothing is saved. */
export function identifyItem(input: BuyCheckInput): Promise<BuyCheckResult> {
  return api<BuyCheckResult>('/buy-check/identify', {
    method: 'POST',
    body: {
      images: input.photos.map((photo) => photo.base64),
      price: input.price,
      brand: orNull(input.brand),
      colour: orNull(input.colour),
      size: orNull(input.size),
      condition: input.condition,
    },
  });
}

// --- Price lookup and verdict ------------------------------------------------------------

export type Verdict = 'BUY' | 'MAYBE' | 'SKIP';

/** The verdict thresholds, sent by the server so the app always uses the same values. */
export type VerdictThresholds = {
  buyMarginPercent: number;
  buyMinMarginHuf: number;
  askingPriceHaircut: number;
  newPriceHaircut: number;
  minOwnSales: number;
  minDataPoints: number;
};

export type PriceSource = {
  title: string;
  url: string;
  price: number;
  original: { amount: number; currency: string } | null;
};

export type UsedListing = {
  title: string;
  url: string;
  /** The site the listing is on, for example vinted.hu. */
  site: string;
  /** The listing's own photo, when it could be read. */
  image_url?: string | null;
  /** How the listing's photo compares with yours, when it was compared. */
  visual?: { match: 'same' | 'similar' | 'unclear'; reason: string | null };
  price: number | null;
  size: string | null;
  condition: string | null;
  reason: string | null;
};

export type PricesResult = {
  price: number;
  web: {
    available: boolean;
    message?: string;
    new_price: { min: number; median: number; max: number; currency: 'HUF'; sources: PriceSource[] } | null;
    used: { listings: UsedListing[]; dropped: UsedListing[] };
    note: string | null;
    rates_note: string | null;
  };
  /** The photo comparison of the second-hand listings with your photos. */
  visual: { used: boolean; compared: number; dropped: number; note: string | null };
  cache: { hit: boolean; fetched_at: string } | null;
  own_sales: {
    count: number;
    match: 'brand_category' | 'category' | null;
    median_sold_for: number | null;
    median_days_to_sell: number | null;
    days_samples: number;
  };
  verdict: {
    verdict: Verdict | 'LOW_CONFIDENCE';
    leaning: Verdict | null;
    estimate: { source: 'own_sales' | 'used_asking' | 'new_price'; value: number; data_points: number } | null;
    margin: number | null;
    margin_percent: number | null;
    explanation: string;
  };
  thresholds: VerdictThresholds;
};

export type PricesInput = {
  price: number;
  search_phrase: string;
  brand: string;
  item_type: string;
  category: string;
  size: string;
  colour: string;
  condition: string;
  /** Base64 JPEGs of the item (at most 2), so listings can be compared with its photos. */
  images?: string[];
};

/** Looks up prices for the (corrected) item. Nothing is saved. */
export function findPrices(input: PricesInput): Promise<PricesResult> {
  return api<PricesResult>('/buy-check/prices', { method: 'POST', body: input });
}

/** The same rule the server uses: margin = resale value minus the price you pay. */
export function classifyMargin(margin: number, price: number, thresholds: VerdictThresholds): Verdict {
  if (margin >= (price * thresholds.buyMarginPercent) / 100 && margin >= thresholds.buyMinMarginHuf) return 'BUY';
  if (margin > 0) return 'MAYBE';
  return 'SKIP';
}

export const vintedSearchUrl = (phrase: string) =>
  `https://www.vinted.hu/catalog?search_text=${encodeURIComponent(phrase.trim())}`;
