import { createLogger } from '@/lib/logging/logger';
import { TtlCache } from '@/lib/vin-intelligence/cache';
import { NhtsaVinDecoderRepository, type VinDecoderRepository, type RawVinDecodeResult } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import { validateVinChecksum, validateVinFormat } from '@/lib/vin-intelligence/vin-checksum';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

const logger = createLogger('vin-decoder-service');

// VIN-to-manufacturing-data mappings don't change once a VIN is minted, so
// an aggressive cache TTL is correct and meaningfully reduces external
// calls for repeat lookups of the same vehicle.
const DECODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Field names below are verified against NHTSA vPIC's actual decodevinvalues
// response shape (not guessed) - see the full field list fetched during
// development for confirmation.
const FACTORY_OPTION_FIELDS: Array<[string, string]> = [
  ['Turbo', 'Turbocharged'],
  ['EntertainmentSystem', 'Entertainment system'],
  ['AdaptiveCruiseControl', 'Adaptive cruise control'],
  ['KeylessIgnition', 'Keyless ignition'],
  ['DaytimeRunningLight', 'Daytime running lights'],
  ['AdaptiveHeadlights', 'Adaptive headlights'],
  ['AutomaticPedestrianAlertingSound', 'Automatic pedestrian alerting sound']
];

const SAFETY_EQUIPMENT_FIELDS: Array<[string, string]> = [
  ['ABS', 'Anti-lock braking system'],
  ['ESC', 'Electronic stability control'],
  ['TPMS', 'Tire pressure monitoring system'],
  ['ForwardCollisionWarning', 'Forward collision warning'],
  ['LaneDepartureWarning', 'Lane departure warning'],
  ['LaneKeepSystem', 'Lane keep assist'],
  ['LaneCenteringAssistance', 'Lane centering assistance'],
  ['BlindSpotMon', 'Blind spot monitoring'],
  ['BlindSpotIntervention', 'Blind spot intervention'],
  ['RearCrossTrafficAlert', 'Rear cross traffic alert'],
  ['ParkAssist', 'Park assist'],
  ['RearVisibilitySystem', 'Rear visibility/backup camera'],
  ['PedestrianAutomaticEmergencyBraking', 'Pedestrian automatic emergency braking'],
  ['RearAutomaticEmergencyBraking', 'Rear automatic emergency braking'],
  ['CIB', 'Crash imminent braking'],
  ['DynamicBrakeSupport', 'Dynamic brake support'],
  ['TractionControl', 'Traction control'],
  ['Pretensioner', 'Seatbelt pretensioners'],
  ['AirBagLocFront', 'Front airbags'],
  ['AirBagLocSide', 'Side airbags'],
  ['AirBagLocCurtain', 'Curtain airbags'],
  ['AirBagLocKnee', 'Knee airbags']
];

// Fields NHTSA can plausibly return for a well-decoded VIN; used to compute
// a completeness percentage as a real, data-driven confidence signal.
const COMPLETENESS_FIELDS = [
  'Make', 'Model', 'ModelYear', 'Trim', 'BodyClass', 'DriveType',
  'TransmissionStyle', 'EngineCylinders', 'DisplacementL', 'EngineHP',
  'FuelTypePrimary', 'Doors', 'PlantCity', 'PlantCountry'
];

function normalize(raw: RawVinDecodeResult, vin: string): DecodedVehicle {
  const get = (key: string) => {
    const value = raw[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  };

  const factoryOptions = FACTORY_OPTION_FIELDS
    .filter(([field]) => {
      const value = raw[field];
      return value && value.trim().length > 0 && value.trim().toLowerCase() !== 'no';
    })
    .map(([, label]) => label);

  const safetyEquipment = SAFETY_EQUIPMENT_FIELDS
    .filter(([field]) => {
      const value = raw[field];
      return value && value.trim().length > 0;
    })
    .map(([, label]) => label);

  const populatedCount = COMPLETENESS_FIELDS.filter((field) => get(field) !== null).length;
  const decodeCompletenessPercent = Math.round((populatedCount / COMPLETENESS_FIELDS.length) * 100);

  return {
    vin,
    make: get('Make'),
    model: get('Model'),
    modelYear: get('ModelYear') ? Number(get('ModelYear')) : null,
    trim: get('Trim'),
    series: get('Series'),
    bodyClass: get('BodyClass'),
    driveType: get('DriveType'),
    transmissionStyle: get('TransmissionStyle'),
    transmissionSpeeds: get('TransmissionSpeeds'),
    engineCylinders: get('EngineCylinders'),
    engineDisplacementLiters: get('DisplacementL'),
    engineHorsepower: get('EngineHP'),
    engineManufacturer: get('EngineManufacturer'),
    fuelTypePrimary: get('FuelTypePrimary'),
    doors: get('Doors'),
    plantCity: get('PlantCity'),
    plantCountry: get('PlantCountry'),
    factoryOptions,
    safetyEquipment,
    decodeErrorCode: get('ErrorCode'),
    decodeErrorText: get('ErrorText'),
    decodeCompletenessPercent,
    raw
  };
}

export class VinDecoderService {
  constructor(
    private readonly repository: VinDecoderRepository = new NhtsaVinDecoderRepository(),
    private readonly cache: TtlCache<DecodedVehicle> = new TtlCache(DECODE_CACHE_TTL_MS)
  ) {}

  async decode(vin: string): Promise<DecodedVehicle> {
    const upperVin = vin.toUpperCase();
    const format = validateVinFormat(upperVin);
    if (!format.valid) {
      throw new Error(`Invalid VIN: ${format.reason}`);
    }

    return this.cache.getOrLoad(upperVin, async () => {
      logger.info('Decoding VIN via NHTSA vPIC', { vin: upperVin });
      const raw = await this.repository.decode(upperVin);
      const decoded = normalize(raw, upperVin);

      const checksum = validateVinChecksum(upperVin);
      if (!checksum.valid && !decoded.decodeErrorCode) {
        // Defense in depth: flag a checksum mismatch even if NHTSA's own
        // error code was empty for some reason.
        decoded.decodeErrorCode = decoded.decodeErrorCode ?? 'CHECKSUM_MISMATCH';
        decoded.decodeErrorText = decoded.decodeErrorText || 'VIN check digit does not match position 9';
      }

      return decoded;
    });
  }
}

export const vinDecoderService = new VinDecoderService();
