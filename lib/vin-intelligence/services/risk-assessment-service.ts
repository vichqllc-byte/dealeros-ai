import { validateVinChecksum } from '@/lib/vin-intelligence/vin-checksum';
import type { DecodedVehicle, Explained, RiskAssessment } from '@/lib/vin-intelligence/types';

/**
 * Composite risk signal engine covering VIN confidence, fraud indicators,
 * and odometer anomalies from data this system genuinely has access to:
 *
 *  - VIN checksum validity (real ISO 3779 algorithm)
 *  - NHTSA decode error codes / decode completeness (real)
 *  - Decoded-vs-manually-entered spec mismatches (real, from our own data)
 *  - Odometer rollback detection against this vehicle's own prior
 *    VinAnalysis mileage history in our database (real, internal data)
 *
 * Full commercial title-brand history (salvage/flood/theft-recovery
 * branding, prior-owner count, lien records) requires a paid provider such
 * as NMVTIS or Carfax/AutoCheck - no credentials for one exist in this
 * environment. This service is intentionally architected so such a
 * provider can be added as another signal source later without changing
 * its public shape (RiskAssessment stays the same; a new signal simply
 * gets appended).
 */
export function assessVehicleRisk(input: {
  decoded: DecodedVehicle;
  manualMake?: string | null;
  manualModel?: string | null;
  manualYear?: number | null;
  currentMileage?: number | null;
  priorMileageReadings?: number[];
}): Explained<RiskAssessment> {
  const signals: string[] = [];
  let score = 0;

  const checksum = validateVinChecksum(input.decoded.vin);
  if (!checksum.valid) {
    score += 40;
    signals.push(`VIN check digit mismatch (expected ${checksum.expectedCheckDigit}, found ${checksum.actualCheckDigit}) - possible typo or tampered VIN`);
  }

  if (input.decoded.decodeErrorCode && input.decoded.decodeErrorCode !== '0') {
    score += 15;
    signals.push(`NHTSA decode reported an issue: ${input.decoded.decodeErrorText ?? input.decoded.decodeErrorCode}`);
  }

  if (input.decoded.decodeCompletenessPercent < 40) {
    score += 10;
    signals.push(`Low decode completeness (${input.decoded.decodeCompletenessPercent}%) - manufacturer data may be incomplete for this VIN`);
  }

  if (input.manualMake && input.decoded.make && input.manualMake.toUpperCase() !== input.decoded.make.toUpperCase()) {
    score += 25;
    signals.push(`Manually entered make "${input.manualMake}" does not match decoded make "${input.decoded.make}"`);
  }

  if (input.manualModel && input.decoded.model && input.manualModel.toUpperCase() !== input.decoded.model.toUpperCase()) {
    score += 20;
    signals.push(`Manually entered model "${input.manualModel}" does not match decoded model "${input.decoded.model}"`);
  }

  if (input.manualYear && input.decoded.modelYear && input.manualYear !== input.decoded.modelYear) {
    score += 15;
    signals.push(`Manually entered year ${input.manualYear} does not match decoded model year ${input.decoded.modelYear}`);
  }

  const priorReadings = input.priorMileageReadings ?? [];
  if (input.currentMileage != null && priorReadings.length > 0) {
    const maxPriorReading = Math.max(...priorReadings);
    if (input.currentMileage < maxPriorReading) {
      score += 35;
      signals.push(`Odometer anomaly: current reading ${input.currentMileage} is lower than a previously recorded reading of ${maxPriorReading} for this vehicle`);
    }
  }

  const clampedScore = Math.min(100, score);
  const level: RiskAssessment['level'] = clampedScore >= 50 ? 'High' : clampedScore >= 20 ? 'Medium' : 'Low';

  if (signals.length === 0) {
    signals.push('No risk signals detected from VIN checksum, NHTSA decode data, or internal mileage history');
  }

  return { value: { level, score: clampedScore, signals }, reasons: signals };
}
