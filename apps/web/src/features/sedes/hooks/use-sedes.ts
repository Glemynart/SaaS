import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sedesApi, type GetSedesParams } from '../services/sedes-api';

export const sedeKeys = {
  all: ['sedes'] as const,
  lists: () => [...sedeKeys.all, 'list'] as const,
  list: (filters: GetSedesParams) => [...sedeKeys.lists(), filters] as const,
  details: () => [...sedeKeys.all, 'detail'] as const,
  detail: (id: string) => [...sedeKeys.details(), id] as const,
};

export function useSedes(params: GetSedesParams) {
  return useQuery({
    queryKey: sedeKeys.list(params),
    queryFn: () => sedesApi.getAll(params),
  });
}

export function useSede(id: string) {
  return useQuery({
    queryKey: sedeKeys.detail(id),
    queryFn: () => sedesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateSede() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sedesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sedeKeys.lists() });
    },
  });
}

export function useUpdateSede() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sedesApi.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: sedeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sedeKeys.detail(data.id) });
    },
  });
}
