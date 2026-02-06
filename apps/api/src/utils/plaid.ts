import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as 'sandbox' | 'development' | 'production' || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);

/**
 * Converts a Plaid transaction amount to our system's sign convention.
 *
 * Our system: negative = expense/outflow, positive = income/inflow
 * Plaid standard: positive = outflow, negative = inflow
 *
 * However, some institutions (like PenFed) return ALL transfers with the same sign
 * and rely on the description to indicate direction (DEBIT vs CREDIT).
 *
 * This function detects these cases and corrects the sign accordingly.
 */
export function normalizeTransactionAmount(
  plaidAmount: number,
  description: string,
  category?: { primary: string; detailed: string } | null
): number {
  const descUpper = description.toUpperCase();
  const isTransfer = category?.primary === 'TRANSFER_IN' ||
                     category?.primary === 'TRANSFER_OUT' ||
                     descUpper.includes('TRANSFER');

  // For transfers, check if description indicates explicit direction
  if (isTransfer) {
    // Check for explicit DEBIT indicator (money leaving = expense = negative in our system)
    if (descUpper.includes('DEBIT') && !descUpper.includes('CREDIT')) {
      // Ensure result is negative (expense)
      return -Math.abs(plaidAmount);
    }

    // Check for explicit CREDIT indicator (money entering = income = positive in our system)
    if (descUpper.includes('CREDIT') && !descUpper.includes('DEBIT')) {
      // Ensure result is positive (income)
      return Math.abs(plaidAmount);
    }
  }

  // Standard Plaid convention: negate the amount
  // Plaid: positive = outflow → Our system: negative = expense
  // Plaid: negative = inflow → Our system: positive = income
  return -plaidAmount;
}

// Utility function to map Plaid account types to our AccountType enum
export function mapPlaidAccountType(plaidType: string, plaidSubtype: string | null): string {
  const type = plaidType.toLowerCase();

  switch (type) {
    case 'depository':
      if (plaidSubtype === 'checking') return 'CHECKING';
      if (plaidSubtype === 'savings') return 'SAVINGS';
      return 'CHECKING';

    case 'credit':
      return 'CREDIT';

    case 'loan':
      if (plaidSubtype === 'mortgage') return 'MORTGAGE';
      return 'LOAN';

    case 'investment':
      return 'INVESTMENT';

    default:
      return 'OTHER';
  }
}
