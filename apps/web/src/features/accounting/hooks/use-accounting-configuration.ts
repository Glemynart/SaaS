'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  accountingApi,
  type CentroCostoFilters,
  type CuentaContableFilters,
  type TerceroFilters,
} from '../services/accounting-api';

export const accountingConfigurationKeys = {
  all: ['accounting-configuration'] as const,
  cuentas: () => [...accountingConfigurationKeys.all, 'cuentas'] as const,
  cuentaList: (filters: CuentaContableFilters) =>
    [...accountingConfigurationKeys.cuentas(), filters] as const,
  mapas: () => [...accountingConfigurationKeys.all, 'mapas'] as const,
  terceros: () => [...accountingConfigurationKeys.all, 'terceros'] as const,
  terceroList: (filters: TerceroFilters) =>
    [...accountingConfigurationKeys.terceros(), filters] as const,
  centrosCosto: () => [...accountingConfigurationKeys.all, 'centros-costo'] as const,
  centroCostoList: (filters: CentroCostoFilters) =>
    [...accountingConfigurationKeys.centrosCosto(), filters] as const,
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

export function useTerceros(filters: TerceroFilters = {}) {
  return useQuery({
    queryKey: accountingConfigurationKeys.terceroList(filters),
    queryFn: () => accountingApi.terceros.getAll(filters),
  });
}

export function useCreateTercero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.terceros.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.terceros() }),
  });
}

export function useUpdateTercero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.terceros.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.terceros() }),
  });
}

export function useCentrosCosto(filters: CentroCostoFilters = {}) {
  return useQuery({
    queryKey: accountingConfigurationKeys.centroCostoList(filters),
    queryFn: () => accountingApi.centrosCosto.getAll(filters),
  });
}

export function useCreateCentroCosto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.centrosCosto.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.centrosCosto() }),
  });
}

export function useUpdateCentroCosto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountingApi.centrosCosto.update,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountingConfigurationKeys.centrosCosto() }),
  });
}
