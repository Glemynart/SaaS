import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeFilesApi } from '../services/employee-files-api';

export const employeeFileKeys = {
  all: ['employee-files'] as const,
  byEmployee: (employeeId: string) => [...employeeFileKeys.all, 'employee', employeeId] as const,
  detail: (id: string) => [...employeeFileKeys.all, 'detail', id] as const,
};

export function useEmployeeFiles(employeeId: string) {
  return useQuery({
    queryKey: employeeFileKeys.byEmployee(employeeId),
    queryFn: () => employeeFilesApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useDeleteEmployeeFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeFilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeFileKeys.all });
    },
  });
}
