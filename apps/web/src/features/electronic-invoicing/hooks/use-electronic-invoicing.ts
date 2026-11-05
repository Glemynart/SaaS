import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { electronicInvoicingApi } from '../services/electronic-invoicing-api';

const configurationKey = ['electronic-invoicing', 'configuration'] as const;

export function useElectronicInvoiceConfiguration() {
  return useQuery({
    queryKey: configurationKey,
    queryFn: electronicInvoicingApi.getConfiguration,
  });
}

export function useUpsertElectronicInvoiceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: electronicInvoicingApi.upsertProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configurationKey }),
  });
}

export function useCreateElectronicInvoiceRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: electronicInvoicingApi.createRange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configurationKey }),
  });
}

export function useDeactivateElectronicInvoiceRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      electronicInvoicingApi.deactivateRange(id, motivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configurationKey }),
  });
}
