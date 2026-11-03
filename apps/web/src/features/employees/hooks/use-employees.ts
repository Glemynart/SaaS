import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  employeesApi,
  type CreateSocialSecurityAffiliation,
  type CreatePilaWorkAssignment,
  type CreatePilaWorkCenter,
  type CreatePilaWorkLocation,
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
  pilaWorkAssignments: (id: string) =>
    [...employeeKeys.details(), id, 'pila-work-assignments'] as const,
  pilaWorkLocations: (id: string) =>
    [...employeeKeys.details(), id, 'pila-work-locations'] as const,
  pilaWorkCenters: () => [...employeeKeys.all, 'pila-work-centers'] as const,
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

export function usePilaWorkCenters() {
  return useQuery({
    queryKey: employeeKeys.pilaWorkCenters(),
    queryFn: employeesApi.getPilaWorkCenters,
  });
}

export function usePilaWorkAssignments(id: string) {
  return useQuery({
    queryKey: employeeKeys.pilaWorkAssignments(id),
    queryFn: () => employeesApi.getPilaWorkAssignments(id),
    enabled: !!id,
  });
}

export function useCreatePilaWorkCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePilaWorkCenter) => employeesApi.createPilaWorkCenter(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.pilaWorkCenters() }),
  });
}

export function useCreatePilaWorkAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeId: string; data: CreatePilaWorkAssignment }) =>
      employeesApi.createPilaWorkAssignment(input),
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.pilaWorkAssignments(employeeId),
      });
    },
  });
}

export function useClosePilaWorkAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.closePilaWorkAssignment,
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.pilaWorkAssignments(employeeId),
      });
    },
  });
}

export function usePilaWorkLocations(id: string) {
  return useQuery({
    queryKey: employeeKeys.pilaWorkLocations(id),
    queryFn: () => employeesApi.getPilaWorkLocations(id),
    enabled: !!id,
  });
}

export function useCreatePilaWorkLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeId: string; data: CreatePilaWorkLocation }) =>
      employeesApi.createPilaWorkLocation(input),
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.pilaWorkLocations(employeeId),
      });
    },
  });
}

export function useClosePilaWorkLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.closePilaWorkLocation,
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: employeeKeys.pilaWorkLocations(employeeId),
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

export function useImportPilaAffiliations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeesApi.importPilaAffiliationsFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.details() });
    },
  });
}
