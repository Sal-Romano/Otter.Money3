import { clsx } from 'clsx';
import type { AccountType } from '@otter-money/shared';

interface AccountIconProps {
  type: AccountType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const bgColors: Record<AccountType, string> = {
  CHECKING: 'bg-blue-100 text-blue-600',
  SAVINGS: 'bg-green-100 text-green-600',
  CREDIT: 'bg-orange-100 text-orange-600',
  INVESTMENT: 'bg-purple-100 text-purple-600',
  LOAN: 'bg-red-100 text-red-600',
  MORTGAGE: 'bg-amber-100 text-amber-600',
  ASSET: 'bg-teal-100 text-teal-600',
  OTHER: 'bg-gray-100 text-gray-600',
};

export function AccountIcon({ type, className, size = 'md' }: AccountIconProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-lg p-2',
        bgColors[type],
        className
      )}
    >
      {getIcon(type, sizeClasses[size])}
    </div>
  );
}

function getIcon(type: AccountType, className: string) {
  switch (type) {
    case 'CHECKING':
      return <WalletIcon className={className} />;
    case 'SAVINGS':
      return <PiggyBankIcon className={className} />;
    case 'CREDIT':
      return <CreditCardIcon className={className} />;
    case 'INVESTMENT':
      return <TrendingUpIcon className={className} />;
    case 'LOAN':
      return <BankIcon className={className} />;
    case 'MORTGAGE':
      return <HomeIcon className={className} />;
    case 'ASSET':
      return <CarIcon className={className} />;
    default:
      return <CircleIcon className={className} />;
  }
}

// Icon components
function WalletIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function PiggyBankIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CreditCardIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1M6 19h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function BankIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3"
      />
    </svg>
  );
}

function HomeIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function CarIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9l-2.2-4.8c-.3-.6-.9-1-1.6-1.1L12 5l-4.7.2c-.7.1-1.3.5-1.6 1.1l-2.2 4.8C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2m14 0a2 2 0 11-4 0m4 0a2 2 0 10-4 0M9 17a2 2 0 11-4 0m4 0a2 2 0 10-4 0"
      />
    </svg>
  );
}

function CircleIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

// Export account type labels for use elsewhere
export const accountTypeLabels: Record<AccountType, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT: 'Credit Card',
  INVESTMENT: 'Investment',
  LOAN: 'Loan',
  MORTGAGE: 'Mortgage',
  ASSET: 'Asset',
  OTHER: 'Other',
};
