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
