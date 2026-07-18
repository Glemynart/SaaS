'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi, type CuentaContableFilters } from '../services/accounting-api';

export const accountingConfigurationKeys = {
  all: ['accounting-configuration'] as const,
  cuentas: () => [...accountingConfigurationKeys.all, 'cuentas'] as const,
  cuentaList: (filters: CuentaContableFilters) =>
    [...accountingConfigurationKeys.cuentas(), filters] as const,
  mapas: () => [...accountingConfigurationKeys.all, 'mapas'] as const,
};

export function useCuentasContables(filters: CuentaContableFilters = {}) {
  return useQuery({
    queryKey: accountingConfigurationKeys.cuentaList(filters),
    queryFn: () => accountingApi.cuentas.getAll(filters),
  });
}

export function useCreateCuentaContable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.cuentas.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.cuentas() }),
  });
}

export function useUpdateCuentaContable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.cuentas.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.cuentas() }),
  });
}

export function useCuentaSistemaMaps() {
  return useQuery({
    queryKey: accountingConfigurationKeys.mapas(),
    queryFn: accountingApi.mapas.getAll,
  });
}

export function useCreateCuentaSistemaMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.mapas.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.mapas() }),
  });
}

export function useUpdateCuentaSistemaMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.mapas.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.mapas() }),
  });
}
