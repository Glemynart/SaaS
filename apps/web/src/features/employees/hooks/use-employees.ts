import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  employeesApi,
  type CreateSocialSecurityAffiliation,
  type GetEmployeesParams,
} from '../services/employees-api';

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters: GetEmployeesParams) => [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  socialSecurityAffiliations: (id: string) =>
    [...employeeKeys.details(), id, 'social-security-affiliations'] as const,
};

export function useEmployees(params: GetEmployeesParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => employeesApi.getAll(params),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeesApi.getById(id),
    enabled: !!id,
  });
}

export function useSocialSecurityAffiliations(id: string) {
  return useQuery({
    queryKey: employeeKeys.socialSecurityAffiliations(id),
    queryFn: () => employeesApi.getSocialSecurityAffiliations(id),
    enabled: !!id,
  });
}

export function useCreateSocialSecurityAffiliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeId: string; data: CreateSocialSecurityAffiliation }) =>
      employeesApi.createSocialSecurityAffiliation(input),
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.socialSecurityAffiliations(employeeId),
      });
    },
  });
}

export function useCloseSocialSecurityAffiliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.closeSocialSecurityAffiliation,
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.socialSecurityAffiliations(employeeId),
      });
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeesApi.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(data.id) });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeesApi.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
    },
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => employeesApi.importFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}
