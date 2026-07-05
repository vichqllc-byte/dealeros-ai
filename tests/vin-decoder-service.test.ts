import { describe, expect, it, vi } from 'vitest';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import type { VinDecoderRepository, RawVinDecodeResult } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import { TtlCache } from '@/lib/vin-intelligence/cache';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function fakeRepository(result: Partial<RawVinDecodeResult>): VinDecoderRepository {
  return { decode: vi.fn(async () => result as RawVinDecodeResult) };
}

describe('VinDecoderService', () => {
  it('normalizes a well-formed NHTSA decode response', async () => {
    const repository = fakeRepository({
      Make: 'FORD', Model: 'Mustang', ModelYear: '2016', Trim: 'GT Premium', BodyClass: 'Coupe',
      DriveType: 'RWD', TransmissionStyle: 'Manual', TransmissionSpeeds: '6', EngineCylinders: '8',
      DisplacementL: '5.0', EngineHP: '435', EngineManufacturer: 'Ford', FuelTypePrimary: 'Gasoline',
      Doors: '2', PlantCity: 'FLAT ROCK', PlantCountry: 'UNITED STATES', ErrorCode: '0', ErrorText: '',
      ABS: 'Standard', ESC: 'Standard', Turbo: 'No'
    });
    const service = new VinDecoderService(repository, new TtlCache<DecodedVehicle>(60_000));

    const decoded = await service.decode('1HGCM82633A004352');
    expect(decoded.make).toBe('FORD');
    expect(decoded.modelYear).toBe(2016);
    expect(decoded.safetyEquipment).toContain('Anti-lock braking system');
    expect(decoded.safetyEquipment).toContain('Electronic stability control');
    expect(decoded.factoryOptions).not.toContain('Turbocharged');
    expect(decoded.decodeCompletenessPercent).toBeGreaterThan(80);
  });

  it('rejects a malformed VIN before ever calling the repository', async () => {
    const repository = fakeRepository({});
    const service = new VinDecoderService(repository, new TtlCache<DecodedVehicle>(60_000));

    await expect(service.decode('TOO-SHORT')).rejects.toThrow(/Invalid VIN/);
    expect(repository.decode).not.toHaveBeenCalled();
  });

  it('flags a checksum mismatch even when NHTSA reports no error code', async () => {
    const repository = fakeRepository({ Make: 'FORD', ErrorCode: '', ErrorText: '' });
    const service = new VinDecoderService(repository, new TtlCache<DecodedVehicle>(60_000));

    // 2HGCM82633A004352 fails the real ISO 3779 check digit (verified earlier).
    const decoded = await service.decode('2HGCM82633A004352');
    expect(decoded.decodeErrorCode).toBe('CHECKSUM_MISMATCH');
  });

  it('caches repeated decodes of the same VIN and only calls the repository once', async () => {
    const repository = fakeRepository({ Make: 'FORD', ErrorCode: '0' });
    const service = new VinDecoderService(repository, new TtlCache<DecodedVehicle>(60_000));

    await service.decode('1HGCM82633A004352');
    await service.decode('1HGCM82633A004352');
    expect(repository.decode).toHaveBeenCalledTimes(1);
  });
});
