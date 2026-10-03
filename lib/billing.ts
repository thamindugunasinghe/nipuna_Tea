// Shared billing helpers. Pure functions only (no database), so both the
// pages (preview before paying) and the API routes (what is saved) use the same maths.

// Round to rupees and cents (2 decimals)
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Read a numeric setting; a real 0 stays 0, only missing/invalid uses the default
export function numSetting(value: unknown, fallback: number) {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export interface InstantRates {
  transportCostPerKilo: number;
  stampCostPerKilo: number;
  otherDeductionPct: number;
}

// Instant cash (non-regular customer) payment for one collection
export function instantBreakdown(netKilos: number, isLorry: boolean, pricePerKilo: number, rates: InstantRates) {
  const grossPay = round2(netKilos * pricePerKilo);
  const transportTotal = isLorry ? round2(netKilos * rates.transportCostPerKilo) : 0;
  const stampTotal = round2(netKilos * rates.stampCostPerKilo);
  const otherTotal = round2(grossPay * (rates.otherDeductionPct / 100));
  const finalPayment = round2(Math.max(0, grossPay - transportTotal - stampTotal - otherTotal));
  return { grossPay, transportTotal, stampTotal, otherTotal, finalPayment };
}
