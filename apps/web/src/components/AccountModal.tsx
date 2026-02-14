import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import type { AccountWithOwner, AccountType } from '@otter-money/shared';
import { useHouseholdMembers } from '../hooks/useHousehold';
import { useCreateAccount, useUpdateAccount, useUpdateBalance, useDeleteAccount } from '../hooks/useAccounts';
import { useCreateVehicle, useDecodeVin } from '../hooks/useVehicles';
import { AccountIcon, accountTypeLabels } from './AccountIcon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AccountModalProps {
  account?: AccountWithOwner | null;
  isOpen: boolean;
  onClose: () => void;
}

const accountTypes: AccountType[] = [
  'CHECKING',
  'SAVINGS',
  'CREDIT',
  'INVESTMENT',
  'LOAN',
  'MORTGAGE',
  'ASSET',
  'OTHER',
];

export function AccountModal({ account, isOpen, onClose }: AccountModalProps) {
  const isEditing = !!account;

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [balanceNote, setBalanceNote] = useState('');
  const [showBalanceUpdate, setShowBalanceUpdate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Vehicle sub-flow state
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vin, setVin] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleTrim, setVehicleTrim] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');
  const [vehicleZipCode, setVehicleZipCode] = useState('');
  const [vehiclePurchasePrice, setVehiclePurchasePrice] = useState('');
  const [vehiclePurchaseDate, setVehiclePurchaseDate] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vinDecoded, setVinDecoded] = useState(false);

  // API hooks
  const { data: members } = useHouseholdMembers();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const updateBalance = useUpdateBalance();
  const deleteAccount = useDeleteAccount();
  const createVehicle = useCreateVehicle();
  const decodeVin = useDecodeVin();

  const isLoading =
    createAccount.isPending ||
    updateAccount.isPending ||
    updateBalance.isPending ||
    deleteAccount.isPending ||
    createVehicle.isPending;

  useBodyScrollLock(isOpen);

  // Reset form when modal opens/closes or account changes
  useEffect(() => {
    if (isOpen && account) {
      setName(account.name);
      setType(account.type);
      setOwnerId(account.ownerId);
      setBalance(String(account.currentBalance));
      setBalanceNote('');
      setShowBalanceUpdate(false);
      setShowDeleteConfirm(false);
      setShowVehicleForm(false);
    } else if (isOpen && !account) {
      setName('');
      setType('CHECKING');
      setOwnerId(null);
      setBalance('0');
      setBalanceNote('');
      setShowBalanceUpdate(false);
      setShowDeleteConfirm(false);
      setShowVehicleForm(false);
      resetVehicleFields();
    }
  }, [isOpen, account]);

  const resetVehicleFields = () => {
    setVin('');
    setVehicleYear('');
    setVehicleMake('');
    setVehicleModel('');
    setVehicleTrim('');
    setVehicleMileage('');
    setVehicleZipCode('');
    setVehiclePurchasePrice('');
    setVehiclePurchaseDate('');
    setVehicleName('');
    setVinDecoded(false);
  };

  const handleDecodeVin = async () => {
    if (vin.length !== 17) {
      toast.error('VIN must be exactly 17 characters');
      return;
    }

    try {
      const result = await decodeVin.mutateAsync(vin);
      setVehicleYear(String(result.year));
      setVehicleMake(result.make);
      setVehicleModel(result.model);
      setVehicleTrim(result.trim || '');
      setVinDecoded(true);
      toast.success(`Found: ${result.year} ${result.make} ${result.model}${result.trim ? ' ' + result.trim : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to decode VIN');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing) {
        await updateAccount.mutateAsync({
          id: account.id,
          name,
          type,
          ownerId,
        });

        // Handle balance update if changed
        const newBalance = parseFloat(balance);
        if (showBalanceUpdate && newBalance !== account.currentBalance) {
          await updateBalance.mutateAsync({
            id: account.id,
            newBalance,
            note: balanceNote || undefined,
          });
        }
      } else {
        await createAccount.mutateAsync({
          name,
          type,
          ownerId,
          currentBalance: parseFloat(balance),
        });
      }

      onClose();
    } catch (err) {
      // Error handling is done in the mutation
      console.error('Failed to save account:', err);
    }
  };

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const yearNum = parseInt(vehicleYear, 10);
    const mileageNum = parseInt(vehicleMileage, 10);

    if (!vin || vin.length !== 17) {
      toast.error('Please enter a valid 17-character VIN');
      return;
    }
    if (!yearNum || yearNum < 1900 || yearNum > 2100) {
      toast.error('Please enter a valid year');
      return;
    }
    if (!vehicleMake.trim() || !vehicleModel.trim()) {
      toast.error('Make and model are required');
      return;
    }
    if (isNaN(mileageNum) || mileageNum < 0) {
      toast.error('Please enter a valid mileage');
      return;
    }
    if (!vehicleZipCode || vehicleZipCode.length < 5) {
      toast.error('Please enter a valid ZIP code');
      return;
    }

    try {
      await createVehicle.mutateAsync({
        vin: vin.toUpperCase(),
        year: yearNum,
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        trim: vehicleTrim.trim() || undefined,
        mileage: mileageNum,
        zipCode: vehicleZipCode.trim(),
        purchasePrice: vehiclePurchasePrice ? parseFloat(vehiclePurchasePrice) : undefined,
        purchaseDate: vehiclePurchaseDate || undefined,
        ownerId,
        name: vehicleName.trim() || undefined,
      });
      toast.success('Vehicle added! Getting initial valuation...');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vehicle');
    }
  };

  const handleDelete = async () => {
    if (!account) return;

    // Prevent deletion of Plaid-connected accounts
    if (account.connectionType === 'PLAID') {
      toast.error('Plaid-connected accounts cannot be deleted individually. Please disconnect the bank connection from the Accounts page.');
      return;
    }

    try {
      await deleteAccount.mutateAsync(account.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  if (!isOpen) return null;

  // Vehicle add form (sub-flow when ASSET is selected and user clicks "Track a Vehicle")
  if (showVehicleForm && !isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowVehicleForm(false)}
                  className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Back"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">
                  Track a Vehicle
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleVehicleSubmit} className="p-6 space-y-4">
            {/* VIN Input with Decode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIN
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => {
                    setVin(e.target.value.toUpperCase());
                    setVinDecoded(false);
                  }}
                  maxLength={17}
                  className="input flex-1 font-mono tracking-wider"
                  placeholder="Enter 17-character VIN"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleDecodeVin}
                  disabled={vin.length !== 17 || decodeVin.isPending}
                  className="btn-primary whitespace-nowrap"
                >
                  {decodeVin.isPending ? 'Looking up...' : 'Look Up'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {vin.length}/17 characters
                {vinDecoded && <span className="text-success ml-2">VIN decoded</span>}
              </p>
            </div>

            {/* Year, Make, Model, Trim */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  className="input"
                  placeholder="2022"
                  min="1900"
                  max="2100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  className="input"
                  placeholder="Honda"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="input"
                  placeholder="Civic"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trim
                </label>
                <input
                  type="text"
                  value={vehicleTrim}
                  onChange={(e) => setVehicleTrim(e.target.value)}
                  className="input"
                  placeholder="Sport Touring"
                />
              </div>
            </div>

            {/* Mileage and ZIP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Mileage
                </label>
                <input
                  type="number"
                  value={vehicleMileage}
                  onChange={(e) => setVehicleMileage(e.target.value)}
                  className="input"
                  placeholder="60000"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={vehicleZipCode}
                  onChange={(e) => setVehicleZipCode(e.target.value)}
                  className="input"
                  placeholder="90210"
                  maxLength={10}
                  required
                />
              </div>
            </div>

            {/* Purchase Info (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vehiclePurchasePrice}
                    onChange={(e) => setVehiclePurchasePrice(e.target.value)}
                    className="input pl-7"
                    placeholder="28,000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={vehiclePurchaseDate}
                  onChange={(e) => setVehiclePurchaseDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <select
                value={ownerId ?? 'joint'}
                onChange={(e) =>
                  setOwnerId(e.target.value === 'joint' ? null : e.target.value)
                }
                className="input"
              >
                <option value="joint">Joint (Shared)</option>
                {members?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.isCurrentUser ? ' (You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                className="input"
                placeholder={
                  vehicleYear && vehicleMake && vehicleModel
                    ? `${vehicleYear} ${vehicleMake} ${vehicleModel}`
                    : 'e.g., Our Civic'
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to auto-generate from year, make, and model
              </p>
            </div>

            {/* Actions */}
            <button
              type="submit"
              disabled={createVehicle.isPending}
              className="btn-primary w-full"
            >
              {createVehicle.isPending ? 'Adding Vehicle...' : 'Add Vehicle'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            {isEditing ? 'Edit Account' : 'Add Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Plaid Warning */}
        {isEditing && account?.connectionType === 'PLAID' && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
            This account is connected via Plaid. Name and type cannot be edited. Only the owner can be changed.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Account Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="e.g., Chase Checking"
              required
              disabled={isEditing && account?.connectionType === 'PLAID'}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {accountTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  disabled={isEditing && account?.connectionType === 'PLAID'}
                  className={clsx(
                    'flex flex-col items-center p-2 rounded-lg border-2 transition-colors',
                    type === t
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300',
                    isEditing && account?.connectionType === 'PLAID' && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <AccountIcon type={t} size="sm" />
                  <span className="mt-1 text-xs text-gray-600">
                    {accountTypeLabels[t]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Tracking Option - shown when ASSET is selected in Add mode */}
          {!isEditing && type === 'ASSET' && (
            <div className="rounded-lg border-2 border-dashed border-primary-200 bg-primary-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
                  🚗
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Want to track a vehicle?
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Get automatic market valuations for your car
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVehicleForm(true)}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                >
                  Track Vehicle
                </button>
              </div>
            </div>
          )}

          {/* Owner */}
          <div>
            <label htmlFor="owner" className="block text-sm font-medium text-gray-700">
              Owner
            </label>
            <select
              id="owner"
              value={ownerId ?? 'joint'}
              onChange={(e) => setOwnerId(e.target.value === 'joint' ? null : e.target.value)}
              className="input mt-1"
            >
              <option value="joint">Joint (Shared)</option>
              {members?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.isCurrentUser ? ' (You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Balance */}
          {!isEditing ? (
            <div>
              <label htmlFor="balance" className="block text-sm font-medium text-gray-700">
                Current Balance
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="input pl-7"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                For credit cards and loans, enter the amount owed as a negative number.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Current Balance: ${account.currentBalance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setShowBalanceUpdate(!showBalanceUpdate)}
                  className="text-sm text-primary hover:text-primary-600"
                >
                  {showBalanceUpdate ? 'Cancel' : 'Update Balance'}
                </button>
              </div>

              {showBalanceUpdate && (
                <div className="mt-3 space-y-3 p-3 rounded-lg bg-gray-50">
                  <div>
                    <label htmlFor="newBalance" className="block text-sm font-medium text-gray-700">
                      New Balance
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="newBalance"
                        type="number"
                        step="0.01"
                        value={balance}
                        onChange={(e) => setBalance(e.target.value)}
                        className="input pl-7"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="balanceNote" className="block text-sm font-medium text-gray-700">
                      Note (optional)
                    </label>
                    <input
                      id="balanceNote"
                      type="text"
                      value={balanceNote}
                      onChange={(e) => setBalanceNote(e.target.value)}
                      className="input mt-1"
                      placeholder="e.g., End of month reconciliation"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete button for existing accounts */}
          {isEditing && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-sm text-error hover:text-error-600"
            >
              Delete Account
            </button>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="rounded-lg bg-error-50 p-3">
              <p className="text-sm text-error-600 mb-3">
                Are you sure you want to delete this account? This will also delete all transactions.
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
                  {deleteAccount.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          {!showDeleteConfirm && (
            <button
              type="submit"
              disabled={isLoading || !name}
              className="btn-primary w-full"
            >
              {isLoading
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Add Account'}
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

function ChevronLeftIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
