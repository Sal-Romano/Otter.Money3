// Brand colors
export const COLORS = {
  primary: '#9F6FBA',
  primaryLight: '#B88FCE',
  primaryDark: '#7A5090',
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

// Account type labels and icons
export const ACCOUNT_TYPE_CONFIG = {
  CHECKING: { label: 'Checking', icon: 'wallet' },
  SAVINGS: { label: 'Savings', icon: 'piggy-bank' },
  CREDIT: { label: 'Credit Card', icon: 'credit-card' },
  INVESTMENT: { label: 'Investment', icon: 'trending-up' },
  LOAN: { label: 'Loan', icon: 'landmark' },
  MORTGAGE: { label: 'Mortgage', icon: 'home' },
  ASSET: { label: 'Asset', icon: 'car' },
  OTHER: { label: 'Other', icon: 'circle' },
} as const;

// Default categories (legacy flat structure)
export const DEFAULT_CATEGORIES = {
  INCOME: [
    { name: 'Salary', icon: '💼' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Interest', icon: '📈' },
    { name: 'Dividends', icon: '📊' },
    { name: 'Other Income', icon: '💰' },
  ],
  EXPENSE: [
    { name: 'Housing', icon: '🏠' },
    { name: 'Transportation', icon: '🚗' },
    { name: 'Groceries', icon: '🛒' },
    { name: 'Dining Out', icon: '🍴' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Healthcare', icon: '❤️' },
    { name: 'Utilities', icon: '⚡' },
    { name: 'Subscriptions', icon: '🔄' },
    { name: 'Travel', icon: '✈️' },
    { name: 'Education', icon: '📚' },
    { name: 'Personal Care', icon: '💇' },
    { name: 'Gifts', icon: '🎁' },
    { name: 'Insurance', icon: '🛡️' },
    { name: 'Taxes', icon: '📄' },
    { name: 'Other Expense', icon: '➖' },
  ],
  TRANSFER: [
    { name: 'Transfer', icon: '↔️' },
    { name: 'Credit Card Payment', icon: '💳' },
  ],
} as const;

// Hierarchical default categories with Lucide icon names
// Max 3 levels: parent > child > grandchild
export interface HierarchicalCategory {
  name: string;
  icon: string; // Lucide icon name (kebab-case)
  color?: string;
  children?: HierarchicalCategory[];
}

export const DEFAULT_CATEGORIES_HIERARCHICAL: Record<'EXPENSE' | 'INCOME' | 'TRANSFER', HierarchicalCategory[]> = {
  EXPENSE: [
    {
      name: 'Usual Expenses',
      icon: 'receipt',
      color: '#9F6FBA',
      children: [
        { name: 'Assets', icon: 'gem' },
        { name: 'Automotive', icon: 'car' },
        { name: 'Bills', icon: 'file-text' },
        { name: 'Clothing', icon: 'shirt' },
        { name: 'Entertainment', icon: 'tv' },
        { name: 'Fees', icon: 'badge-dollar-sign' },
        { name: 'Food', icon: 'utensils' },
        { name: 'Gas', icon: 'fuel' },
        { name: 'Gifts', icon: 'gift' },
        { name: 'Groceries', icon: 'shopping-cart' },
        { name: 'Household', icon: 'home' },
        { name: 'Insurance', icon: 'shield' },
        { name: 'Interest', icon: 'percent' },
        { name: 'Medical', icon: 'heart-pulse' },
        { name: 'Rent', icon: 'building' },
        { name: 'Subscriptions', icon: 'repeat' },
        { name: 'Tolls', icon: 'milestone' },
        { name: 'Transportation', icon: 'bus' },
        { name: 'Utilities', icon: 'plug' },
      ],
    },
    {
      name: 'Travel',
      icon: 'plane',
      color: '#3B82F6',
      children: [
        { name: 'Experiences', icon: 'camera' },
        { name: 'Flights', icon: 'plane-takeoff' },
        { name: 'Food', icon: 'utensils-crossed' },
        { name: 'Hotels', icon: 'bed' },
        { name: 'Misc', icon: 'map' },
        { name: 'Souvenirs', icon: 'landmark' },
        { name: 'Transport', icon: 'train' },
      ],
    },
    {
      name: 'Business Expenses',
      icon: 'briefcase',
      color: '#10B981',
      children: [
        { name: 'Materials', icon: 'package' },
        { name: 'Software', icon: 'laptop' },
        { name: 'Phone', icon: 'smartphone' },
        { name: 'Fees', icon: 'receipt' },
        { name: 'Labor', icon: 'users' },
      ],
    },
  ],
  TRANSFER: [
    {
      name: 'Money Movement',
      icon: 'arrow-left-right',
      color: '#6B7280',
      children: [
        { name: 'CC Adjustment', icon: 'credit-card' },
        { name: 'CC Payment', icon: 'wallet' },
        { name: 'Expensed Purchase', icon: 'receipt' },
        { name: 'Account Transfer', icon: 'arrow-right-left' },
      ],
    },
  ],
  INCOME: [
    {
      name: 'Income',
      icon: 'banknote',
      color: '#10B981',
      children: [
        { name: '1099', icon: 'file-text' },
        { name: 'W2', icon: 'building-2' },
        { name: 'Reimbursement', icon: 'receipt' },
        { name: 'Misc', icon: 'coins' },
        { name: 'Interest', icon: 'percent' },
        { name: 'Stocks', icon: 'trending-up' },
        { name: 'Crypto', icon: 'bitcoin' },
        { name: 'Dividends', icon: 'pie-chart' },
      ],
    },
    {
      name: 'Savings & Investments',
      icon: 'piggy-bank',
      color: '#8B5CF6',
      children: [
        { name: 'Savings', icon: 'landmark' },
        { name: 'Investments', icon: 'line-chart' },
      ],
    },
  ],
};

// API error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PLAID_ERROR: 'PLAID_ERROR',
  SIMPLEFIN_ERROR: 'SIMPLEFIN_ERROR',
} as const;

// Supported currencies
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Date formats
export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayShort: 'MMM d',
  api: 'yyyy-MM-dd',
  budgetPeriod: 'yyyy-MM',
} as const;
