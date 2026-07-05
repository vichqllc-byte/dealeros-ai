import { describe, expect, it } from 'vitest';
import { classifyIntent } from '@/lib/copilot/intent-classifier';

describe('classifyIntent', () => {
  it('classifies acquisition questions', () => {
    expect(classifyIntent('Should I buy this VIN 1HGCM82633A004352?').intent).toBe('ACQUISITION_RECOMMENDATION');
  });

  it('classifies pricing questions', () => {
    expect(classifyIntent('What price should I list this at?').intent).toBe('PRICING_RECOMMENDATION');
  });

  it('classifies inventory questions', () => {
    expect(classifyIntent('How many vehicles are in stock?').intent).toBe('INVENTORY_QUESTION');
  });

  it('classifies profit optimization questions', () => {
    expect(classifyIntent('How can I improve my profit margin?').intent).toBe('PROFIT_OPTIMIZATION');
  });

  it('classifies market analysis questions', () => {
    expect(classifyIntent('What is the market demand trend for trucks?').intent).toBe('MARKET_ANALYSIS');
  });

  it('classifies sales coaching questions', () => {
    expect(classifyIntent('How is my sales team performing?').intent).toBe('SALES_COACHING');
  });

  it('classifies KPI summary questions', () => {
    expect(classifyIntent('Give me a KPI dashboard summary').intent).toBe('KPI_SUMMARY');
  });

  it('extracts a VIN from the question text when present', () => {
    const result = classifyIntent('Tell me the recall history for 1HGCM82633A004352');
    expect(result.vin).toBe('1HGCM82633A004352');
    expect(result.intent).toBe('VIN_QUESTION');
  });

  it('falls back to VIN_QUESTION when a VIN is present with no other keyword match', () => {
    expect(classifyIntent('1HGCM82633A004352').intent).toBe('VIN_QUESTION');
  });

  it('returns UNKNOWN for unrelated text with no VIN', () => {
    expect(classifyIntent('What is the weather today?').intent).toBe('UNKNOWN');
  });
});
