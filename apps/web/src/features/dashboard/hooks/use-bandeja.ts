'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/features/alerts/services/alerts-api';
import { billingApi } from '@/features/billing/services/billing-api';
import { lotesApi } from '@/features/lotes/services/lotes-api';
import { payrollApi } from '@/features/payroll/services/payroll-api';

/**
 * Fuentes de la Bandeja del día. Cuatro queries independientes a propósito:
 * si una falla, las demás se renderizan igual (degradación parcial, DB-D8).
 */

export const bandejaKeys = {
  all: ['dashboard', 'bandeja'] as const,
  alerts: () => [...bandejaKeys.all, 'alerts'] as const,
  lotes: () => [...bandejaKeys.all, 'lotes'] as const,
  payroll: () => [...bandejaKeys.all, 'payroll'] as const,
  billing: () => [...bandejaKeys.all, 'billing'] as const,
};

export function useBandejaSources() {
  const alerts = useQuery({
    queryKey: bandejaKeys.alerts(),
    queryFn: () => alertsApi.getAll({ status: 'OPEN', limit: 100 }),
  });
  const lotes = useQuery({
    queryKey: bandejaKeys.lotes(),
    queryFn: () => lotesApi.getAll({ limit: 50 }),
  });
  const payroll = useQuery({
    queryKey: bandejaKeys.payroll(),
    queryFn: payrollApi.getPeriods,
  });
  const billing = useQuery({
    queryKey: bandejaKeys.billing(),
    queryFn: billingApi.getDashboard,
  });

  return { alerts, lotes, payroll, billing };
}

/**
 * Actualizar (DB-D2): dispara las funciones de generación existentes y luego
 * re-consulta todas las fuentes. Sin simular tiempo real, cero endpoints nuevos.
 * Invalida también `['alerts']` para que el indicador del sidebar siga el conteo.
 */
export function useRefreshBandeja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await Promise.all([alertsApi.generateContractAlerts(), alertsApi.generateMissingDocAlerts()]);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bandejaKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]);
    },
  });
}

/**
 * Resolver no invalida por sí mismo: la pantalla orquesta el colapso de la
 * fila (§11) y luego invalida con `useInvalidateBandeja` para que la salida
 * animada preceda al refetch.
 */
export function useResolverItem() {
  return useMutation({
    mutationFn: (alertId: string) => alertsApi.resolve(alertId),
  });
}

export function useInvalidateBandeja() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: bandejaKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ]);
}
