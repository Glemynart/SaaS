import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { electronicInvoicingApi } from '../services/electronic-invoicing-api';

const configurationKey = ['electronic-invoicing', 'configuration'] as const;
const transmissionsKey = ['electronic-invoicing', 'transmissions'] as const;

export function useElectronicInvoiceConfiguration() {
  return useQuery({
    queryKey: configurationKey,
    queryFn: electronicInvoicingApi.getConfiguration,
  });
}

export function useRecentElectronicInvoiceTransmissions() {
  return useQuery({
    queryKey: transmissionsKey,
    queryFn: electronicInvoicingApi.getRecentTransmissions,
    staleTime: 30_000,
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
