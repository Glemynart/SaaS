export interface Customer {
  id: string;
  razonSocial: string;
  nit: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  status: string;
  terceroId: string | null;
}
export interface ProductService {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  impuesto: number;
  activo: boolean;
}
export interface InvoiceItem {
  id: string;
  productServiceId: string | null;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
  porcentajeImpuesto: number | null;
  valorImpuesto: number | null;
}
export interface LedgerVoucher {
  id: string;
  numero: number | null;
  estado: string;
  totalDebito: number;
  totalCredito: number;
  tipoComprobante: { codigo: string; nombre: string };
  movimientos: {
    linea: number;
    debito: number;
    credito: number;
    descripcion: string | null;
    cuenta: { codigo: string; nombre: string };
  }[];
  reversos: { id: string; numero: number | null; estado: string }[];
}
export interface Invoice {
  id: string;
  customerId: string;
  numero: string;
  subtotal: number;
  impuestos: number;
  total: number;
  totalPagado?: number | null;
  saldoPendiente?: number | null;
  status: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  customer: { razonSocial: string; nit: string };
  customerRazonSocialSnapshot: string | null;
  customerNitSnapshot: string | null;
  terceroId: string | null;
  terceroRazonSocialSnapshot: string | null;
  terceroNumeroDocumentoSnapshot: string | null;
  comprobanteContable?: LedgerVoucher | null;
  items?: InvoiceItem[];
  _count?: { items: number };
}
export interface CustomerReceivableInvoice {
  id: string;
  numero: string;
  total: number | string;
  totalPagado: number | string;
  saldoPendiente: number | string;
  fechaVencimiento: string | null;
}
export type CustomerReceiptMethod = 'EFECTIVO' | 'TRANSFERENCIA';
export interface InvoiceReceiptApplication {
  id: string;
  amount: number;
  receipt: {
    id: string;
    fechaRecibo: string;
    medio: CustomerReceiptMethod;
    referencia: string | null;
    monto: number;
    aplicaciones: Array<{
      invoiceId: string;
      numero: string;
      amount: number | string;
    }>;
    reversal: { id: string; reason: string; createdAt: string } | null;
    registradoPorId: string;
  };
  comprobanteContable: LedgerVoucher | null;
}
export interface BillingDashboard {
  clientesActivos: number;
  facturasEmitidas: number;
  facturasBorrador: number;
  ingresosEstimados: number;
  totalFacturado: number;
  totalRecaudado: number;
  carteraPendiente: number;
}

type ApiEnvelope = { message?: string };
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const b = (await r.json().catch(() => ({}))) as ApiEnvelope;
  if (!r.ok) throw new Error(b.message ?? 'Error');
  return b as T;
}

export const billingApi = {
  getDashboard: () => req<BillingDashboard>('/api/billing/dashboard'),
  getCustomers: (search?: string) =>
    req<Customer[]>(`/api/billing/customers${search ? `?search=${search}` : ''}`),
  createCustomer: (d: Partial<Customer>) =>
    req<Customer>('/api/billing/customers', { method: 'POST', body: JSON.stringify(d) }),
  updateCustomer: (id: string, d: Partial<Customer>) =>
    req<Customer>(`/api/billing/customers/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteCustomer: (id: string) =>
    req<Customer>(`/api/billing/customers/${id}`, { method: 'DELETE' }),
  getProducts: (search?: string) =>
    req<ProductService[]>(`/api/billing/products${search ? `?search=${search}` : ''}`),
  createProduct: (d: { nombre: string; descripcion?: string; precio: number; impuesto: number }) =>
    req<ProductService>('/api/billing/products', { method: 'POST', body: JSON.stringify(d) }),
  updateProduct: (id: string, d: Partial<ProductService>) =>
    req<ProductService>(`/api/billing/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    }),
  getInvoices: (status?: string) =>
    req<Invoice[]>(`/api/billing/invoices${status ? `?status=${status}` : ''}`),
  createInvoice: (d: {
    customerId: string;
    numero: string;
    fechaVencimiento: string;
    items: {
      descripcion: string;
      cantidad: number;
      valorUnitario: number;
      productServiceId?: string;
      porcentajeImpuesto: number;
    }[];
  }) => req<Invoice>('/api/billing/invoices', { method: 'POST', body: JSON.stringify(d) }),
  getInvoice: (id: string) => req<Invoice>(`/api/billing/invoices/${id}`),
  getCustomerReceivableInvoices: (customerId: string) =>
    req<CustomerReceivableInvoice[]>(
      `/api/billing/customers/${encodeURIComponent(customerId)}/receivable-invoices`,
    ),
  getInvoiceReceiptApplications: (id: string) =>
    req<InvoiceReceiptApplication[]>(`/api/billing/invoices/${id}/receipts`),
  createCustomerReceipt: (d: {
    customerId: string;
    fechaRecibo: string;
    medio: CustomerReceiptMethod;
    referencia?: string;
    monto: number;
    idempotencyKey: string;
    aplicaciones: { invoiceId: string; amount: number }[];
  }) => req('/api/billing/receipts', { method: 'POST', body: JSON.stringify(d) }),
  reverseCustomerReceipt: (id: string, reason: string) =>
    req(`/api/billing/receipts/${id}/reversal`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  updateInvoiceStatus: (id: string, status: string, motivo?: string) =>
    req<Invoice>(`/api/billing/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(motivo ? { motivo } : {}) }),
    }),
};
