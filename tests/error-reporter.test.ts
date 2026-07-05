import { describe, expect, it, vi } from 'vitest';
import { reportError } from '@/lib/errors/error-reporter';

describe('reportError (console reporter, no error-tracking provider configured)', () => {
  it('logs the error message and stack without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      reportError(new Error('boom'), { route: '/api/test' });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = errorSpy.mock.calls[0][0] as string;
      expect(logged).toContain('boom');
      expect(logged).toContain('/api/test');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
