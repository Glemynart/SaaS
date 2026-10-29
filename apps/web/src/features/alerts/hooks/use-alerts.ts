import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../services/alerts-api';

export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...alertKeys.lists(), filters] as const,
  generationRuns: () => [...alertKeys.all, 'generation-runs'] as const,
  latestGenerationRun: () => [...alertKeys.generationRuns(), 'latest'] as const,
};

export function useAlerts(params?: {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
}) {
  return useQuery({
    queryKey: alertKeys.list(params ?? {}),
    queryFn: () => alertsApi.getAll(params),
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

export function useGenerateContractAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => alertsApi.generateContractAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

export function useGenerateMissingDocAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => alertsApi.generateMissingDocAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

export function useLatestAlertGenerationRun() {
  return useQuery({
    queryKey: alertKeys.latestGenerationRun(),
    queryFn: alertsApi.getLatestGenerationRun,
  });
}

export function useRetryAlertGenerationRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => alertsApi.retryGenerationRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.generationRuns() });
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}
