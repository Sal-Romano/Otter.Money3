import { useState } from 'react';
import { toast } from 'sonner';
import { usePlaidSync } from '../hooks/usePlaidLink';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { AccountWithOwner } from '@otter-money/shared';

interface BankConnectionsModalProps {
  items: Array<{ itemId: string; institutionName?: string; createdAt: string }>;
  accounts: AccountWithOwner[];
  isLoading: boolean;
  onRefresh: () => void;
  onDisconnect: (itemId: string) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  onConnectNewBank: () => void;
  plaidConnectLoading: boolean;
  onClose: () => void;
}

export function BankConnectionsModal({
  items,
  accounts,
  isLoading,
  onRefresh,
  onDisconnect,
  onRemove,
  onConnectNewBank,
  plaidConnectLoading,
  onClose,
}: BankConnectionsModalProps) {
  const { syncTransactions } = usePlaidSync();
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [disconnectingItemId, setDisconnectingItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    itemId: string;
    type: 'disconnect' | 'remove';
  } | null>(null);

  useBodyScrollLock(true);

  const handleSync = async (itemId: string, institutionName?: string) => {
    try {
      setSyncingItemId(itemId);
      const result = await syncTransactions(itemId);
      onRefresh();
      toast.success(
        `Synced ${institutionName || 'bank'}! Added: ${result.added}, Modified: ${result.modified}, Removed: ${result.removed}`
      );
    } catch {
      toast.error('Failed to sync transactions. Please try again.');
    } finally {
      setSyncingItemId(null);
    }
  };

  const getItemAccountCount = (itemId: string) => {
    return accounts.filter((a) => a.plaidItemId === itemId).length;
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
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Bank Connections
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Connected Banks */}
        {isLoading ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            Loading connections...
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-gray-400 text-sm">
            No banks connected yet
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => {
              const accountCount = getItemAccountCount(item.itemId);
              const isExpanded = expandedItemId === item.itemId;
              const isConfirming = confirmAction?.itemId === item.itemId;
              const isBusy =
                syncingItemId === item.itemId ||
                disconnectingItemId === item.itemId;
              const isSyncing = syncingItemId === item.itemId;

              return (
                <div
                  key={item.itemId}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Compact row */}
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <BankIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.institutionName || 'Bank Connection'}
                      </p>
                      <p className="text-[11px] text-gray-400 leading-tight">
                        {accountCount > 0 && `${accountCount} acct${accountCount !== 1 ? 's' : ''} · `}
                        {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleSync(item.itemId, item.institutionName)}
                        disabled={isBusy}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 disabled:opacity-40 transition-colors"
                        title="Sync transactions"
                      >
                        {isSyncing ? (
                          <SpinnerIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setExpandedItemId(isExpanded ? null : item.itemId);
                          if (isExpanded) setConfirmAction(null);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? 'text-gray-600 bg-gray-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title="More options"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-3.5 py-2.5">
                      {isConfirming ? (
                        confirmAction.type === 'disconnect' ? (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                            <p className="text-xs text-amber-800 font-medium">Stop syncing?</p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Accounts and transactions will be kept as manual.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={async () => {
                                  setDisconnectingItemId(item.itemId);
                                  await onDisconnect(item.itemId);
                                  setDisconnectingItemId(null);
                                  setConfirmAction(null);
                                  setExpandedItemId(null);
                                }}
                                className="flex-1 text-xs font-medium text-white bg-amber-600 rounded-lg py-1.5 hover:bg-amber-700 disabled:opacity-50"
                              >
                                {disconnectingItemId === item.itemId ? 'Disconnecting...' : 'Disconnect'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                            <p className="text-xs text-red-800 font-medium">Delete everything?</p>
                            <p className="text-[11px] text-red-700 mt-0.5">
                              All accounts and transactions will be permanently deleted.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={async () => {
                                  setDisconnectingItemId(item.itemId);
                                  await onRemove(item.itemId);
                                  setDisconnectingItemId(null);
                                  setConfirmAction(null);
                                  setExpandedItemId(null);
                                }}
                                className="flex-1 text-xs font-medium text-white bg-red-600 rounded-lg py-1.5 hover:bg-red-700 disabled:opacity-50"
                              >
                                {disconnectingItemId === item.itemId ? 'Removing...' : 'Delete All'}
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmAction({ itemId: item.itemId, type: 'disconnect' })}
                            disabled={isBusy}
                            className="flex-1 text-xs font-medium text-amber-700 bg-white border border-gray-200 rounded-lg py-2 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                          >
                            Disconnect
                          </button>
                          <button
                            onClick={() => setConfirmAction({ itemId: item.itemId, type: 'remove' })}
                            disabled={isBusy}
                            className="flex-1 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg py-2 hover:bg-red-50 hover:border-red-200 transition-colors"
                          >
                            Remove All Data
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200 my-4" />

        {/* Add Connection Section */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2.5">
            Add Connection
          </p>
          <div className="space-y-2">
            {/* Connect with Plaid */}
            <button
              onClick={onConnectNewBank}
              disabled={plaidConnectLoading}
              className="w-full flex items-center gap-3 px-3.5 py-3 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary-50/30 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {plaidConnectLoading ? (
                  <SpinnerIcon className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Connect with Plaid
                </p>
                <p className="text-[11px] text-gray-400">
                  Securely link your bank accounts
                </p>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </button>

            {/* SimpleFin Bridge — Coming Soon */}
            <div className="w-full flex items-center gap-3 px-3.5 py-3 border border-gray-200 rounded-xl opacity-40 cursor-not-allowed">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <BridgeIcon className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900">
                    SimpleFin Bridge
                  </p>
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full leading-none">
                    Soon
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Alternative bank connection
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-gray-200">
          <button onClick={onClose} className="btn-secondary w-full text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Icon components
function BankIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
      />
    </svg>
  );
}

function XIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
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

function LinkIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function MoreIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function BridgeIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17h18M5 17V9m14 8V9M3 9c3-4 6-4 9-4s6 0 9 4"
      />
    </svg>
  );
}
