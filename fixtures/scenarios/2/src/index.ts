import { calculateTax } from 'mock-math-lib';

export function computeTotal(subtotal: number): number {
  // In v1.0.0, rate is optional. In v2.0.0, rate and countryCode are required.
  // This will cause a TypeScript compilation error when upgraded!
  return calculateTax(subtotal);
}
