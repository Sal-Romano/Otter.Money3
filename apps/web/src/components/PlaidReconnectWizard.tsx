import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useAccounts } from '../hooks/useAccounts';
import { usePlaidReconnect } from '../hooks/usePlaidLink';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { ImportPreviewRow } from '@otter-money/shared';

interface PlaidReconnectWizardProps {
  isOpen: boolean;
  previewData: {
    tempItemId: string;
    institutionName: string | null;
    plaidAccounts: Array<{
      plaidAccountId: string;
      name: string;
      officialName: string | null;
      type: string;
      subtype: string | null;
      currentBalance: number;
      availableBalance: number | null;
      suggestedMatch: {
        accountId: string;
        accountName: string;
        matchReason: string;
      } | null;
      transactionPreview: {
        totalRows: number;
        summary: { create: number; update: number; skip: number; unchanged: number };
        rows: ImportPreviewRow[];
      };
    }>;
  } | null;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'mapping' | 'preview' | 'executing' | 'results';

interface AccountMapping {
  plaidAccountId: string;
  existingAccountId: string | null; // null = create new
}

export function PlaidReconnectWizard({
  isOpen,
  previewData,
  onClose,
  onComplete,
}: PlaidReconnectWizardProps) {
  const [step, setStep] = useState<Step>('mapping');
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [selectedPlaidAccount, setSelectedPlaidAccount] = useState<string | null>(null);
  const [skippedTransactions, setSkippedTransactions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'create' | 'update' | 'unchanged' | 'skip'>('create');
  const [result, setResult] = useState<{
    accountsLinked: number;
    accountsCreated: number;
    transactionsAdded: number;
    transactionsSkipped: number;
  } | null>(null);

  const { data: accounts } = useAccounts();
  const plaidReconnect = usePlaidReconnect();

  useBodyScrollLock(isOpen);

  // Initialize mappings from suggested matches when preview data arrives
  useEffect(() => {
    if (previewData) {
      setMappings(
        previewData.plaidAccounts.map((pa) => ({
          plaidAccountId: pa.plaidAccountId,
          existingAccountId: pa.suggestedMatch?.accountId || null,
        }))
      );
      // Auto-select first account for preview
      if (previewData.plaidAccounts.length > 0) {
        setSelectedPlaidAccount(previewData.plaidAccounts[0].plaidAccountId);
      }
    }
  }, [previewData]);

  const handleClose = useCallback(() => {
    setStep('mapping');
    setMappings([]);
    setSelectedPlaidAccount(null);
    setSkippedTransactions(new Set());
    setActiveTab('create');
    setResult(null);
    onClose();
  }, [onClose]);

  const updateMapping = useCallback((plaidAccountId: string, existingAccountId: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.plaidAccountId === plaidAccountId ? { ...m, existingAccountId } : m
      )
    );
  }, []);

