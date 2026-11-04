import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/payroll-api';
import type {
  PayrollCorrectionAction,
  PayrollCorrectionIntentPayload,
  PilaEventCode,
} from '../services/payroll-api';

export const payrollKeys = {
  all: ['payroll'] as const,
  dashboard: () => [...payrollKeys.all, 'dashboard'],
  periods: () => [...payrollKeys.all, 'periods'],
  period: (id: string) => [...payrollKeys.periods(), id],
  corrections: (periodId: string) => [...payrollKeys.period(periodId), 'corrections'],
  blocks: (periodId: string) => [...payrollKeys.period(periodId), 'blocks'],
  pilaEvents: (periodId: string) => [...payrollKeys.period(periodId), 'pila-events'],
  pilaPreparation: (periodId: string) => [...payrollKeys.period(periodId), 'pila-preparation'],
  novelties: () => [...payrollKeys.all, 'novelties'],
  servicePremiums: () => [...payrollKeys.all, 'service-premiums'],
  servicePremium: (id: string) => [...payrollKeys.servicePremiums(), id],
};

export function useServicePremiumBatches() {
  return useQuery({
    queryKey: payrollKeys.servicePremiums(),
    queryFn: payrollApi.getServicePremiumBatches,
    refetchInterval: (query) => {
      const batches = query.state.data ?? [];
      return batches.some((batch) => ['APROBADO', 'PROCESANDO'].includes(batch.status))
        ? 3000
        : false;
    },
  });
}

export function useServicePremiumBatch(id: string) {
  return useQuery({
    queryKey: payrollKeys.servicePremium(id),
    queryFn: () => payrollApi.getServicePremiumBatch(id),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data && ['APROBADO', 'PROCESANDO'].includes(query.state.data.status)
        ? 3000
        : false,
  });
}

export function useCreateServicePremiumBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createServicePremiumBatch,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.servicePremiums() }),
  });
}

export function useApproveServicePremiumBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.approveServicePremiumBatch,
    onSuccess: (batch) => {
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremiums() });
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremium(batch.id) });
    },
  });
}

export function useRetryServicePremiumBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.retryServicePremiumBatch,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremiums() });
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremium(result.batchId) });
    },
  });
}

export function useCorrectServicePremiumBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      payrollApi.correctServicePremiumBatch(id, reason),
    onSuccess: (batch) => {
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremiums() });
      qc.invalidateQueries({ queryKey: payrollKeys.servicePremium(batch.id) });
    },
  });
}

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
export function usePayrollCorrections(periodId: string, enabled: boolean) {
  return useQuery({
    queryKey: payrollKeys.corrections(periodId),
    queryFn: () => payrollApi.getCorrections(periodId),
    enabled: !!periodId && enabled,
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

export function usePayrollPilaEvents(periodId: string) {
  return useQuery({
    queryKey: payrollKeys.pilaEvents(periodId),
    queryFn: () => payrollApi.getPilaEvents(periodId),
    enabled: !!periodId,
  });
}

export function usePayrollPilaPreparation(periodId: string, enabled: boolean) {
  return useQuery({
    queryKey: payrollKeys.pilaPreparation(periodId),
    queryFn: () => payrollApi.getPilaPreparation(periodId),
    enabled: !!periodId && enabled,
  });
}

export function useCreatePayrollPilaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      payload,
    }: {
      periodId: string;
      payload: {
        employeeId: string;
        codigo: PilaEventCode;
        fechaInicio: string;
        fechaFin?: string;
        dias?: number;
      };
    }) => payrollApi.createPilaEvent(periodId, payload),
    onSuccess: (_, { periodId }) => {
      qc.invalidateQueries({ queryKey: payrollKeys.pilaEvents(periodId) });
      qc.invalidateQueries({ queryKey: payrollKeys.period(periodId) });
    },
  });
}

export function useDeletePayrollPilaEvent(periodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.deletePilaEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.pilaEvents(periodId) });
      qc.invalidateQueries({ queryKey: payrollKeys.period(periodId) });
    },
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createPeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.periods() }),
  });
}
export function useUpdatePilaPaymentDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      fechaPrevistaPagoPila,
    }: {
      id: string;
      fechaPrevistaPagoPila: string | null;
    }) => payrollApi.updatePilaPaymentDate(id, fechaPrevistaPagoPila),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.periods() }),
  });
}
export function useUpdatePilaFspSourceScope(periodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      sourceScope,
    }: {
      runId: string;
      sourceScope: 'UNCONFIRMED' | 'SINGLE_SOURCE_CONFIRMED' | 'MULTIPLE_SOURCES';
    }) => payrollApi.updatePilaFspSourceScope(runId, sourceScope),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.period(periodId) }),
  });
}
export function useUpdatePilaVoluntaryPensionStatus(periodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      status,
    }: {
      runId: string;
      status: 'UNCONFIRMED' | 'NONE_CONFIRMED' | 'PRESENT';
    }) => payrollApi.updatePilaVoluntaryPensionStatus(runId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.period(periodId) }),
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
export function useContabilizarPayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.contabilizar,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function useCreatePayrollCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      periodId: string;
      payload: { descripcion: string; intents: PayrollCorrectionIntentPayload[] };
    }) => payrollApi.createCorrection(input.periodId, input.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
export function usePayrollCorrectionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      correctionId: string;
      action: PayrollCorrectionAction;
      motivo?: string;
    }) => payrollApi.transitionCorrection(input.correctionId, input.action, input.motivo),
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
