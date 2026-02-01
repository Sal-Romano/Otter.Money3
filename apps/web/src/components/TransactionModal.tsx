import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '../hooks/useTransactions';
import { CategoryPicker } from './CategoryPicker';
import type { CategoryType } from '@otter-money/shared';

interface Transaction {
  id: string;
  accountId: string;
  date: string | Date;
  amount: number;
  description: string;
  merchantName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  isManual: boolean;
  account: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
    type: CategoryType;
  } | null;
}

interface TransactionModalProps {
  transaction?: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

export function TransactionModal({
  transaction,
  isOpen,
  onClose,
  defaultAccountId,
}: TransactionModalProps) {
  const navigate = useNavigate();
  const isEditing = !!transaction;

  // Form state
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Data hooks
  const { data: accounts } = useAccounts();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const isLoading =
    createTransaction.isPending ||
    updateTransaction.isPending ||
    deleteTransaction.isPending;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && transaction) {
      setAccountId(transaction.accountId);
      const txDate =
        typeof transaction.date === 'string'
          ? transaction.date.split('T')[0]
          : transaction.date.toISOString().split('T')[0];
      setDate(txDate);
      setAmount(Math.abs(transaction.amount).toString());
      setIsExpense(transaction.amount < 0);
      setDescription(transaction.description);
      setMerchantName(transaction.merchantName || '');
      setCategoryId(transaction.categoryId || null);
      setNotes(transaction.notes || '');
      setShowDeleteConfirm(false);
    } else if (isOpen && !transaction) {
      setAccountId(defaultAccountId || accounts?.[0]?.id || '');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setIsExpense(true);
      setDescription('');
      setMerchantName('');
      setCategoryId(null);
      setNotes('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, transaction, defaultAccountId, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = parseFloat(amount);
    const finalAmount = isExpense ? -Math.abs(amountValue) : Math.abs(amountValue);

    try {
      if (isEditing) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          date,
          amount: finalAmount,
          description,
          merchantName: merchantName || null,
          categoryId,
          notes: notes || null,
        });
      } else {
        await createTransaction.mutateAsync({
          accountId,
          date,
          amount: finalAmount,
          description,
          merchantName: merchantName || undefined,
          categoryId,
          notes: notes || undefined,
        });
      }

      onClose();
    } catch (err) {
      console.error('Failed to save transaction:', err);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;

    try {
      await deleteTransaction.mutateAsync(transaction.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  if (!isOpen) return null;

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
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setIsExpense(true)}
              className={clsx(
                'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                isExpense
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setIsExpense(false)}
              className={clsx(
                'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                !isExpense
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Income
            </button>
          </div>

          {/* Account */}
          {!isEditing && (
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-gray-700">
                Account
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input mt-1"
                required
              >
                <option value="">Select account...</option>
                {accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.owner ? ` (${account.owner.name})` : ' (Joint)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input mt-1"
              placeholder="What was this for?"
              required
            />
          </div>

          {/* Merchant */}
          <div>
            <label htmlFor="merchant" className="block text-sm font-medium text-gray-700">
              Merchant (optional)
            </label>
            <input
              id="merchant"
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="input mt-1"
              placeholder="e.g., Amazon, Costco"
            />
          </div>

          {/* Category */}
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            categoryType={isExpense ? 'EXPENSE' : 'INCOME'}
            label="Category"
            allowUncategorized={true}
          />

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input mt-1"
              rows={2}
              placeholder="Any additional details..."
            />
          </div>

          {/* Create Rule button */}
          {isEditing && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => {
                // Navigate to rules page with pre-filled data
                const searchParams = new URLSearchParams();
                searchParams.set('createFrom', transaction.id);
                if (transaction.merchantName) {
                  searchParams.set('merchant', transaction.merchantName);
                }
                if (transaction.categoryId) {
                  searchParams.set('category', transaction.categoryId);
                }
                navigate(`/rules?${searchParams.toString()}`);
                onClose();
              }}
              className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              🤖 Create Rule from This Transaction
            </button>
          )}

          {/* Delete button */}
          {isEditing && transaction.isManual && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-sm text-error hover:text-error-600"
            >
              Delete Transaction
            </button>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="rounded-lg bg-error-50 p-3">
              <p className="text-sm text-error-600 mb-3">
                Are you sure you want to delete this transaction?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="btn flex-1 bg-error text-white hover:bg-error-600"
                >
                  {deleteTransaction.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          {!showDeleteConfirm && (
            <button
              type="submit"
              disabled={isLoading || !accountId || !amount || !description}
              className="btn-primary w-full"
            >
              {isLoading
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Add Transaction'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function XIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
