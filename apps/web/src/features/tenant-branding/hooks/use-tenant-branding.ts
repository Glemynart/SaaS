import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantBrandingApi } from '../services/tenant-branding-api';

export const brandingKeys = {
  all: ['tenant-branding'] as const,
  detail: () => [...brandingKeys.all, 'detail'] as const,
};

export function useTenantBranding() {
  return useQuery({
    queryKey: brandingKeys.detail(),
    queryFn: () => tenantBrandingApi.get(),
  });
}

export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { representanteLegal?: string }) => tenantBrandingApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.detail() });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => tenantBrandingApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.detail() });
    },
  });
}

export function useUploadFirma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => tenantBrandingApi.uploadFirma(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.detail() });
    },
  });
}
