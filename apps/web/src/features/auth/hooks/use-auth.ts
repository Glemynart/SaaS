'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type { LoginPayload, RegisterPayload } from '@/types/auth';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authClient.me,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authClient.login(payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
      router.replace('/dashboard');
      router.refresh();
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authClient.register(payload),
    onSuccess: () => {
      router.replace('/login?registered=1');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: authClient.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    },
  });
}
