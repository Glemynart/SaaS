import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  documentProfileConfigurationsApi,
  type CreateDocumentProfileConfigurationInput,
  type UpdateDocumentProfileConfigurationInput,
} from '../services/document-profile-configurations-api';

export const documentProfileConfigurationKeys = {
  all: ['document-profile-configurations'] as const,
  list: () => [...documentProfileConfigurationKeys.all, 'list'] as const,
};

export function useDocumentProfileConfigurations() {
  return useQuery({
    queryKey: documentProfileConfigurationKeys.list(),
    queryFn: documentProfileConfigurationsApi.getAll,
  });
}

export function useCreateDocumentProfileConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentProfileConfigurationInput) =>
      documentProfileConfigurationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentProfileConfigurationKeys.all });
    },
  });
}

export function useUpdateDocumentProfileConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentProfileConfigurationInput }) =>
      documentProfileConfigurationsApi.update({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentProfileConfigurationKeys.all });
    },
  });
}
