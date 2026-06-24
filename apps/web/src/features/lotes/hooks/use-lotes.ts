import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lotesApi, type GetLotesParams, type LoteEstado } from '../services/lotes-api';

const ACTIVE_STATES: LoteEstado[] = ['EN_PROCESO'];

export const loteKeys = {
  all: ['lotes'] as const,
  lists: () => [...loteKeys.all, 'list'] as const,
  list: (filters: GetLotesParams) => [...loteKeys.lists(), filters] as const,
  details: () => [...loteKeys.all, 'detail'] as const,
  detail: (id: string) => [...loteKeys.details(), id] as const,
  progress: (id: string) => [...loteKeys.all, 'progress', id] as const,
};

export function useLotes(params: GetLotesParams) {
  return useQuery({
    queryKey: loteKeys.list(params),
    queryFn: () => lotesApi.getAll(params),
  });
}

export function useLote(id: string) {
  return useQuery({
    queryKey: loteKeys.detail(id),
    queryFn: () => lotesApi.getById(id),
    enabled: !!id,
  });
}

export function useLoteProgress(id: string, estado: LoteEstado | undefined) {
  return useQuery({
    queryKey: loteKeys.progress(id),
    queryFn: () => lotesApi.getProgress(id),
    enabled: !!id && !!estado && ACTIVE_STATES.includes(estado),
    refetchInterval: 5_000,
  });
}

export function useCreateLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: lotesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: loteKeys.lists() }),
  });
}

export function useProcessLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: lotesApi.process,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: loteKeys.lists() });
      qc.invalidateQueries({ queryKey: loteKeys.detail(data.id) });
    },
  });
}

export function useRetryLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: lotesApi.retry,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: loteKeys.lists() });
      qc.invalidateQueries({ queryKey: loteKeys.detail(data.id) });
    },
  });
}
