import { isSupabaseConfigured, supabaseClient } from './supabase';
import type {
  InventoryQueryParams,
  InventoryRow,
  Item,
  Location,
  Movement,
  MovementInput
} from './types';

const MOCK_STORAGE_KEY = 'wms-mock-state';

type MockState = {
  items: Item[];
  locations: Location[];
  movements: Movement[];
};

const defaultMockState: MockState = {
  items: [
    {
      id: 'itm-1',
      sku: 'FG-1001',
      name: 'Finished Goods 1001',
      uom: 'PCS',
      barcode: 'FG1001',
      group: 'Finished Goods',
      status: 'active'
    },
    {
      id: 'itm-2',
      sku: 'RM-2040',
      name: 'Raw Material 2040',
      uom: 'KG',
      barcode: 'RM2040',
      group: 'Raw Material',
      status: 'active'
    }
  ],
  locations: [
    { id: 'loc-1', code: 'A01-1', zone: 'A01', capacity: 120 },
    { id: 'loc-2', code: 'A02-2', zone: 'A02', capacity: 80 },
    { id: 'loc-3', code: 'B01-1', zone: 'B01', capacity: 100 }
  ],
  movements: []
};

let memoryState: MockState = { ...defaultMockState };

const readMockState = (): MockState => {
  if (typeof window === 'undefined') {
    return memoryState;
  }

  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(defaultMockState));
      return defaultMockState;
    }
    const parsed = JSON.parse(raw) as MockState;
    return {
      items: parsed.items || defaultMockState.items,
      locations: parsed.locations || defaultMockState.locations,
      movements: parsed.movements || []
    };
  } catch (error) {
    console.warn('Failed to load mock state', error);
    return memoryState;
  }
};

const writeMockState = (next: MockState) => {
  memoryState = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Failed to persist mock state', error);
    }
  }
};

const ensureMockState = () => {
  const state = readMockState();
  if (!state.items.length || !state.locations.length) {
    writeMockState(defaultMockState);
    return defaultMockState;
  }
  return state;
};

const hydrateMovement = (input: MovementInput): Movement => ({
  id: input.id ?? crypto.randomUUID(),
  ts: input.ts ?? new Date().toISOString(),
  type: input.type,
  sku: input.sku,
  from_location: input.from_location ?? null,
  to_location: input.to_location ?? null,
  qty: input.qty,
  ref: input.ref ?? null,
  operator: input.operator,
  notes: input.notes ?? null,
  rev: input.rev ?? Date.now()
});

export const listItems = async (): Promise<Item[]> => {
  if (isSupabaseConfigured && supabaseClient) {
    const { data, error } = await supabaseClient.from('items').select('*').order('sku');
    if (error) {
      console.warn('Supabase listItems error, falling back to mock', error);
    } else if (data) {
      return data as Item[];
    }
  }

  const state = ensureMockState();
  return Promise.resolve(state.items);
};

export const listLocations = async (): Promise<Location[]> => {
  if (isSupabaseConfigured && supabaseClient) {
    const { data, error } = await supabaseClient.from('locations').select('*').order('code');
    if (error) {
      console.warn('Supabase listLocations error, falling back to mock', error);
    } else if (data) {
      return data as Location[];
    }
  }

  const state = ensureMockState();
  return Promise.resolve(state.locations);
};

export const createMovement = async (payload: MovementInput): Promise<Movement> => {
  if (isSupabaseConfigured && supabaseClient) {
    const { data, error } = await supabaseClient.from('movements').insert(payload).select().single();
    if (error) {
      throw error;
    }
    return data as Movement;
  }

  const state = ensureMockState();
  const movement = hydrateMovement(payload);
  const movements = [movement, ...state.movements].slice(0, 200);
  writeMockState({ ...state, movements });
  return movement;
};

export const listRecentMovements = async (limit = 10): Promise<Movement[]> => {
  if (isSupabaseConfigured && supabaseClient) {
    const { data, error } = await supabaseClient
      .from('movements')
      .select('*')
      .order('ts', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Supabase listRecentMovements error, falling back to mock', error);
    } else if (data) {
      return data as Movement[];
    }
  }

  const state = ensureMockState();
  return state.movements
    .slice()
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, limit);
};

export const getInventory = async (params: InventoryQueryParams = {}): Promise<InventoryRow[]> => {
  if (isSupabaseConfigured && supabaseClient) {
    const query = supabaseClient.from('inventory_view').select('*');
    if (params.sku) query.eq('sku', params.sku);
    if (params.location) query.eq('location', params.location);
    if (params.zone) query.eq('zone', params.zone);

    const { data, error } = await query.limit(500);
    if (!error && data) {
      return data as InventoryRow[];
    }
    console.warn('Supabase getInventory error, falling back to mock', error);
  }

  const state = ensureMockState();
  const itemsIndex = new Map(state.items.map((item) => [item.sku, item.name] as const));

  const aggregated = state.movements.reduce<Record<string, InventoryRow>>((acc, movement) => {
    const applyDelta = (locationCode: string, delta: number) => {
      const key = `${movement.sku}-${locationCode}`;
      const row =
        acc[key] ||
        ({
          sku: movement.sku,
          location: locationCode,
          qty_on_hand: 0,
          updated_at: movement.ts,
          item_name: itemsIndex.get(movement.sku)
        } as InventoryRow);
      row.qty_on_hand += delta;
      row.updated_at = movement.ts;
      acc[key] = row;
    };

    if (movement.from_location) {
      applyDelta(movement.from_location, -movement.qty);
    }

    if (movement.to_location) {
      applyDelta(movement.to_location, movement.qty);
    }

    if (!movement.from_location && !movement.to_location) {
      applyDelta('STAGING', movement.qty);
    }

    return acc;
  }, {});

  const rows = Object.values(aggregated);

  return rows
    .filter((row) => {
      if (params.sku && row.sku !== params.sku) return false;
      if (params.location && row.location !== params.location) return false;
      if (params.zone && !row.location.startsWith(params.zone)) return false;
      return true;
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
};
