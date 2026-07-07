import { AppError } from '@/lib/api/responses';

export function requireIntegrationConfig(name: string, endpoint?: string, apiKey?: string) {
  if (!endpoint || !apiKey) {
    throw new AppError(`${name} integration is not configured`, 500, 'INTEGRATION_CONFIG_ERROR');
  }
}
