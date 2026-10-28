/** Same categories as Buy check and the backend (CATEGORIES in item-recognition.js). */
export type ItemCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'bags'
  | 'accessories'
  | 'other';

export const CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'bags', label: 'Bags' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ItemCategory, string>;
