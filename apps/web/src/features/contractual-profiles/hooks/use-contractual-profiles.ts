import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contractualProfilesApi,
  type GetContractualProfilesParams,
} from '../services/contractual-profiles-api';

export const contractualProfileKeys = {
  all: ['contractual-profiles'] as const,
  lists: () => [...contractualProfileKeys.all, 'list'] as const,
  list: (filters: GetContractualProfilesParams) =>
    [...contractualProfileKeys.lists(), filters] as const,
};

export function useContractualProfiles(params: GetContractualProfilesParams = {}) {
  return useQuery({
    queryKey: contractualProfileKeys.list(params),
    queryFn: () => contractualProfilesApi.getAll(params),
  });
}

export function useCreateContractualProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contractualProfilesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractualProfileKeys.lists() });
    },
  });
}

export function useUpdateContractualProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contractualProfilesApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractualProfileKeys.lists() });
    },
  });
}

export function useUpdateContractualProfileStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contractualProfilesApi.updateStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractualProfileKeys.lists() });
    },
  });
}
