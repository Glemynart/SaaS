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
  status: string;
  fechaEmision: string;
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
export interface BillingDashboard {
  clientesActivos: number;
  facturasEmitidas: number;
  facturasBorrador: number;
  ingresosEstimados: number;
  totalFacturado: number;
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
    items: {
      descripcion: string;
      cantidad: number;
      valorUnitario: number;
      productServiceId?: string;
      porcentajeImpuesto: number;
    }[];
  }) => req<Invoice>('/api/billing/invoices', { method: 'POST', body: JSON.stringify(d) }),
  getInvoice: (id: string) => req<Invoice>(`/api/billing/invoices/${id}`),
  updateInvoiceStatus: (id: string, status: string, motivo?: string) =>
    req<Invoice>(`/api/billing/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(motivo ? { motivo } : {}) }),
    }),
};
