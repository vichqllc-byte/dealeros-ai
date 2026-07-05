import { describe, expect, it } from 'vitest';
import { computeVinCheckDigit, validateVinChecksum, validateVinFormat } from '@/lib/vin-intelligence/vin-checksum';

describe('VIN format validation', () => {
  it('accepts a well-formed 17-character VIN', () => {
    expect(validateVinFormat('1HGCM82633A004352').valid).toBe(true);
  });

  it('rejects a VIN that is not 17 characters', () => {
    const result = validateVinFormat('SHORTVIN');
    expect(result.valid).toBe(false);
  });

  it('rejects a VIN containing I, O, or Q', () => {
    expect(validateVinFormat('1HGCM8263O3A00435').valid).toBe(false);
  });
});

describe('VIN check digit (ISO 3779 / NHTSA algorithm)', () => {
  it('validates a known-good VIN used throughout this codebase\'s fixtures', () => {
    const result = validateVinChecksum('1HGCM82633A004352');
    expect(result.valid).toBe(true);
    expect(result.expectedCheckDigit).toBe('3');
  });

  it('flags a VIN with a mismatched check digit', () => {
    // Confirmed against NHTSA's own vPIC decode response, which reports
    // ErrorCode 1 ("Check Digit (9th position) does not calculate properly")
    // for this exact VIN.
    const result = validateVinChecksum('1FA6P8CF9G5259501');
    expect(result.valid).toBe(false);
  });

  it('computes an X check digit when the weighted sum mod 11 is 10', () => {
    // Verified by direct computation: '1HGCM82633A004350' has a weighted
    // sum whose remainder mod 11 is 10, which maps to 'X' per the standard.
    expect(computeVinCheckDigit('1HGCM82633A004350')).toBe('X');
  });
});