  const toggleTransactionSkip = useCallback((externalId: string) => {
    setSkippedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        next.add(externalId);
      }
      return next;
    });
  }, []);

  const handleExecute = useCallback(async () => {
    if (!previewData) return;
    setStep('executing');
    try {
      const res = await plaidReconnect.execute({
        tempItemId: previewData.tempItemId,
        mappings: mappings.map((m) => ({
          plaidAccountId: m.plaidAccountId,
          existingAccountId: m.existingAccountId,
          skipTransactionIds: Array.from(skippedTransactions),
        })),
      });
      setResult(res);
      setStep('results');
      toast.success(
        `Connected! ${res.accountsLinked + res.accountsCreated} account${res.accountsLinked + res.accountsCreated !== 1 ? 's' : ''}, ${res.transactionsAdded} transactions synced.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect. Please try again.');
      setStep('preview');
    }
  }, [previewData, mappings, skippedTransactions, plaidReconnect]);

  if (!isOpen || !previewData) return null;

  const selectedPreview = previewData.plaidAccounts.find(
    (pa) => pa.plaidAccountId === selectedPlaidAccount
  );

  const hasExistingAccountMatch = mappings.some((m) => m.existingAccountId !== null);

  // Manual accounts available for mapping (exclude already-mapped ones)
  const mappedAccountIds = new Set(
    mappings.filter((m) => m.existingAccountId).map((m) => m.existingAccountId!)
  );
  const availableAccounts = (accounts || []).filter(
    (a) => a.connectionType === 'MANUAL'
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatAmount = (amount: number) => {
    const formatted = formatCurrency(amount);
    return amount < 0 ? `-${formatted}` : formatted;
  };

  // Get adjusted counts for the selected account's preview
  const getAdjustedCounts = () => {
    if (!selectedPreview) return { create: 0, update: 0, skip: 0, unchanged: 0 };
    let create = 0;
    let update = 0;
    let skip = 0;
    let unchanged = 0;
    for (const row of selectedPreview.transactionPreview.rows) {
      if (row.action === 'skip' || skippedTransactions.has(String(row.rowNumber))) {
        skip++;
      } else if (row.action === 'create') {
        create++;
      } else if (row.action === 'unchanged') {
        unchanged++;
      } else {
        update++;
      }
    }
    return { create, update, skip, unchanged };
  };


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'mapping' && `Connect ${previewData.institutionName || 'Bank'}`}
              {step === 'preview' && 'Transaction Preview'}
              {step === 'executing' && 'Connecting...'}
              {step === 'results' && 'Connected!'}
            </h2>
            {step === 'mapping' && (
              <p className="text-xs text-gray-500 mt-0.5">
                {previewData.plaidAccounts.length} account{previewData.plaidAccounts.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Step 1: Account Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                We found existing accounts that might match. Link them to keep your transaction history, or create new accounts.
              </p>

              {previewData.plaidAccounts.map((pa) => {
                const mapping = mappings.find((m) => m.plaidAccountId === pa.plaidAccountId);
                const isLinked = mapping?.existingAccountId !== null;

                return (
                  <div
                    key={pa.plaidAccountId}
                    className={clsx(
                      'rounded-lg border p-3 space-y-2',
                      isLinked ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                    )}
                  >
                    {/* Plaid account info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pa.name}</p>
                        <p className="text-xs text-gray-500">
                          {pa.type} · {formatCurrency(pa.currentBalance)}
                          {pa.transactionPreview.totalRows > 0 && (
                            <> · {pa.transactionPreview.totalRows} transactions</>
                          )}
                        </p>
                      </div>
                      {isLinked && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Linked
                        </span>
                      )}
                    </div>

                    {/* Match suggestion */}
                    {pa.suggestedMatch && (
                      <p className="text-xs text-blue-600">
                        Suggested: {pa.suggestedMatch.accountName} — {pa.suggestedMatch.matchReason}
                      </p>
                    )}

                    {/* Mapping dropdown */}
                    <select
                      value={mapping?.existingAccountId || '__new__'}
                      onChange={(e) =>
                        updateMapping(
                          pa.plaidAccountId,
                          e.target.value === '__new__' ? null : e.target.value
                        )
                      }
                      className="input text-sm"
                    >
                      <option value="__new__">Create new account</option>
                      {availableAccounts.map((a) => (
                        <option
                          key={a.id}
                          value={a.id}
                          disabled={mappedAccountIds.has(a.id) && mapping?.existingAccountId !== a.id}
                        >
                          {a.name}
                          {a.owner ? ` (${a.owner.name})` : ' (Joint)'}
                          {mappedAccountIds.has(a.id) && mapping?.existingAccountId !== a.id
                            ? ' (already linked)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}

              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                {hasExistingAccountMatch ? (
                  <button
                    onClick={() => {
                      setStep('preview');
                      // Set active tab based on what's most relevant
                      const firstPreview = previewData.plaidAccounts[0]?.transactionPreview;
                      if (firstPreview?.summary.create > 0) setActiveTab('create');
                      else if (firstPreview?.summary.update > 0) setActiveTab('update');
                    }}
                    className="btn-primary flex-1"
                  >
                    Review Transactions
                  </button>
                ) : (
                  <button onClick={handleExecute} className="btn-primary flex-1">
                    Connect {previewData.plaidAccounts.length} Account{previewData.plaidAccounts.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Transaction Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Account selector tabs (when multiple accounts) */}
              {previewData.plaidAccounts.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {previewData.plaidAccounts.map((pa) => {
                    const mapping = mappings.find((m) => m.plaidAccountId === pa.plaidAccountId);
                    const isLinked = mapping?.existingAccountId !== null;
                    return (
                      <button
                        key={pa.plaidAccountId}
                        onClick={() => setSelectedPlaidAccount(pa.plaidAccountId)}
                        className={clsx(
                          'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
                          selectedPlaidAccount === pa.plaidAccountId
                            ? 'border-primary bg-primary text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {pa.name}
                        {isLinked && (
                          <span className="ml-1 text-[10px] opacity-75">linked</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPreview && (
                <>
                  {/* Match info */}
                  {mappings.find((m) => m.plaidAccountId === selectedPlaidAccount)?.existingAccountId && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-700">
                      Linking to existing account: <span className="font-medium">
                        {accounts?.find(
                          (a) => a.id === mappings.find((m) => m.plaidAccountId === selectedPlaidAccount)?.existingAccountId
                        )?.name}
                      </span>
                    </div>
                  )}

                  {/* Summary cards */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-2.5 text-center">
                      <div className="text-xl font-bold text-green-700">{getAdjustedCounts().create}</div>
                      <div className="text-[11px] text-green-600 font-medium">New</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-center">
                      <div className="text-xl font-bold text-blue-700">{getAdjustedCounts().update}</div>
                      <div className="text-[11px] text-blue-600 font-medium">Updates</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-center">
                      <div className="text-xl font-bold text-gray-500">{getAdjustedCounts().unchanged}</div>
                      <div className="text-[11px] text-gray-500 font-medium">Unchanged</div>
                    </div>
                    <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5 text-center">
                      <div className="text-xl font-bold text-orange-700">{getAdjustedCounts().skip}</div>
                      <div className="text-[11px] text-orange-600 font-medium">Skipped</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-200">
                    {(['create', 'update', 'unchanged', 'skip'] as const).map((tab) => {
                      const counts = getAdjustedCounts();
                      const count = counts[tab];
                      const tabConfig = {
                        create: { label: 'New', activeClass: 'border-green-500 text-green-700' },
                        update: { label: 'Updates', activeClass: 'border-blue-500 text-blue-700' },
                        unchanged: { label: 'Unchanged', activeClass: 'border-gray-400 text-gray-600' },
                        skip: { label: 'Skipped', activeClass: 'border-orange-500 text-orange-700' },
                      }[tab];
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={clsx(
                            'flex-1 py-2 text-xs font-medium border-b-2 transition-colors',
                            activeTab === tab
                              ? tabConfig.activeClass
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          )}
                        >
                          {tabConfig.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Transaction rows */}
                  <div className="max-h-[40vh] overflow-y-auto space-y-1">
                    {selectedPreview.transactionPreview.rows
                      .filter((row) => {
                        if (skippedTransactions.has(String(row.rowNumber))) return activeTab === 'skip';
                        return row.action === activeTab;
                      })
                      .map((row) => (
                        <TransactionPreviewRow
                          key={row.rowNumber}
                          row={row}
                          isUserSkipped={skippedTransactions.has(String(row.rowNumber))}
                          onToggleSkip={() => toggleTransactionSkip(String(row.rowNumber))}
                          formatAmount={formatAmount}
                        />
                      ))}

                    {selectedPreview.transactionPreview.rows.filter((r) => {
                      if (skippedTransactions.has(String(r.rowNumber))) return activeTab === 'skip';
                      return r.action === activeTab;
                    }).length === 0 && (
                      <p className="text-center text-sm text-gray-400 py-8">
                        No {activeTab === 'create' ? 'new' : activeTab === 'update' ? 'updated' : activeTab === 'unchanged' ? 'unchanged' : 'skipped'} transactions
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('mapping')} className="btn-secondary flex-1">
                  Back
                </button>
                <button onClick={handleExecute} className="btn-primary flex-1">
                  Connect & Sync
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Executing */}
          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700">Connecting accounts and syncing transactions...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && result && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>

              <h3 className="text-center text-lg font-semibold text-gray-900">
                {previewData.institutionName || 'Bank'} Connected
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {result.accountsLinked > 0 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700">{result.accountsLinked}</div>
                    <div className="text-xs text-blue-600">Linked</div>
                  </div>
                )}
                {result.accountsCreated > 0 && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{result.accountsCreated}</div>
                    <div className="text-xs text-green-600">New Accounts</div>
                  </div>
                )}
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{result.transactionsAdded}</div>
                  <div className="text-xs text-purple-600">Transactions</div>
                </div>
                {result.transactionsSkipped > 0 && (
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                    <div className="text-2xl font-bold text-orange-700">{result.transactionsSkipped}</div>
                    <div className="text-xs text-orange-600">Skipped</div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  handleClose();
                  onComplete();
                }}
                className="btn-primary w-full"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent for transaction preview rows (reuses import wizard pattern)
function TransactionPreviewRow({
  row,
  isUserSkipped,
  onToggleSkip,
  formatAmount,
}: {
  row: ImportPreviewRow;
  isUserSkipped: boolean;
  onToggleSkip: () => void;
  formatAmount: (amount: number) => string;
}) {
  const isSkipped = row.action === 'skip';
  const isUnchanged = row.action === 'unchanged';
  const canToggle = !isSkipped && !isUnchanged;

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 text-sm',
        isSkipped
          ? 'border-orange-200 bg-orange-50/50'
          : isUnchanged
          ? 'border-gray-200 bg-gray-50/50'
          : isUserSkipped
          ? 'border-gray-200 bg-gray-50 opacity-50'
          : row.action === 'create'
          ? 'border-green-200 bg-green-50/30'
          : 'border-blue-200 bg-blue-50/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('font-medium truncate', isUnchanged ? 'text-gray-500' : 'text-gray-900')}>
              {row.parsed.description || '(no description)'}
            </span>
            {row.matchConfidence !== null && row.matchConfidence !== undefined && row.matchConfidence < 1.0 && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {Math.round(row.matchConfidence * 100)}% match
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span>{row.parsed.date}</span>
            {row.parsed.merchant && (
              <>
                <span>&middot;</span>
                <span>{row.parsed.merchant}</span>
              </>
            )}
            {row.parsed.category && (
              <>
                <span>&middot;</span>
                <span>{row.parsed.category}</span>
              </>
            )}
          </div>
          {isUnchanged && row.matchedTransaction && (
            <p className="text-xs text-gray-400 mt-1">
              Already exists — no changes needed
            </p>
          )}
          {row.action === 'update' && row.matchedTransaction && (
            <p className="text-xs text-blue-600 mt-1">
              Matches: "{row.matchedTransaction.description}"
            </p>
          )}
          {row.action === 'update' && row.changes && row.changes.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {row.changes.map((change, i) => (
                <div key={i} className="text-xs flex items-center gap-1">
                  <span className="font-medium text-blue-700">{change.field}:</span>
                  <span className="text-gray-400 line-through truncate max-w-[120px]">{change.from}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-blue-700 truncate max-w-[120px]">{change.to}</span>
                </div>
              ))}
            </div>
          )}
          {row.warnings.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {row.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600">{w}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={clsx(
              'font-medium',
              isUnchanged
                ? 'text-gray-400'
                : row.parsed.amount < 0
                ? 'text-gray-700'
                : 'text-green-600'
            )}
          >
            {formatAmount(row.parsed.amount)}
          </span>
          {canToggle && (
            <button
              onClick={onToggleSkip}
              className={clsx(
                'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                isUserSkipped
                  ? 'border-gray-300 bg-white'
                  : 'border-primary bg-primary text-white'
              )}
              title={isUserSkipped ? 'Include in sync' : 'Exclude from sync'}
            >
              {!isUserSkipped && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaidReconnectWizard;
