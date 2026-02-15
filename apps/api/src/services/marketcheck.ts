import { AppError } from '../middleware/error';
import { ERROR_CODES } from '@otter-money/shared';

const MARKETCHECK_API_KEY = process.env.MARKETCHECK_API_KEY;
const MARKETCHECK_BASE_URL =
  process.env.MARKETCHECK_BASE_URL || 'https://mc-api.marketcheck.com/v2';

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api';

// ============================================
// MarketCheck Price API
// ============================================

export interface MarketCheckPriceResult {
  marketValue: number;
  msrp: number | null;
  rawResponse: Record<string, unknown>;
}

export function isMarketCheckConfigured(): boolean {
  return !!MARKETCHECK_API_KEY;
}

export async function getVehicleValue(
  vin: string,
  miles: number,
  zipCode: string
): Promise<MarketCheckPriceResult> {
  if (!MARKETCHECK_API_KEY) {
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'MarketCheck API key is not configured',
      503
    );
  }

  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    vin,
    miles: String(miles),
    zip: zipCode,
    dealer_type: 'independent',
  });

  const url = `${MARKETCHECK_BASE_URL}/predict/car/us/marketcheck_price?${params}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.error('MarketCheck API network error:', err);
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'Failed to connect to MarketCheck API',
      503
    );
  }

  if (response.status === 429) {
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'MarketCheck API rate limit exceeded. Please try again later.',
      429
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('MarketCheck API error:', response.status, errorBody);
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      `MarketCheck API returned status ${response.status}`,
      502
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (!data.marketcheck_price) {
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'MarketCheck API did not return a price for this vehicle',
      422
    );
  }

  return {
    marketValue: data.marketcheck_price as number,
    msrp: (data.msrp as number) ?? null,
    rawResponse: data,
  };
}

// ============================================
// NHTSA VIN Decoder (free, no API key needed)
// ============================================

export interface NhtsaDecodeResult {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  bodyClass: string | null;
  driveType: string | null;
  fuelType: string | null;
  engineCylinders: number | null;
  displacement: string | null;
  transmission: string | null;
}

export async function decodeVin(vin: string): Promise<NhtsaDecodeResult> {
  const url = `${NHTSA_BASE_URL}/vehicles/DecodeVinValues/${vin}?format=json`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.error('NHTSA API network error:', err);
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'Failed to connect to NHTSA VIN decoder',
      503
    );
  }

  if (!response.ok) {
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'NHTSA VIN decoder returned an error',
      502
    );
  }

  const data = (await response.json()) as { Results?: Record<string, string>[] };
  const result = data.Results?.[0];

  if (!result || !result.ModelYear || !result.Make || !result.Model) {
    throw new AppError(
      ERROR_CODES.MARKETCHECK_ERROR,
      'Could not decode VIN. Please check the VIN and try again.',
      422
    );
  }

  return {
    year: parseInt(result.ModelYear, 10),
    make: titleCase(result.Make),
    model: result.Model,
    trim: result.Trim || null,
    bodyClass: result.BodyClass || null,
    driveType: result.DriveType || null,
    fuelType: result.FuelTypePrimary || null,
    engineCylinders: result.EngineCylinders
      ? parseInt(result.EngineCylinders, 10)
      : null,
    displacement: result.DisplacementL || null,
    transmission: result.TransmissionStyle || null,
  };
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// In-memory cache (24h TTL)
// ============================================

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  if (entry) cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// ============================================
// NHTSA Make / Model Lookups (free, no key)
// ============================================

export interface NhtsaMakeItem {
  id: number;
  name: string;
}

export interface NhtsaModelItem {
  id: number;
  name: string;
}

export async function getAllMakes(): Promise<NhtsaMakeItem[]> {
  const cached = getCached<NhtsaMakeItem[]>('makes');
  if (cached) return cached;

  const vehicleTypes = ['car', 'truck', 'multipurpose passenger vehicle (mpv)'];

  const responses = await Promise.all(
    vehicleTypes.map(async (vtype) => {
      const url = `${NHTSA_BASE_URL}/vehicles/GetMakesForVehicleType/${encodeURIComponent(vtype)}?format=json`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = (await res.json()) as {
          Results?: Array<{ MakeId: number; MakeName: string }>;
        };
        return data.Results || [];
      } catch {
        return [];
      }
    })
  );

  // Dedup by name (case-insensitive)
  const seen = new Map<string, NhtsaMakeItem>();
  for (const results of responses) {
    for (const item of results) {
      const normalized = item.MakeName.toLowerCase();
      if (!seen.has(normalized)) {
        seen.set(normalized, {
          id: item.MakeId,
          name: titleCase(item.MakeName),
        });
      }
    }
  }

  const makes = Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  setCache('makes', makes);
  return makes;
}

export async function getModelsForMakeYear(
  make: string,
  year: number
): Promise<NhtsaModelItem[]> {
  const cacheKey = `models:${make.toLowerCase()}:${year}`;
  const cached = getCached<NhtsaModelItem[]>(cacheKey);
  if (cached) return cached;

  const url = `${NHTSA_BASE_URL}/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = (await response.json()) as {
    Results?: Array<{ Model_ID: number; Model_Name: string }>;
  };

  const results = data.Results || [];

  // Dedup by name
  const seen = new Map<string, NhtsaModelItem>();
  for (const item of results) {
    const normalized = item.Model_Name.toLowerCase();
    if (!seen.has(normalized)) {
      seen.set(normalized, {
        id: item.Model_ID,
        name: titleCase(item.Model_Name),
      });
    }
  }

  const models = Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  setCache(cacheKey, models);
  return models;
}

// ============================================
// MarketCheck Trim Lookups (facets endpoint)
// ============================================

export interface MarketCheckTrimItem {
  id: number;
  name: string;
}

export async function getTrimsForMakeModelYear(
  make: string,
  model: string,
  year: number
): Promise<MarketCheckTrimItem[]> {
  const cacheKey = `trims:${make.toLowerCase()}:${model.toLowerCase()}:${year}`;
  const cached = getCached<MarketCheckTrimItem[]>(cacheKey);
  if (cached) return cached;

  if (!MARKETCHECK_API_KEY) return [];

  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    year: String(year),
    make,
    model,
    rows: '0',
    facets: 'trim',
  });

  const url = `${MARKETCHECK_BASE_URL}/search/car/active?${params}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = (await response.json()) as {
    facets?: {
      trim?: Array<{ item: string; count: number }>;
    };
  };

  const facets = data.facets?.trim || [];

  const trims: MarketCheckTrimItem[] = facets.map((f, idx) => ({
    id: idx + 1,
    name: f.item,
  }));

  setCache(cacheKey, trims);
  return trims;
}

// ============================================
// MarketCheck VIN Lookup (find a VIN for year/make/model/trim)
// ============================================

export async function findVinForVehicle(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<string | null> {
  if (!MARKETCHECK_API_KEY) return null;

  const params = new URLSearchParams({
    api_key: MARKETCHECK_API_KEY,
    year: String(year),
    make,
    model,
    rows: '1',
  });

  if (trim) {
    params.set('trim', trim);
  }

  const url = `${MARKETCHECK_BASE_URL}/search/car/active?${params}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = (await response.json()) as {
    listings?: Array<{ vin?: string }>;
  };

  return data.listings?.[0]?.vin || null;
}
