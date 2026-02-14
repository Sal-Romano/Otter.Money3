import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateMileage } from '../hooks/useVehicles';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { VehicleWithDetails } from '@otter-money/shared';

interface UpdateMileageModalProps {
  vehicle: VehicleWithDetails;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function UpdateMileageModal({ vehicle, onClose }: UpdateMileageModalProps) {
  const updateMileage = useUpdateMileage();
  const [mileage, setMileage] = useState('');
  const [result, setResult] = useState<{
    newValue: number;
    previousValue: number;
    change: number;
    changePercent: number | null;
  } | null>(null);

  useBodyScrollLock(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum) || mileageNum <= 0) {
      toast.error('Please enter a valid mileage');
      return;
    }

    if (mileageNum < vehicle.mileage) {
      toast.error(`New mileage must be at least ${vehicle.mileage.toLocaleString()} miles`);
      return;
    }

    try {
      const response = await updateMileage.mutateAsync({
        id: vehicle.id,
        mileage: mileageNum,
      });

      setResult({
        newValue: response.account.currentBalance,
        previousValue: response.previousValue || 0,
        change: response.valueChange || 0,
        changePercent: response.valueChangePercent || null,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update mileage');
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
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-lg">
                🚗
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Update Mileage</h2>
                <p className="text-sm text-gray-500">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>
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

        {!result ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Current stats */}
            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Current Mileage</span>
                <span className="font-medium text-gray-900">
                  {vehicle.mileage.toLocaleString()} mi
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Current Value</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(vehicle.account.currentBalance)}
                </span>
              </div>
            </div>

            {/* New mileage input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Mileage
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="input text-lg pr-14"
                  placeholder={String(vehicle.mileage + 1000)}
                  min={vehicle.mileage}
                  required
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  miles
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Check your odometer for the current reading
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMileage.isPending}
                className="btn-primary flex-1"
              >
                {updateMileage.isPending
                  ? 'Getting Value...'
                  : 'Get Updated Value'}
              </button>
            </div>
          </form>
        ) : (
          /* Result view */
          <div className="p-6 space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">Updated Market Value</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(result.newValue)}
              </p>
              {result.change !== 0 && (
                <p
                  className={`text-sm font-medium mt-1 ${
                    result.change > 0 ? 'text-success' : 'text-error'
                  }`}
                >
                  {result.change > 0 ? '+' : ''}
                  {formatCurrency(result.change)}
                  {result.changePercent != null && (
                    <span className="ml-1">
                      ({result.change > 0 ? '+' : ''}
                      {result.changePercent.toFixed(1)}%)
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Previous Value</span>
                <span className="text-gray-900">
                  {formatCurrency(result.previousValue)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">New Value</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(result.newValue)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">New Mileage</span>
                <span className="text-gray-900">
                  {parseInt(mileage).toLocaleString()} mi
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="btn-primary w-full"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
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
