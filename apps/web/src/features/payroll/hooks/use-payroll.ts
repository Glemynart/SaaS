import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/payroll-api';

export const payrollKeys = {
  all: ['payroll'] as const,
  dashboard: () => [...payrollKeys.all, 'dashboard'],
  periods: () => [...payrollKeys.all, 'periods'],
  period: (id: string) => [...payrollKeys.periods(), id],
  blocks: (periodId: string) => [...payrollKeys.period(periodId), 'blocks'],
  novelties: () => [...payrollKeys.all, 'novelties'],
};

export function usePayrollDashboard() {
  return useQuery({ queryKey: payrollKeys.dashboard(), queryFn: payrollApi.getDashboard });
}
export function usePayrollPeriods() {
  return useQuery({ queryKey: payrollKeys.periods(), queryFn: payrollApi.getPeriods });
}
export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: payrollKeys.period(id),
    queryFn: () => payrollApi.getPeriod(id),
    enabled: !!id,
  });
}
export function usePayrollNovelties(employeeId?: string) {
  return useQuery({
    queryKey: [...payrollKeys.novelties(), employeeId],
    queryFn: () => payrollApi.getNovelties(employeeId),
  });
}
export function usePayrollBlocks(periodId: string) {
  return useQuery({
    queryKey: payrollKeys.blocks(periodId),
    queryFn: () => payrollApi.getBlocks(periodId),
    enabled: !!periodId,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createPeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.periods() }),
  });
}
export function useRecalculatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.recalculatePayroll,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useEnviarARevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.enviarARevision,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useAprobarPayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.aprobar,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useRechazarPayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      payrollApi.rechazar(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useReabrirPayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.reabrir,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.generatePayroll,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useExcludePayrollBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, motivo }: { blockId: string; motivo?: string }) =>
      payrollApi.excludeBlock(blockId, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useCreateNovelty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createNovelty,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.novelties() }),
  });
}
