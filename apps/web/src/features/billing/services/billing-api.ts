export interface Customer {
  id: string;
  razonSocial: string;
  nit: string;
  terceroId: string | null;
  tercero: {
    id: string;
    tipoDocumento: string;
    numeroDocumento: string;
    razonSocial: string | null;
    primerNombre: string | null;
    primerApellido: string | null;
    nombreComercial: string | null;
    esCliente: boolean;
    activo: boolean;
    deletedAt: string | null;
  } | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  status: string;
}
type DecimalValue = number | string;

export interface ProductService {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: DecimalValue;
  impuesto: DecimalValue;
  activo: boolean;
}
export interface InvoiceItem {
  id: string;
  productServiceId: string | null;
  descripcion: string;
  cantidad: DecimalValue;
  valorUnitario: DecimalValue;
  subtotal: DecimalValue;
  impuestoTarifa: DecimalValue | null;
  impuestoValor: DecimalValue | null;
}
export interface Invoice {
  id: string;
  customerId: string;
  numero: string;
  subtotal: DecimalValue;
  impuestos: DecimalValue;
  total: DecimalValue;
  status: string;
  fechaEmision: string;
  customer: { razonSocial: string; nit: string };
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
  createProduct: (d: Partial<ProductService>) =>
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
      impuesto?: number;
    }[];
  }) => req<Invoice>('/api/billing/invoices', { method: 'POST', body: JSON.stringify(d) }),
  getInvoice: (id: string) => req<Invoice>(`/api/billing/invoices/${id}`),
  updateInvoiceStatus: (id: string, status: string) =>
    req<Invoice>(`/api/billing/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
