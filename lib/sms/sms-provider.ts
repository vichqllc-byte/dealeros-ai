import { createLogger } from '@/lib/logging/logger';

/**
 * SMS transport boundary, same pattern as lib/email/mailer.ts. No SMS
 * provider (Twilio, Vonage, etc.) credentials are configured in this
 * environment, so the default transport logs the message instead of
 * sending it over the network. Swapping in a real provider means
 * implementing `SmsProvider` and selecting it below based on an
 * `SMS_PROVIDER` env var.
 */

export type SmsMessage = {
  toPhone: string;
  message: string;
};

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ delivered: boolean; providerMessageId: string | null }>;
}

const logger = createLogger('sms-provider');

class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<{ delivered: boolean; providerMessageId: string | null }> {
    logger.info('SMS (console transport - no SMS provider configured)', { toPhone: message.toPhone, message: message.message });
    return { delivered: false, providerMessageId: null };
  }
}

function resolveProvider(): SmsProvider {
  // Future: switch on process.env.SMS_PROVIDER to select a real provider
  // (e.g. Twilio) once credentials are configured.
  return new ConsoleSmsProvider();
}

const provider = resolveProvider();

export async function sendSms(message: SmsMessage) {
  return provider.send(message);
}
