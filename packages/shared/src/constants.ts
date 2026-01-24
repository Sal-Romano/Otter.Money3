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

// Default categories
export const DEFAULT_CATEGORIES = {
  INCOME: [
    { name: 'Salary', icon: 'briefcase' },
    { name: 'Freelance', icon: 'laptop' },
    { name: 'Interest', icon: 'percent' },
    { name: 'Dividends', icon: 'trending-up' },
    { name: 'Other Income', icon: 'plus-circle' },
  ],
  EXPENSE: [
    { name: 'Housing', icon: 'home' },
    { name: 'Transportation', icon: 'car' },
    { name: 'Groceries', icon: 'shopping-cart' },
    { name: 'Dining Out', icon: 'utensils' },
    { name: 'Shopping', icon: 'shopping-bag' },
    { name: 'Entertainment', icon: 'film' },
    { name: 'Healthcare', icon: 'heart' },
    { name: 'Utilities', icon: 'zap' },
    { name: 'Subscriptions', icon: 'repeat' },
    { name: 'Travel', icon: 'plane' },
    { name: 'Education', icon: 'book' },
    { name: 'Personal Care', icon: 'smile' },
    { name: 'Gifts', icon: 'gift' },
    { name: 'Insurance', icon: 'shield' },
    { name: 'Taxes', icon: 'file-text' },
    { name: 'Other Expense', icon: 'minus-circle' },
  ],
  TRANSFER: [
    { name: 'Transfer', icon: 'arrow-right-left' },
    { name: 'Credit Card Payment', icon: 'credit-card' },
  ],
} as const;

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
