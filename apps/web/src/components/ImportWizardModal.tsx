import { useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useAccounts } from '../hooks/useAccounts';
import { useImportPreview, useImportExecute } from '../hooks/useImportTransactions';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { ImportPreviewRow, ImportPreviewResponse } from '@otter-money/shared';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'account' | 'preview' | 'importing' | 'results';

export function ImportWizardModal({ isOpen, onClose }: ImportWizardModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'create' | 'update' | 'unchanged' | 'skip'>('create');
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    rulesApplied: number;
    skippedDetails: { rowNumber: number; reason: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: accounts } = useAccounts();
  const importPreview = useImportPreview();
  const importExecute = useImportExecute();

  useBodyScrollLock(isOpen);

  const reset = useCallback(() => {
    setStep('upload');
    setCsvContent('');
    setFileName('');
    setFileSize(0);
    setDefaultAccountId('');
    setPreviewData(null);
    setSkippedRows(new Set());
    setActiveTab('create');
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error('Please select a CSV file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10MB)');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target?.result as string);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePreview = useCallback(async () => {
    try {
      setStep('preview');
      const result = await importPreview.mutateAsync({
        csvContent,
        defaultAccountId: defaultAccountId || null,
      });
      setPreviewData(result);

      // Default active tab to whichever has the most actionable rows
      if (result.summary.create > 0) {
        setActiveTab('create');
      } else if (result.summary.update > 0) {
        setActiveTab('update');
      } else if (result.summary.skip > 0) {
        setActiveTab('skip');
      } else {
        setActiveTab('unchanged');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview import');
      setStep('account');
    }
  }, [csvContent, defaultAccountId, importPreview]);

  const handleExecute = useCallback(async () => {
    setStep('importing');
    try {
      const result = await importExecute.mutateAsync({
        csvContent,
        defaultAccountId: defaultAccountId || null,
        skipRowNumbers: Array.from(skippedRows),
      });
      setImportResult(result);
      setStep('results');
      toast.success(`Import complete! ${result.created} created, ${result.updated} updated`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
      setStep('preview');
    }
  }, [csvContent, defaultAccountId, skippedRows, importExecute]);

  const toggleRowSkip = useCallback((rowNumber: number) => {
    setSkippedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  // Count rows by action (accounting for user toggles)
  const getAdjustedCounts = () => {
    if (!previewData) return { create: 0, update: 0, skip: 0, unchanged: 0 };
    let create = 0;
    let update = 0;
    let skip = 0;
    let unchanged = 0;
    for (const row of previewData.rows) {
      if (row.action === 'skip' || skippedRows.has(row.rowNumber)) {
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

  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(abs);
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'upload' && 'Import Transactions'}
            {step === 'account' && 'Select Account'}
            {step === 'preview' && 'Import Preview'}
            {step === 'importing' && 'Importing...'}
            {step === 'results' && 'Import Complete'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a CSV file to import transactions. Use the Otter Money export format, or any CSV with Date, Amount, and Description columns.
              </p>

              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : csvContent
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-primary hover:bg-primary/5'
                )}
              >
                {csvContent ? (
                  <>
                    <svg className="w-10 h-10 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-900">{fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatFileSize(fileSize)}</p>
                    <p className="text-xs text-primary mt-2">Click to choose a different file</p>
                  </>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">Drop your CSV file here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInput}
                className="hidden"
              />

              <button
                onClick={() => setStep('account')}
                disabled={!csvContent}
                className="btn-primary w-full"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Select Account */}
          {step === 'account' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select a default account for transactions that don't specify one. If your CSV has an "Account" column, matched accounts will be used automatically — rows with unrecognized accounts will be skipped.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Account <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={defaultAccountId}
                  onChange={(e) => setDefaultAccountId(e.target.value)}
                  className="input"
                >
                  <option value="">— None (skip unmatched rows) —</option>
                  {accounts?.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.owner ? ` (${account.owner.name})` : ' (Joint)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Rows without a recognized account will use this default, or be skipped if none is set.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('upload')} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  onClick={handlePreview}
                  disabled={importPreview.isPending}
                  className="btn-primary flex-1"
                >
                  {importPreview.isPending ? 'Analyzing...' : 'Preview Import'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && !previewData && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Analyzing your transactions...</p>
            </div>
          )}

          {step === 'preview' && previewData && (
            <div className="space-y-4">
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

              {/* Row list */}
              <div className="max-h-[40vh] overflow-y-auto space-y-1">
                {previewData.rows
                  .filter((row) => row.action === activeTab)
                  .map((row) => (
                    <PreviewRowItem
                      key={row.rowNumber}
                      row={row}
                      isUserSkipped={skippedRows.has(row.rowNumber)}
                      onToggleSkip={() => toggleRowSkip(row.rowNumber)}
                      formatAmount={formatAmount}
                    />
                  ))}

                {previewData.rows.filter((r) => r.action === activeTab).length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">
                    No {activeTab === 'create' ? 'new' : activeTab === 'update' ? 'updated' : activeTab === 'unchanged' ? 'unchanged' : 'skipped'} transactions
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('account')} className="btn-secondary flex-1">
                  Back
                </button>
                <button
                  onClick={handleExecute}
                  disabled={getAdjustedCounts().create + getAdjustedCounts().update === 0}
                  className="btn-primary flex-1"
                >
                  Import {getAdjustedCounts().create + getAdjustedCounts().update} Transactions
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700">Importing transactions...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment for large files</p>
            </div>
          )}

          {/* Step 5: Results */}
          {step === 'results' && importResult && (
            <div className="space-y-4">
              {/* Success icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>

              <h3 className="text-center text-lg font-semibold text-gray-900">Import Complete</h3>

              {/* Result stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{importResult.created}</div>
                  <div className="text-xs text-green-600">Created</div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{importResult.updated}</div>
                  <div className="text-xs text-blue-600">Updated</div>
                </div>
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{importResult.skipped}</div>
                  <div className="text-xs text-orange-600">Skipped</div>
                </div>
              </div>

              {importResult.rulesApplied > 0 && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                  <p className="text-sm text-purple-700">
                    <span className="font-semibold">{importResult.rulesApplied}</span> transactions auto-categorized by your rules
                  </p>
                </div>
              )}

              {/* Skipped details */}
              {importResult.skippedDetails.length > 0 && (
                <details className="rounded-lg border border-gray-200">
                  <summary className="p-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                    Skipped rows ({importResult.skippedDetails.length})
                  </summary>
                  <div className="border-t border-gray-200 max-h-40 overflow-y-auto">
                    {importResult.skippedDetails.map((detail) => (
                      <div
                        key={detail.rowNumber}
                        className="px-3 py-2 text-xs text-gray-600 border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium">Row {detail.rowNumber}:</span> {detail.reason}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <button onClick={handleClose} className="btn-primary w-full">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent for preview row items
function PreviewRowItem({
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
            <span>&middot;</span>
            <span>{row.parsed.accountName}</span>
            {row.parsed.category && (
              <>
                <span>&middot;</span>
                <span>{row.parsed.category}</span>
              </>
            )}
          </div>
          {isSkipped && row.skipReason && (
            <p className="text-xs text-orange-600 mt-1">{row.skipReason}</p>
          )}
          {isUnchanged && row.matchedTransaction && (
            <p className="text-xs text-gray-400 mt-1">
              Already exists — no changes needed
              {!row.matchedTransaction.isManual && ' (synced)'}
            </p>
          )}
          {row.action === 'update' && row.matchedTransaction && (
            <p className="text-xs text-blue-600 mt-1">
              Matches: "{row.matchedTransaction.description}"
              {!row.matchedTransaction.isManual && ' (synced)'}
            </p>
          )}
          {/* Show field-level changes for updates */}
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
              title={isUserSkipped ? 'Include in import' : 'Exclude from import'}
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

export default ImportWizardModal;
