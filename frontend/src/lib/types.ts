export type ItemStatus = 'in_stock' | 'listed' | 'sold';

export type ItemPhoto = {
  id: string;
  item_id: string;
  storage_path: string;
  position: number;
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
  created_at: string;
  item_photos: ItemPhoto[];
};

export type ItemValues = Pick<
  Item,
  'name' | 'bought_for' | 'listed_for' | 'status' | 'sold_for' | 'sold_date'
>;

/** A photo picked on this device that has not been uploaded yet. */
export type LocalPhoto = {
  key: string;
  uri: string;
  base64: string;
};
