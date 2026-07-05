export type PaymentCalculatorInput = {
  principal: number;
  apr: number; // annual percentage rate, e.g. 6.5 for 6.5%
  termMonths: number;
};

export type PaymentCalculatorResult = {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
};

/** Standard loan amortization formula (real, well-established finance
 * math): M = P * r(1+r)^n / ((1+r)^n - 1), with the 0%-APR edge case
 * handled as a straight-line principal split. */
export function calculateLoanPayment(input: PaymentCalculatorInput): PaymentCalculatorResult {
  const { principal, apr, termMonths } = input;
  if (termMonths <= 0) throw new Error('termMonths must be positive');
  if (principal < 0) throw new Error('principal must be non-negative');

  const monthlyRate = apr / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / termMonths
    : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);

  const totalPaid = monthlyPayment * termMonths;
  const totalInterest = totalPaid - principal;

  return {
    monthlyPayment: Number(monthlyPayment.toFixed(2)),
    totalPaid: Number(totalPaid.toFixed(2)),
    totalInterest: Number(totalInterest.toFixed(2))
  };
}
