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
