import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/payroll-api';
import type { EmployeeDisbursementSourceType } from '../services/payroll-api';

const disbursementKeys = {
  all: ['payroll', 'disbursements'] as const,
  obligations: (sourceType: EmployeeDisbursementSourceType, page: number) =>
    [...disbursementKeys.all, 'obligations', sourceType, page] as const,
  pending: (page: number) => [...disbursementKeys.all, 'pending', page] as const,
  summary: (sourceType: EmployeeDisbursementSourceType, sourceId: string) =>
    [...disbursementKeys.all, 'summary', sourceType, sourceId] as const,
};

export function useDisbursementObligations(
  sourceType: EmployeeDisbursementSourceType,
  page: number,
) {
  return useQuery({
    queryKey: disbursementKeys.obligations(sourceType, page),
    queryFn: () => payrollApi.getDisbursementObligations(sourceType, page),
  });
}

export function usePendingDisbursements(page: number) {
  return useQuery({
    queryKey: disbursementKeys.pending(page),
    queryFn: () => payrollApi.getPendingDisbursements(page),
  });
}

export function useDisbursementSummary(
  sourceType: EmployeeDisbursementSourceType | null,
  sourceId: string | null,
) {
  return useQuery({
    queryKey:
      sourceType && sourceId
        ? disbursementKeys.summary(sourceType, sourceId)
        : [...disbursementKeys.all, 'summary', 'none'],
    queryFn: () => payrollApi.getDisbursementSummary(sourceType!, sourceId!),
    enabled: Boolean(sourceType && sourceId),
  });
}

function useInvalidateDisbursements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: disbursementKeys.all });
}

export function useCreateEmployeeDisbursement() {
  const invalidate = useInvalidateDisbursements();
  return useMutation({ mutationFn: payrollApi.createDisbursement, onSettled: invalidate });
}

export function useAttachEmployeeDisbursementSupport() {
  const invalidate = useInvalidateDisbursements();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      payrollApi.attachDisbursementSupport(id, file),
    onSettled: invalidate,
  });
}

export function useVerifyEmployeeDisbursement() {
  const invalidate = useInvalidateDisbursements();
  return useMutation({ mutationFn: payrollApi.verifyDisbursement, onSettled: invalidate });
}

export function useCancelEmployeeDisbursement() {
  const invalidate = useInvalidateDisbursements();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      payrollApi.cancelDisbursement(id, reason),
    onSettled: invalidate,
  });
}

export function useReverseEmployeeDisbursement() {
  const invalidate = useInvalidateDisbursements();
  return useMutation({
    mutationFn: ({
      id,
      amount,
      reason,
      idempotencyKey,
    }: {
      id: string;
      amount: string;
      reason: string;
      idempotencyKey: string;
    }) => payrollApi.reverseDisbursement(id, { amount, reason, idempotencyKey }),
    onSettled: invalidate,
  });
}

export function useReconcileEmployeeDisbursements() {
  return useMutation({ mutationFn: payrollApi.reconcileDisbursementSupports });
}
