import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expedienteDocsApi } from '../services/expediente-docs-api';

export const expedienteDocKeys = {
  all: ['expediente-docs'] as const,
  byEmployee: (employeeId: string) => [...expedienteDocKeys.all, 'employee', employeeId] as const,
  detail: (id: string) => [...expedienteDocKeys.all, 'detail', id] as const,
  history: (id: string) => [...expedienteDocKeys.all, 'history', id] as const,
};

export function useExpedienteDocs(employeeId: string) {
  return useQuery({
    queryKey: expedienteDocKeys.byEmployee(employeeId),
    queryFn: () => expedienteDocsApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useExpedienteDocHistory(id: string) {
  return useQuery({
    queryKey: expedienteDocKeys.history(id),
    queryFn: () => expedienteDocsApi.getHistory(id),
    enabled: !!id,
  });
}

export function useDeleteExpedienteDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expedienteDocsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expedienteDocKeys.all });
    },
  });
}

export function useUploadExpedienteDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      file,
      categoria,
      familiaId,
    }: {
      employeeId: string;
      file: File;
      categoria: string;
      familiaId?: string | null;
    }) => expedienteDocsApi.uploadManual(employeeId, file, categoria, familiaId),
    onSuccess: (_document, variables) => {
      queryClient.invalidateQueries({
        queryKey: expedienteDocKeys.byEmployee(variables.employeeId),
      });
    },
  });
}
