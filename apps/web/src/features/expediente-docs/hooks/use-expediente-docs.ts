import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expedienteDocsApi } from '../services/expediente-docs-api';

export const expedienteDocKeys = {
  all: ['expediente-docs'] as const,
  byEmployee: (employeeId: string) => [...expedienteDocKeys.all, 'employee', employeeId] as const,
  detail: (id: string) => [...expedienteDocKeys.all, 'detail', id] as const,
};

export function useExpedienteDocs(employeeId: string) {
  return useQuery({
    queryKey: expedienteDocKeys.byEmployee(employeeId),
    queryFn: () => expedienteDocsApi.getByEmployee(employeeId),
    enabled: !!employeeId,
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
