/**
 * Maps Plaid categories to our system categories
 * Plaid provides categories in a hierarchical format like:
 * - "Food and Drink" -> "Restaurants"
 * - "Travel" -> "Airlines and Aviation Services"
 */

const CATEGORY_MAP: Record<string, string> = {
  // Food & Drink
  'Food and Drink': 'Dining Out',
  'Restaurants': 'Dining Out',
  'Fast Food': 'Dining Out',
  'Coffee Shop': 'Dining Out',
  'Bar': 'Dining Out',
  'Groceries': 'Groceries',

  // Shopping
  'Shops': 'Shopping',
  'Clothing and Accessories': 'Shopping',
  'Electronics': 'Shopping',
  'General Merchandise': 'Shopping',
  'Sporting Goods': 'Shopping',
  'Bookstores and Newsstands': 'Shopping',
  'Home Improvement': 'Shopping',

  // Transportation
  'Transportation': 'Transportation',
  'Gas Stations': 'Transportation',
  'Parking': 'Transportation',
  'Public Transportation Services': 'Transportation',
  'Taxi': 'Transportation',
  'Ride Share': 'Transportation',
  'Auto': 'Transportation',
  'Automotive': 'Transportation',

  // Travel
  'Travel': 'Travel',
  'Airlines and Aviation Services': 'Travel',
  'Lodging': 'Travel',
  'Car and Limousine Services': 'Travel',
  'Vacation Rentals': 'Travel',

  // Entertainment
  'Recreation': 'Entertainment',
  'Entertainment': 'Entertainment',
  'Gyms and Fitness Centers': 'Entertainment',
  'Sporting Events': 'Entertainment',
  'Music': 'Entertainment',
  'Movie Theaters': 'Entertainment',
  'Video Games': 'Entertainment',

  // Healthcare
  'Healthcare': 'Healthcare',
  'Pharmacies': 'Healthcare',
  'Medical': 'Healthcare',
  'Dentists': 'Healthcare',

  // Utilities
  'Utilities': 'Utilities',
  'Phone': 'Utilities',
  'Internet': 'Utilities',
  'Cable': 'Utilities',
  'Electric': 'Utilities',
  'Gas': 'Utilities',
  'Water': 'Utilities',

  // Services
  'Services': 'Other Expense',
  'Cable and Satellite Services': 'Subscriptions',
  'Internet Services': 'Subscriptions',
  'Telecommunication Services': 'Utilities',
  'Streaming Services': 'Subscriptions',

  // Personal Care
  'Personal Care': 'Personal Care',
  'Hair and Beauty': 'Personal Care',
  'Salon and Spa': 'Personal Care',

  // Insurance
  'Insurance': 'Insurance',

  // Education
  'Education': 'Education',

  // Gifts & Donations
  'Gifts': 'Gifts',
  'Gifts and Donations': 'Gifts',

  // Transfer
  'Transfer': 'Transfer',
  'Credit Card': 'Credit Card Payment',
  'Payment': 'Transfer',
  'Deposit': 'Transfer',

  // Income
  'Income': 'Other Income',
  'Payroll': 'Salary',
  'Interest Earned': 'Interest',
  'Dividends': 'Dividends',

  // Taxes
  'Tax': 'Taxes',
  'Taxes': 'Taxes',
  'Federal Tax': 'Taxes',
  'State Tax': 'Taxes',

  // Home
  'Home': 'Housing',
  'Rent': 'Housing',
  'Mortgage': 'Housing',
};

/**
 * Get our system category name from Plaid category
 * Tries to match against the most specific category first, then falls back to less specific
 */
export function mapPlaidCategory(plaidCategories: string[] | null): string | null {
  if (!plaidCategories || plaidCategories.length === 0) {
    return null;
  }

  // Try matching from most specific to least specific
  for (let i = plaidCategories.length - 1; i >= 0; i--) {
    const category = plaidCategories[i];
    if (CATEGORY_MAP[category]) {
      return CATEGORY_MAP[category];
    }
  }

  // If no match found, return null (will be uncategorized)
  return null;
}

/**
 * Find the category ID for a given category name in a household
 * Returns null if not found
 */
export async function getCategoryIdByName(
  prisma: any,
  householdId: string,
  categoryName: string
): Promise<string | null> {
  // First try household-specific categories
  let category = await prisma.category.findFirst({
    where: {
      householdId,
      name: categoryName,
    },
    select: { id: true },
  });

  // Fall back to system categories
  if (!category) {
    category = await prisma.category.findFirst({
      where: {
        householdId: null,
        isSystem: true,
        name: categoryName,
      },
      select: { id: true },
    });
  }

  return category?.id || null;
}
