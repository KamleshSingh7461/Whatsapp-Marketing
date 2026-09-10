export type CurrencyCode = 'USD' | 'EUR' | 'INR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rate: number; // rate against USD
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.0 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.5 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79 },
};

/**
 * Formats a base USD amount to the selected target currency with symbol and localized grouping.
 */
export function formatCurrency(
  amountInUSD: number,
  currency: CurrencyCode = 'USD',
  decimals: number = 0
): string {
  const config = CURRENCIES[currency] || CURRENCIES.USD;
  const converted = amountInUSD * config.rate;

  if (decimals === 0) {
    return `${config.symbol}${Math.round(converted).toLocaleString()}`;
  }
  return `${config.symbol}${converted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formats small micro-rates (e.g., Meta Cloud API per-message rates like $0.0750)
 */
export function formatRate(
  amountInUSD: number,
  currency: CurrencyCode = 'USD',
  decimals: number = 4
): string {
  const config = CURRENCIES[currency] || CURRENCIES.USD;
  const converted = amountInUSD * config.rate;
  return `${config.symbol}${converted.toFixed(decimals)}`;
}

/**
 * Returns the currency symbol for the code
 */
export function getCurrencySymbol(currency: CurrencyCode = 'USD'): string {
  return (CURRENCIES[currency] || CURRENCIES.USD).symbol;
}
