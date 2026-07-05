import { describe, expect, it } from 'vitest';
import { calculateLoanPayment } from '@/lib/sales/payment-calculator';

describe('calculateLoanPayment', () => {
  it('matches a known amortization example', () => {
    const result = calculateLoanPayment({ principal: 20000, apr: 6, termMonths: 60 });
    expect(result.monthlyPayment).toBeCloseTo(386.66, 1);
  });

  it('handles 0% APR as a straight-line split', () => {
    const result = calculateLoanPayment({ principal: 10000, apr: 0, termMonths: 12 });
    expect(result.monthlyPayment).toBeCloseTo(833.33, 2);
    expect(result.totalInterest).toBe(0);
  });

  it('rejects a non-positive term', () => {
    expect(() => calculateLoanPayment({ principal: 1000, apr: 5, termMonths: 0 })).toThrow();
  });

  it('rejects a negative principal', () => {
    expect(() => calculateLoanPayment({ principal: -100, apr: 5, termMonths: 12 })).toThrow();
  });

  it('produces total interest consistent with total paid minus principal', () => {
    const result = calculateLoanPayment({ principal: 15000, apr: 8.5, termMonths: 48 });
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 15000, 2);
  });
});
