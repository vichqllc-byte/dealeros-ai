import { createLogger } from '@/lib/logging/logger';

/**
 * Push-notification transport boundary, same pattern as lib/email/mailer.ts
 * and lib/sms/sms-provider.ts. No push provider (FCM, APNs, etc.)
 * credentials are configured in this environment, so the default
 * transport logs the notification instead of sending it over the
 * network. Swapping in a real provider means implementing `PushProvider`
 * and selecting it below based on a `PUSH_PROVIDER` env var.
 */

export type PushMessage = {
  deviceToken: string;
  title: string;
  body: string;
  link?: string;
};

export interface PushProvider {
  send(message: PushMessage): Promise<{ delivered: boolean; providerMessageId: string | null }>;
}

const logger = createLogger('push-provider');

class ConsolePushProvider implements PushProvider {
  async send(message: PushMessage): Promise<{ delivered: boolean; providerMessageId: string | null }> {
    logger.info('Push notification (console transport - no push provider configured)', {
      deviceToken: message.deviceToken,
      title: message.title
    });
    return { delivered: false, providerMessageId: null };
  }
}

function resolveProvider(): PushProvider {
  // Future: switch on process.env.PUSH_PROVIDER to select a real provider
  // (e.g. Firebase Cloud Messaging, APNs) once credentials are configured.
  return new ConsolePushProvider();
}

const provider = resolveProvider();

export async function sendPush(message: PushMessage) {
  return provider.send(message);
}
