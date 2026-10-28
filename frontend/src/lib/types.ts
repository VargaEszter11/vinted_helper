import type { ItemVintedCategory } from '@/lib/item-vinted-categories';

export type ItemStatus = 'in_stock' | 'listed' | 'sold';

export type { ItemVintedCategory };

/** Same scale the Buy check AI uses (see CONDITIONS in the backend). */
export type ItemCondition = 'new_with_tags' | 'very_good' | 'good' | 'fair';

export type StatusChange = {
  status: ItemStatus;
  changed_at: string;
};

export type ItemPhoto = {
  id: string;
  item_id: string;
  storage_path: string;
  position: number;
  /** Absolute, temporary link to the image. */
  url: string;
};

export type Item = {
  id: string;
  user_id: string;
  name: string;
  bought_for: number;
  listed_for: number | null;
  status: ItemStatus;
  sold_for: number | null;
  sold_date: string | null;
  brand: string | null;
  size: string | null;
  measurements: string | null;
  flaws: string | null;
  condition: ItemCondition | null;
  category: ItemVintedCategory | null;
  created_at: string;
  /** When the status last changed; set by the database. */
  status_changed_at: string;
  /** The bundle the item is listed (or was sold) in, with that bundle's price. */
  bundle_id: string | null;
  bundle_listed_for: number | null;
  item_photos: ItemPhoto[];
};

export type ItemValues = Pick<
  Item,
  | 'name'
  | 'bought_for'
  | 'listed_for'
  | 'status'
  | 'sold_for'
  | 'sold_date'
  | 'brand'
  | 'size'
  | 'measurements'
  | 'flaws'
  | 'condition'
  | 'category'
>;

/** A photo picked on this device that has not been uploaded yet. */
export type LocalPhoto = {
  key: string;
  uri: string;
  base64: string;
};
