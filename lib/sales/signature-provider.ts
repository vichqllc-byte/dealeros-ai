import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';

/**
 * A legally-enforceable electronic signature requires a licensed e-sign
 * provider (DocuSign, HelloSign/Dropbox Sign, Adobe Sign) that handles
 * identity verification, consent language, and a tamper-evident audit
 * trail - none of which this codebase can legitimately fabricate. No such
 * provider is configured in this environment (ESIGN_PROVIDER_API_KEY is
 * unset).
 *
 * `ESignProvider` is the real adapter boundary for one, ready to activate
 * the moment real credentials are configured. Until then, documents are
 * tracked via `signatureMethod: 'MANUAL_WET_SIGNATURE'` (see
 * sale-document-service.ts) - an honest digital record that a physical/
 * in-person signature was collected, which is what dealerships have
 * always done and is NOT presented as a verified electronic signature.
 */
export interface ESignProvider {
  readonly name: string;
  isAvailable(): boolean;
  requestSignature(documentId: string, signerEmail: string): Promise<{ envelopeId: string }>;
}

class UnconfiguredESignProvider implements ESignProvider {
  readonly name = 'e-sign-provider';

  isAvailable(): boolean {
    return isProviderConfigured('esign');
  }

  async requestSignature(): Promise<{ envelopeId: string }> {
    throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('esign'));
  }
}

export const eSignProvider: ESignProvider = new UnconfiguredESignProvider();
