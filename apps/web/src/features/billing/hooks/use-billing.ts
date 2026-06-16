import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../services/billing-api';

export const billingKeys = {
  all: ['billing'],
  dashboard: () => [...billingKeys.all, 'dashboard'],
  customers: () => [...billingKeys.all, 'customers'],
  products: () => [...billingKeys.all, 'products'],
  invoices: () => [...billingKeys.all, 'invoices'],
};

export function useBillingDashboard() {
  return useQuery({ queryKey: billingKeys.dashboard(), queryFn: billingApi.getDashboard });
}
export function useCustomers(search?: string) {
  return useQuery({
    queryKey: [...billingKeys.customers(), search],
    queryFn: () => billingApi.getCustomers(search),
  });
}
export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.customers() }),
  });
}
export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Parameters<typeof billingApi.updateCustomer>[1]>;
    }) => billingApi.updateCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.customers() }),
  });
}
export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.deleteCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.customers() }),
  });
}
export function useProducts(search?: string) {
  return useQuery({
    queryKey: [...billingKeys.products(), search],
    queryFn: () => billingApi.getProducts(search),
  });
}
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.products() }),
  });
}
export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Parameters<typeof billingApi.updateProduct>[1]>;
    }) => billingApi.updateProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.products() }),
  });
}
export function useInvoices(status?: string) {
  return useQuery({
    queryKey: [...billingKeys.invoices(), status],
    queryFn: () => billingApi.getInvoices(status),
  });
}
export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.createInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
export function useInvoice(id: string) {
  return useQuery({
    queryKey: [...billingKeys.invoices(), id],
    queryFn: () => billingApi.getInvoice(id),
    enabled: !!id,
  });
}
export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      billingApi.updateInvoiceStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
