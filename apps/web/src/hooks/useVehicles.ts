import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { accountKeys } from './useAccounts';
import type {
  VehicleWithDetails,
  VehicleValuation,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  UpdateMileageResponse,
  NhtsaDecodeResult,
  NhtsaMake,
  NhtsaModel,
  NhtsaTrim,
} from '@otter-money/shared';

// Query keys
export const vehicleKeys = {
  all: ['vehicles'] as const,
  lists: () => [...vehicleKeys.all, 'list'] as const,
  list: () => [...vehicleKeys.lists()] as const,
  details: () => [...vehicleKeys.all, 'detail'] as const,
  detail: (id: string) => [...vehicleKeys.details(), id] as const,
  valuations: (id: string) => [...vehicleKeys.all, 'valuations', id] as const,
  makes: ['vehicles', 'makes'] as const,
  models: (make: string, year: number) => ['vehicles', 'models', make, year] as const,
  trims: (make: string, model: string, year: number) => ['vehicles', 'trims', make, model, year] as const,
};

// Hooks
export function useVehicles() {
  return useQuery({
    queryKey: vehicleKeys.list(),
    queryFn: () => api.get<VehicleWithDetails[]>('/vehicles'),
  });
}

export function useVehicle(id: string | null) {
  return useQuery({
    queryKey: vehicleKeys.detail(id || ''),
    queryFn: () => api.get<VehicleWithDetails>(`/vehicles/${id}`),
    enabled: !!id,
  });
}

export function useVehicleValuations(id: string | null) {
  return useQuery({
    queryKey: vehicleKeys.valuations(id || ''),
    queryFn: () => api.get<VehicleValuation[]>(`/vehicles/${id}/valuations`),
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleRequest) =>
      api.post<VehicleWithDetails>('/vehicles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateVehicleRequest & { id: string }) =>
      api.patch<VehicleWithDetails>(`/vehicles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ message: string }>(`/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useUpdateMileage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mileage }: { id: string; mileage: number }) =>
      api.post<UpdateMileageResponse>(`/vehicles/${id}/update-mileage`, {
        mileage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useDecodeVin() {
  return useMutation({
    mutationFn: (vin: string) =>
      api.post<NhtsaDecodeResult>('/vehicles/decode-vin', { vin }),
  });
}

export function useVehicleMakes() {
  return useQuery({
    queryKey: vehicleKeys.makes,
    queryFn: () => api.get<NhtsaMake[]>('/vehicles/makes'),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useVehicleModels(make: string | null, year: number | null) {
  return useQuery({
    queryKey: vehicleKeys.models(make!, year!),
    queryFn: () => api.get<NhtsaModel[]>('/vehicles/models', { make: make!, year: year! }),
    enabled: !!make && !!year && year >= 1900,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useVehicleTrims(make: string | null, model: string | null, year: number | null) {
  return useQuery({
    queryKey: vehicleKeys.trims(make!, model!, year!),
    queryFn: () => api.get<NhtsaTrim[]>('/vehicles/trims', { make: make!, model: model!, year: year! }),
    enabled: !!make && !!model && !!year && year >= 1900,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
