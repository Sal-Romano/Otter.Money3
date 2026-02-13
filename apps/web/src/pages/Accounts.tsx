import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useAccounts, useAccountSummary } from '../hooks/useAccounts';
import { AccountIcon, accountTypeLabels } from '../components/AccountIcon';
import { AccountModal } from '../components/AccountModal';
import { usePlaidLinkConnect, usePlaidItems, usePlaidSync } from '../hooks/usePlaidLink';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { AccountWithOwner, AccountType } from '@otter-money/shared';

// Group accounts by type
function groupAccountsByType(accounts: AccountWithOwner[]) {
  const groups: Record<string, AccountWithOwner[]> = {};

  for (const account of accounts) {
    if (account.isHidden) continue;

    const type = account.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
  }

  return groups;
}

// Order of account types for display
const typeOrder: AccountType[] = [
  'CHECKING',
  'SAVINGS',
  'CREDIT',
  'INVESTMENT',
  'LOAN',
  'MORTGAGE',
  'ASSET',
  'OTHER',
];

export default function Accounts() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();
  const { data: summary } = useAccountSummary();
  const [selectedAccount, setSelectedAccount] = useState<AccountWithOwner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPlaidSuccess, setShowPlaidSuccess] = useState(false);
  const [plaidSuccessMessage, setPlaidSuccessMessage] = useState('');
  const [showBankConnections, setShowBankConnections] = useState(false);

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLinkConnect(
    (data) => {
      setPlaidSuccessMessage(
        `Successfully connected ${data.institutionName || 'your bank'}! Added ${data.accountsCreated} account${data.accountsCreated !== 1 ? 's' : ''}.`
      );
      setShowPlaidSuccess(true);
      refetch();
      plaidItems.fetchItems();
      setTimeout(() => setShowPlaidSuccess(false), 5000);
    }
  );

  const plaidItems = usePlaidItems();

  useEffect(() => {
    if (showBankConnections) {
      plaidItems.fetchItems();
    }
  }, [showBankConnections]);

  const groupedAccounts = useMemo(() => {
    if (!accounts) return {};
    return groupAccountsByType(accounts);
  }, [accounts]);

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setIsModalOpen(true);
  };

  const handleEditAccount = (account: AccountWithOwner) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-error-50 p-4 text-error-600">
          Failed to load accounts. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Success Message */}
      {showPlaidSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
          <div className="flex items-start">
            <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{plaidSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your household's financial accounts
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={openPlaidLink}
            disabled={!plaidReady}
            className="btn-primary flex-1"
          >
            <BankIcon className="mr-1 h-4 w-4" />
            Connect Bank
          </button>
          <button onClick={handleAddAccount} className="btn-outline flex-1">
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Manually
          </button>
        </div>

        {/* Manage Connections Link */}
        {accounts && accounts.some(a => a.connectionType === 'PLAID') && (
          <button
            onClick={() => setShowBankConnections(true)}
            className="mt-3 text-sm text-primary hover:text-primary-600 font-medium"
          >
            Manage Bank Connections
          </button>
        )}
      </header>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Assets</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(summary.totalAssets)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Liabilities</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(summary.totalLiabilities)}
            </p>
          </div>
          <div className="card bg-primary text-white">
            <p className="text-xs opacity-80">Net Worth</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.netWorth)}
            </p>
          </div>
        </div>
      )}

      {/* Account Groups */}
      {accounts && accounts.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <WalletIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No accounts yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Connect your bank or add an account manually to start tracking your household finances.
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button onClick={openPlaidLink} disabled={!plaidReady} className="btn-primary">
              <BankIcon className="mr-1 h-4 w-4" />
              Connect Bank
            </button>
            <button onClick={handleAddAccount} className="btn-outline">
              <PlusIcon className="mr-1 h-4 w-4" />
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {typeOrder.map((type) => {
            const typeAccounts = groupedAccounts[type];
            if (!typeAccounts || typeAccounts.length === 0) return null;

            return (
              <section key={type}>
                <h2 className="mb-3 text-sm font-medium text-gray-500">
                  {accountTypeLabels[type]}
                </h2>
                <div className="space-y-2">
                  {typeAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onClick={() => handleEditAccount(account)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      <AccountModal
        account={selectedAccount}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Bank Connections Modal */}
      {showBankConnections && (
        <BankConnectionsModal
          items={plaidItems.items}
          isLoading={plaidItems.isLoading}
          onRefresh={refetch}
          onDisconnect={async (itemId, institutionName) => {
            // Get accounts for this item to show count
            const itemAccounts = accounts?.filter(a => a.plaidItemId === itemId) || [];
            const accountCount = itemAccounts.length;

            const message = `Are you sure you want to disconnect ${institutionName || 'this bank'}?\n\n` +
              `This will permanently remove:\n` +
              `• ${accountCount} account${accountCount !== 1 ? 's' : ''}\n` +
              `• All associated transactions\n\n` +
              `This action cannot be undone.`;

            if (confirm(message)) {
              try {
                const result = await plaidItems.removeItem(itemId);
                refetch();

                // Show success message with counts
                if (result) {
                  toast.success(
                    `Disconnected! Removed ${result.accountsDeleted} account${result.accountsDeleted !== 1 ? 's' : ''} and ${result.transactionsDeleted} transaction${result.transactionsDeleted !== 1 ? 's' : ''}.`
                  );
                }
              } catch (err) {
                toast.error('Failed to disconnect. Please try again.');
              }
            }
          }}
          onClose={() => setShowBankConnections(false)}
        />
      )}
    </div>
  );
}

interface BankConnectionsModalProps {
  items: Array<{ itemId: string; institutionName?: string; createdAt: string }>;
  isLoading: boolean;
  onRefresh: () => void;
  onDisconnect: (itemId: string, institutionName?: string) => Promise<void>;
  onClose: () => void;
}

function BankConnectionsModal({ items, isLoading, onRefresh, onDisconnect, onClose }: BankConnectionsModalProps) {
  const { syncTransactions } = usePlaidSync();
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  useBodyScrollLock(true);

  const handleSync = async (itemId: string, institutionName?: string) => {
    try {
      setSyncingItemId(itemId);
      const result = await syncTransactions(itemId);
      onRefresh();
      toast.success(
        `Synced ${institutionName || 'bank'}! Added: ${result.added}, Modified: ${result.modified}, Removed: ${result.removed}`
      );
    } catch (err) {
      toast.error('Failed to sync transactions. Please try again.');
    } finally {
      setSyncingItemId(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Bank Connections
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-8 text-center text-gray-500">
            Loading connections...
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No bank connections found.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.itemId}
                className="p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <BankIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.institutionName || 'Bank Connection'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Connected {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSync(item.itemId, item.institutionName)}
                    disabled={syncingItemId === item.itemId}
                    className="btn-secondary flex-1 text-sm"
                  >
                    {syncingItemId === item.itemId ? (
                      <>
                        <SpinnerIcon className="mr-1 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshIcon className="mr-1 h-4 w-4" />
                        Refresh
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onDisconnect(item.itemId, item.institutionName)}
                    disabled={syncingItemId === item.itemId}
                    className="text-sm text-error hover:text-error-600 font-medium px-3"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccountCardProps {
  account: AccountWithOwner;
  onClick: () => void;
}

function AccountCard({ account, onClick }: AccountCardProps) {
  const isLiability = ['CREDIT', 'LOAN', 'MORTGAGE'].includes(account.type);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <button
      onClick={onClick}
      className="card w-full text-left transition-shadow hover:shadow-md flex items-center gap-3"
    >
      <AccountIcon type={account.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{account.name}</span>
          {account.connectionType !== 'MANUAL' && (
            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              <LinkIcon className="mr-0.5 h-3 w-3" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">
            {account.owner ? account.owner.name : 'Joint'}
          </span>
          {account.owner && (
            <OwnerBadge name={account.owner.name} />
          )}
        </div>
      </div>

      <div className="text-right">
        <span
          className={`font-semibold ${
            isLiability && account.currentBalance < 0
              ? 'text-error'
              : 'text-gray-900'
          }`}
        >
          {formatCurrency(account.currentBalance)}
        </span>
        {account.availableBalance !== null &&
          account.availableBalance !== account.currentBalance && (
            <p className="text-xs text-gray-500">
              Available: {formatCurrency(account.availableBalance)}
            </p>
          )}
      </div>

      <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}

function OwnerBadge({ name }: { name: string }) {
  // Generate a consistent color based on the name
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <span
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium ${colors[colorIndex]}`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Icon components
function PlusIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

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

function ChevronRightIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LinkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function BankIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
