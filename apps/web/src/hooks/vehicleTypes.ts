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
