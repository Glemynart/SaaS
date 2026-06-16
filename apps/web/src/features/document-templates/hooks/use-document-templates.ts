import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  documentTemplatesApi,
  type GetDocumentTemplatesParams,
} from '../services/document-templates-api';

export const templateKeys = {
  all: ['document-templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters: GetDocumentTemplatesParams) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

export function useDocumentTemplates(params: GetDocumentTemplatesParams) {
  return useQuery({
    queryKey: templateKeys.list(params),
    queryFn: () => documentTemplatesApi.getAll(params),
  });
}

export function useDocumentTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => documentTemplatesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentTemplatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useUpdateDocumentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentTemplatesApi.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(data.id) });
    },
  });
}

export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentTemplatesApi.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) });
    },
  });
}

export function useDuplicateDocumentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre?: string }) =>
      documentTemplatesApi.duplicate(id, nombre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useToggleDocumentTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentTemplatesApi.toggleActive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(data.id) });
    },
  });
}

export function useSeedDefaultTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => documentTemplatesApi.seedDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
