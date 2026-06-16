import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generatedDocumentsApi,
  type GetGeneratedDocumentsParams,
} from '../services/generated-documents-api';

export const generatedDocKeys = {
  all: ['generated-documents'] as const,
  lists: () => [...generatedDocKeys.all, 'list'] as const,
  list: (filters: GetGeneratedDocumentsParams) => [...generatedDocKeys.lists(), filters] as const,
  details: () => [...generatedDocKeys.all, 'detail'] as const,
  detail: (id: string) => [...generatedDocKeys.details(), id] as const,
};

export function useGeneratedDocuments(params: GetGeneratedDocumentsParams) {
  return useQuery({
    queryKey: generatedDocKeys.list(params),
    queryFn: () => generatedDocumentsApi.getAll(params),
  });
}

export function useGeneratedDocument(id: string) {
  return useQuery({
    queryKey: generatedDocKeys.detail(id),
    queryFn: () => generatedDocumentsApi.getById(id),
    enabled: !!id,
  });
}

export function useGenerateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generatedDocumentsApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generatedDocKeys.lists() });
    },
  });
}

export function useDeleteGeneratedDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generatedDocumentsApi.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: generatedDocKeys.lists() });
      queryClient.invalidateQueries({ queryKey: generatedDocKeys.detail(id) });
    },
  });
}

export function useGeneratePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => generatedDocumentsApi.generatePdf(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: generatedDocKeys.lists() });
      queryClient.invalidateQueries({ queryKey: generatedDocKeys.detail(data.id) });
    },
  });
}
