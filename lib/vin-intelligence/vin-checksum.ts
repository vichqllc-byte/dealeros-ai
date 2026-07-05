/**
 * VIN format and check-digit validation per the North American VIN
 * standard (ISO 3779 / SAE J853, the same algorithm NHTSA's vPIC uses
 * internally - its decode responses include an ErrorCode/ErrorText when
 * this check fails, which lib/vin-intelligence/services/vin-decoder-service.ts
 * cross-references). VINs never contain I, O, or Q (reserved to avoid
 * confusion with 1 and 0).
 */

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const VIN_SHAPE_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export type VinFormatResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateVinFormat(vin: string): VinFormatResult {
  if (vin.length !== 17) return { valid: false, reason: 'VIN must be exactly 17 characters' };
  if (!VIN_SHAPE_PATTERN.test(vin.toUpperCase())) {
    return { valid: false, reason: 'VIN contains invalid characters (I, O, and Q are never used)' };
  }
  return { valid: true };
}

/** Computes the expected check digit (position 9) for a syntactically valid 17-char VIN. */
export function computeVinCheckDigit(vin: string): string {
  const upper = vin.toUpperCase();
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value = TRANSLITERATION[upper[i]];
    sum += (value ?? 0) * POSITION_WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

export type VinChecksumResult = {
  valid: boolean;
  expectedCheckDigit: string;
  actualCheckDigit: string;
};

/** Validates the VIN's self-check digit (position 9). A mismatch is a strong
 * signal of a typo, a tampered/cloned VIN plate, or an otherwise invalid VIN. */
export function validateVinChecksum(vin: string): VinChecksumResult {
  const upper = vin.toUpperCase();
  const expectedCheckDigit = computeVinCheckDigit(upper);
  const actualCheckDigit = upper[8];
  return { valid: expectedCheckDigit === actualCheckDigit, expectedCheckDigit, actualCheckDigit };
}
