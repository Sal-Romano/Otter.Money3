import { useState } from 'react';
import { toast } from 'sonner';
import { useHouseholdMembers } from '../hooks/useHousehold';
import { useCreateVehicle, useDecodeVin } from '../hooks/useVehicles';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VehicleModal({ isOpen, onClose }: VehicleModalProps) {
  const { data: members } = useHouseholdMembers();
  const createVehicle = useCreateVehicle();
  const decodeVin = useDecodeVin();

  const [vin, setVin] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [mileage, setMileage] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [vinDecoded, setVinDecoded] = useState(false);

  useBodyScrollLock(isOpen);

  const handleDecodeVin = async () => {
    if (vin.length !== 17) {
      toast.error('VIN must be exactly 17 characters');
      return;
    }

    try {
      const result = await decodeVin.mutateAsync(vin);
      setYear(String(result.year));
      setMake(result.make);
      setModel(result.model);
      setTrim(result.trim || '');
      setVinDecoded(true);
      toast.success(`Found: ${result.year} ${result.make} ${result.model}${result.trim ? ' ' + result.trim : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to decode VIN');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const yearNum = parseInt(year, 10);
    const mileageNum = parseInt(mileage, 10);

    if (!vin || vin.length !== 17) {
      toast.error('Please enter a valid 17-character VIN');
      return;
    }
    if (!yearNum || yearNum < 1900 || yearNum > 2100) {
      toast.error('Please enter a valid year');
      return;
    }
    if (!make.trim() || !model.trim()) {
      toast.error('Make and model are required');
      return;
    }
    if (isNaN(mileageNum) || mileageNum < 0) {
      toast.error('Please enter a valid mileage');
      return;
    }
    if (!zipCode || zipCode.length < 5) {
      toast.error('Please enter a valid ZIP code');
      return;
    }

    try {
      await createVehicle.mutateAsync({
        vin: vin.toUpperCase(),
        year: yearNum,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        mileage: mileageNum,
        zipCode: zipCode.trim(),
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        ownerId,
        name: name.trim() || undefined,
      });
      toast.success('Vehicle added! Getting initial valuation...');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vehicle');
    }
  };

  if (!isOpen) return null;

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
              <span className="text-2xl">🚗</span>
              <h2 className="text-xl font-semibold text-gray-900">
                Add Vehicle
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* VIN Input with Decode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              VIN <span className="text-red-500">*</span>
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
                className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {decodeVin.isPending ? 'Looking up...' : 'Look Up'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {vin.length}/17 characters
              {vinDecoded && <span className="text-green-600 ml-2">VIN decoded</span>}
            </p>
          </div>

          {/* Year, Make, Model, Trim */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="input"
                placeholder="2022"
                min="1900"
                max="2100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="input"
                placeholder="Honda"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
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
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                className="input"
                placeholder="Sport Touring"
              />
            </div>
          </div>

          {/* Mileage and ZIP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Mileage <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="input"
                placeholder="60,000"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
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
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
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
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder={
                year && make && model
                  ? `${year} ${make} ${model}`
                  : 'e.g., Our Civic'
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to use "{year || '2022'} {make || 'Honda'} {model || 'Civic'}"
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
              disabled={createVehicle.isPending}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createVehicle.isPending ? 'Adding Vehicle...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
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
