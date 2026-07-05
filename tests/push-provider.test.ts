import { describe, expect, it } from 'vitest';
import { sendPush } from '@/lib/push/push-provider';

describe('sendPush (console transport, no push provider configured)', () => {
  it('resolves without delivering since no real provider is configured', async () => {
    const result = await sendPush({ deviceToken: 'device-abc', title: 'Test', body: 'test message' });
    expect(result.delivered).toBe(false);
    expect(result.providerMessageId).toBeNull();
  });
});
