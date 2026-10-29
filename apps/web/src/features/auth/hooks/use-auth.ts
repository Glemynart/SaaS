'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from '@/types/auth';

type ResetTokenValidation = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export function useResetTokenValidation(token: string, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    token: string;
    status: ResetTokenValidation;
  }>({ token: '', status: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    if (!token) {
      setResult({ token, status: 'invalid' });
      return;
    }

    let current = true;
    setResult({ token, status: 'checking' });
    void authClient
      .validateResetToken({ token })
      .then(({ valid }) => {
        if (current) setResult({ token, status: valid ? 'valid' : 'invalid' });
      })
      .catch(() => {
        if (current) setResult({ token, status: 'error' });
      });

    return () => {
      current = false;
    };
  }, [attempt, enabled, token]);

  const status = result.token === token ? result.status : token ? 'checking' : 'invalid';

  return {
    status,
    retry: () => setAttempt((current) => current + 1),
  };
}

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

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => authClient.forgotPassword(payload),
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => authClient.resetPassword(payload),
    onSuccess: () => {
      router.replace('/login?reset=1');
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
