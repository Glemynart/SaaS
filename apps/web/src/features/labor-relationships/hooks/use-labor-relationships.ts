import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laborRelationshipsApi } from '../services/labor-relationships-api';
import { contractualProfileKeys } from '@/features/contractual-profiles/hooks/use-contractual-profiles';

export const laborRelationshipKeys = {
  all: ['labor-relationships'] as const,
  lists: () => [...laborRelationshipKeys.all, 'list'] as const,
  list: (filters: { empleadoId?: string; activo?: boolean }) =>
    [...laborRelationshipKeys.lists(), filters] as const,
};

export function useLaborRelationships(params: { empleadoId?: string; activo?: boolean }) {
  return useQuery({
    queryKey: laborRelationshipKeys.list(params),
    queryFn: () => laborRelationshipsApi.getAll(params),
    enabled: Boolean(params.empleadoId),
  });
}

export function useCreateLaborRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: laborRelationshipsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laborRelationshipKeys.lists() });
    },
  });
}

export function useUpdateLaborRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: laborRelationshipsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: laborRelationshipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contractualProfileKeys.lists() });
    },
  });
}
