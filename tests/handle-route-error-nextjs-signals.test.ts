import { describe, expect, it, vi } from 'vitest';
import { handleRouteError } from '@/lib/api/responses';

describe('handleRouteError and Next.js internal control-flow signals', () => {
  it('re-throws (does not swallow or report) a DYNAMIC_SERVER_USAGE error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const nextError = Object.assign(new Error('Dynamic server usage'), { digest: 'DYNAMIC_SERVER_USAGE' });
      expect(() => handleRouteError(nextError)).toThrow(nextError);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('re-throws a NEXT_REDIRECT signal', () => {
    const nextError = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' });
    expect(() => handleRouteError(nextError)).toThrow(nextError);
  });

  it('still reports and converts a genuine unexpected error to a 500', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = handleRouteError(new Error('a real bug'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.message).toBe('a real bug');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
