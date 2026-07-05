import { describe, expect, it } from 'vitest';
import { sendSms } from '@/lib/sms/sms-provider';

describe('sendSms (console transport, no SMS provider configured)', () => {
  it('resolves without delivering since no real provider is configured', async () => {
    const result = await sendSms({ toPhone: '+15551234567', message: 'test message' });
    expect(result.delivered).toBe(false);
    expect(result.providerMessageId).toBeNull();
  });
});
