import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../services/users-api';
import type { CreateUserInvitationPayload } from '../services/users-api';

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
  invitations: () => [...userKeys.all, 'invitations'] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: usersApi.getAll,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: userKeys.invitations(),
    queryFn: usersApi.getInvitations,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.update,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.list() }),
  });
}

export function useCreateUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserInvitationPayload) => usersApi.createInvitation(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.invitations() }),
  });
}

export function useResendUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.resendInvitation(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKeys.invitations() }),
  });
}

export function useRevokeUserInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.invitations() }),
  });
}
