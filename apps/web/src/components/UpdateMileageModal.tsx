import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateMileage } from '../hooks/useVehicles';
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
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl flex items-center justify-center w-12 h-12 rounded-full bg-purple-100">
              🚗
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Update Mileage</h2>
              <p className="text-sm text-gray-600">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Current mileage display */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Current Mileage</span>
                <span className="font-semibold text-gray-900">
                  {vehicle.mileage.toLocaleString()} mi
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">Current Value</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(vehicle.account.currentBalance)}
                </span>
              </div>
            </div>

            {/* New mileage input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Mileage <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMileage.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-sm text-gray-600 mb-2">Updated Market Value</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(result.newValue)}
              </p>
              {result.change !== 0 && (
                <p
                  className={`text-sm font-medium mt-1 ${
                    result.change > 0 ? 'text-green-600' : 'text-red-600'
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

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Previous Value</span>
                <span className="text-gray-900">
                  {formatCurrency(result.previousValue)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">New Value</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(result.newValue)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">New Mileage</span>
                <span className="text-gray-900">
                  {parseInt(mileage).toLocaleString()} mi
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
