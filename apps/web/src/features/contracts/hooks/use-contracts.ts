import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi, type GetContractsParams } from '../services/contracts-api';

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (filters: GetContractsParams) => [...contractKeys.lists(), filters] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
};

export function useContracts(params: GetContractsParams) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => contractsApi.getAll(params),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contractsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.lists() }),
  });
}

export function useUpdateContractStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      contractsApi.updateStatus(id, estado),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      qc.invalidateQueries({ queryKey: contractKeys.detail(data.id) });
    },
  });
}

export function useGenerateContractDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, templateId }: { id: string; templateId?: string }) =>
      contractsApi.generateDocument(id, templateId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      qc.invalidateQueries({ queryKey: contractKeys.detail(id) });
    },
  });
}
