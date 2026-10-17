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
