export type Role = 'operator' | 'supervisor' | 'admin';

export type MovementType = 'receive' | 'putaway' | 'pick' | 'adjust';

export interface Item {
  id: string;
  sku: string;
  name: string;
  uom: string;
  barcode: string;
  group: string;
  status: 'active' | 'inactive';
}

export interface Location {
  id: string;
  code: string;
  zone: string;
  capacity: number;
}

export interface Movement {
  id: string;
  ts: string;
  type: MovementType;
  sku: string;
  from_location?: string | null;
  to_location?: string | null;
  qty: number;
  ref?: string | null;
  operator: string;
  notes?: string | null;
  rev: number;
}

export type MovementInput = Omit<Movement, 'id' | 'ts' | 'rev'> & {
  id?: string;
  ts?: string;
  rev?: number;
};

export interface InventoryRow {
  sku: string;
  location: string;
  qty_on_hand: number;
  updated_at: string;
  item_name?: string;
}

export interface InventoryQueryParams {
  sku?: string;
  location?: string;
  zone?: string;
}
