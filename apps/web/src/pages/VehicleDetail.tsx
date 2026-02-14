import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useVehicle, useVehicleValuations, useDeleteVehicle } from '../hooks/useVehicles';
import { UpdateMileageModal } from '../components/UpdateMileageModal';
import { toast } from 'sonner';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vehicle, isLoading, error } = useVehicle(id || null);
  const { data: valuations } = useVehicleValuations(id || null);
  const deleteVehicle = useDeleteVehicle();

  const [showMileageModal, setShowMileageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-500">Loading vehicle...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Vehicle not found</p>
          <button
            onClick={() => navigate('/accounts')}
            className="text-primary hover:text-primary-600"
          >
            Back to Accounts
          </button>
        </div>
      </div>
    );
  }

  const currentValue = vehicle.account.currentBalance;
  const purchasePrice = vehicle.purchasePrice;
  const totalDepreciation =
    purchasePrice != null ? currentValue - purchasePrice : null;
  const depreciationPercent =
    purchasePrice != null && purchasePrice > 0
      ? ((currentValue - purchasePrice) / purchasePrice) * 100
      : null;

  // Chart data
  const chartData = (valuations || []).map((v) => ({
    date: v.date,
    dateLabel: new Date(v.date).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    }),
    value: v.marketValue,
    mileage: v.mileageAtValuation,
  }));

  const handleDelete = async () => {
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      toast.success('Vehicle removed');
      navigate('/accounts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete vehicle');
    }
  };

  return (
    <div className="px-4 py-6 pb-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/accounts')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Accounts
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-lg">
            🚗
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {vehicle.account.name}
            </h1>
            <p className="text-sm text-gray-500">
              {vehicle.vin}
              {vehicle.owner && (
                <span className="ml-2 text-primary">
                  {vehicle.owner.name}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Current Value Card */}
      <div className="card mb-4 p-6">
        <p className="text-sm text-gray-500 mb-1">Current Market Value</p>
        <p className="text-3xl font-bold text-gray-900">
          {formatCurrency(currentValue)}
        </p>

        {totalDepreciation != null && (
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`text-sm font-medium ${
                totalDepreciation >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {totalDepreciation >= 0 ? '+' : ''}
              {formatCurrency(totalDepreciation)} from purchase
              {depreciationPercent != null && (
                <span className="ml-1">
                  ({totalDepreciation >= 0 ? '+' : ''}
                  {depreciationPercent.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        )}

        {vehicle.latestValuation && (
          <p className="text-xs text-gray-400 mt-2">
            Last valued {daysAgo(vehicle.latestValuation.createdAt)}
            {vehicle.latestValuation.msrp != null && (
              <span className="ml-2">
                MSRP: {formatCurrency(vehicle.latestValuation.msrp)}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowMileageModal(true)}
          className="btn-primary flex-1"
        >
          Update Mileage
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="btn-secondary"
        >
          Remove
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="rounded-lg bg-error-50 p-4 mb-6">
          <p className="text-sm text-error-600 mb-3">
            Remove this vehicle? This will delete the account and all valuation history.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteVehicle.isPending}
              className="btn flex-1 bg-error text-white hover:bg-error-600"
            >
              {deleteVehicle.isPending ? 'Removing...' : 'Remove Vehicle'}
            </button>
          </div>
        </div>
      )}

      {/* Depreciation Chart */}
      {chartData.length > 1 && (
        <div className="card p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Value Over Time
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
              >
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9F6FBA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9F6FBA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(data.value)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(data.date)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {data.mileage.toLocaleString()} miles
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#9F6FBA"
                  strokeWidth={2}
                  fill="url(#valueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Vehicle Info */}
      <div className="card p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Vehicle Details
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Year" value={String(vehicle.year)} />
          <InfoRow label="Make" value={vehicle.make} />
          <InfoRow label="Model" value={vehicle.model} />
          <InfoRow label="Trim" value={vehicle.trim || '-'} />
          <InfoRow
            label="Mileage"
            value={`${vehicle.mileage.toLocaleString()} mi`}
          />
          <InfoRow label="ZIP Code" value={vehicle.zipCode} />
          {vehicle.purchasePrice != null && (
            <InfoRow
              label="Purchase Price"
              value={formatCurrency(vehicle.purchasePrice)}
            />
          )}
          {vehicle.purchaseDate && (
            <InfoRow
              label="Purchase Date"
              value={formatDate(vehicle.purchaseDate)}
            />
          )}
        </div>
      </div>

      {/* Valuation History */}
      {valuations && valuations.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Valuation History
          </h2>
          <div className="space-y-0 divide-y divide-gray-100">
            {[...valuations].reverse().map((v, i, arr) => {
              const prev = arr[i + 1];
              const change = prev ? v.marketValue - prev.marketValue : null;
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(v.date)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {v.mileageAtValuation.toLocaleString()} mi
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(v.marketValue)}
                    </p>
                    {change != null && (
                      <p
                        className={`text-xs ${
                          change >= 0 ? 'text-success' : 'text-error'
                        }`}
                      >
                        {change >= 0 ? '+' : ''}
                        {formatCurrency(change)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Update Mileage Modal */}
      {showMileageModal && (
        <UpdateMileageModal
          vehicle={vehicle}
          onClose={() => setShowMileageModal(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-gray-900 font-medium">{value}</p>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className: string }) {
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
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}
