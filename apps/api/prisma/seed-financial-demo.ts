import { createHash } from 'node:crypto';
import {
  ClaseContable,
  EstadoPeriodo,
  NaturalezaContable,
  PayrollPeriodStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { BillingService } from '../src/billing/billing.service';
import { LedgerService } from '../src/accounting/ledger/ledger.service';
import { DEFAULT_SYSTEM_ACCOUNT_MAPPINGS } from '../src/accounting/provisioning/system-account-mappings';
import {
  PAYROLL_ACCOUNTING_REQUIRED_ROLES,
  PayrollAccountingPreflightService,
} from '../src/payroll/accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from '../src/payroll/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextBoundary } from '../src/tenant-context/tenant-context.boundary';
import { TenantContextService } from '../src/tenant-context/tenant-context.service';
import { TenantPrismaService } from '../src/tenant-prisma/tenant-prisma.service';
import {
  CLASE_BY_DIGIT,
  NATURALEZA_BY_DIGIT,
  PUC_TEMPLATE,
  nivelOf,
  parentCodigoOf,
} from './seed-data/accounting-c0';

const DEMO_NAMESPACE = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
const PAYROLL_ACCOUNT_ROLES = new Set<string>(
  PAYROLL_ACCOUNTING_REQUIRED_ROLES,
);
const INVOICE_ACCOUNT_ROLES = new Set([
  'CLIENTES_NACIONALES',
  'INGRESOS_OPERACIONALES',
  'IVA_GENERADO',
]);

const DEMO_CUSTOMERS = [
  {
    key: 'customer-horizonte',
    nit: 'DEMO-NIT-001',
    razonSocial: 'DEMO Colegio Horizonte',
    email: 'contacto@horizonte.example.test',
  },
  {
    key: 'customer-aula',
    nit: 'DEMO-NIT-002',
    razonSocial: 'DEMO Fundación Aula Abierta',
    email: 'contacto@aula.example.test',
  },
] as const;

const DEMO_PRODUCTS = [
  {
    key: 'product-training',
    nombre: 'DEMO Servicio de capacitación',
    descripcion: 'Servicio sintético para recorridos de demostración.',
    precio: 120_000,
  },
  {
    key: 'product-support',
    nombre: 'DEMO Soporte administrativo',
    descripcion: 'Servicio sintético para recorridos de demostración.',
    precio: 250_000,
  },
  {
    key: 'product-consulting',
    nombre: 'DEMO Consultoría',
    descripcion: 'Servicio sintético para recorridos de demostración.',
    precio: 600_000,
  },
] as const;

type CreatedCounts = {
  customers: number;
  products: number;
  invoices: number;
  invoiceItems: number;
  employees: number;
  thirdParties: number;
  costCenters: number;
  payrollPeriods: number;
  payrollRuns: number;
  payrollSnapshots: number;
  accountingPeriods: number;
  accounts: number;
  accountMaps: number;
};

export type FinancialDemoSeedResult = {
  tenantId: string;
  payrollPeriodId: string;
  comprobanteId: string;
  status: 'CAUSADA' | 'YA_CAUSADA';
  created: CreatedCounts;
};

function demoId(tenantId: string, key: string): string {
  const digest = createHash('sha1')
    .update(DEMO_NAMESPACE)
    .update(`la-oficina-nitida:financial-demo:${tenantId}:${key}`)
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertTenant<T extends { tenantId: string }>(
  row: T | null,
  tenantId: string,
  description: string,
): asserts row is T {
  if (row && row.tenantId !== tenantId) {
    throw new Error(
      `El registro ${description} no pertenece al tenant solicitado.`,
    );
  }
}

function assertLocalDemoSeedTarget(tenantId: string): void {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
    throw new Error(
      'El seed financiero solo se ejecuta con NODE_ENV=development o test.',
    );
  }
  if (process.env.FINANCIAL_DEMO_SEED_TENANT_ID !== tenantId) {
    throw new Error(
      'FINANCIAL_DEMO_SEED_TENANT_ID debe coincidir exactamente con --tenant-id.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatorio.');
  let databaseHost: string;
  try {
    databaseHost = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, '');
  } catch {
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL válida.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error(
      'El seed financiero solo admite una base PostgreSQL local.',
    );
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isSyntheticPayrollSnapshot(payload: Prisma.JsonValue): boolean {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return false;
  }
  const demo = payload.demo;
  return (
    typeof demo === 'object' &&
    demo !== null &&
    !Array.isArray(demo) &&
    demo.synthetic === true &&
    demo.operational === false
  );
}

function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

function nextMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function colombiaBusinessDate(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((value) => value.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

async function ensureSystemAccountMappings(
  tx: Prisma.TransactionClient,
  tenantId: string,
  created: CreatedCounts,
  requiredRoles: ReadonlySet<string>,
): Promise<void> {
  const roles = [...requiredRoles];
  const mappings = DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.filter((mapping) =>
    requiredRoles.has(mapping.rol),
  );
  const existingMaps = await tx.cuentaSistemaMap.findMany({
    where: { tenantId, rol: { in: roles } },
    select: { rol: true, cuentaId: true, activo: true },
  });
  const mapsByRole = new Map(
    existingMaps.map((mapping) => [mapping.rol, mapping]),
  );

  for (const mapping of existingMaps) {
    const account = await tx.cuentaContable.findFirst({
      where: { id: mapping.cuentaId, tenantId },
      select: { id: true, activa: true, imputable: true, deletedAt: true },
    });
    if (
      !mapping.activo ||
      !account ||
      !account.activa ||
      !account.imputable ||
      account.deletedAt
    ) {
      throw new Error(
        `El mapeo contable ${mapping.rol} existe pero no está disponible. Corrige la configuración antes de cargar la demo.`,
      );
    }
  }

  const missingMappings = mappings.filter(
    (mapping) => !mapsByRole.has(mapping.rol),
  );
  const templateByCode = new Map(
    PUC_TEMPLATE.map((node) => [node.codigo, node]),
  );
  const neededCodes = new Set<string>();

  for (const mapping of missingMappings) {
    let code: string | null = mapping.codigo;
    while (code) {
      if (!templateByCode.has(code)) {
        throw new Error(
          `La plantilla PUC no contiene la cuenta requerida ${code}.`,
        );
      }
      neededCodes.add(code);
      code = parentCodigoOf(code);
    }
  }

  const orderedNodes = [...neededCodes]
    .map((code) => templateByCode.get(code)!)
    .sort(
      (left, right) =>
        left.codigo.length - right.codigo.length ||
        left.codigo.localeCompare(right.codigo),
    );
  const accountIdByCode = new Map<string, string>();

  for (const node of orderedNodes) {
    const existing = await tx.cuentaContable.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: node.codigo } },
      select: { id: true, activa: true, imputable: true, deletedAt: true },
    });
    if (existing) {
      if (!existing.activa || existing.deletedAt) {
        throw new Error(
          `La cuenta PUC ${node.codigo} existe inactiva; no se modificó.`,
        );
      }
      accountIdByCode.set(node.codigo, existing.id);
      continue;
    }

    const parentCode = parentCodigoOf(node.codigo);
    const digit = node.codigo[0];
    const account = await tx.cuentaContable.create({
      data: {
        id: demoId(tenantId, `account-${node.codigo}`),
        tenantId,
        codigo: node.codigo,
        nombre: node.nombre,
        claseContable: CLASE_BY_DIGIT[digit] as ClaseContable,
        naturaleza: NATURALEZA_BY_DIGIT[digit] as NaturalezaContable,
        nivel: nivelOf(node.codigo),
        cuentaPadreId: parentCode
          ? (accountIdByCode.get(parentCode) ?? null)
          : null,
        imputable: node.imputable ?? false,
        esCuentaSistema: node.sistema ?? false,
        requiereTercero: node.requiereTercero ?? false,
        requiereCentroCosto: node.requiereCentroCosto ?? false,
        requiereBase: node.requiereBase ?? false,
      },
      select: { id: true },
    });
    accountIdByCode.set(node.codigo, account.id);
    created.accounts += 1;
  }

  for (const mapping of missingMappings) {
    const accountId = accountIdByCode.get(mapping.codigo);
    if (!accountId) {
      const existingAccount = await tx.cuentaContable.findUnique({
        where: {
          tenantId_codigo: { tenantId, codigo: mapping.codigo },
        },
        select: { id: true, activa: true, imputable: true, deletedAt: true },
      });
      if (
        !existingAccount ||
        !existingAccount.activa ||
        !existingAccount.imputable ||
        existingAccount.deletedAt
      ) {
        throw new Error(`No se pudo resolver la cuenta PUC ${mapping.codigo}.`);
      }
      accountIdByCode.set(mapping.codigo, existingAccount.id);
    }

    await tx.cuentaSistemaMap.create({
      data: {
        id: demoId(tenantId, `account-map-${mapping.rol}`),
        tenantId,
        rol: mapping.rol,
        cuentaId: accountIdByCode.get(mapping.codigo)!,
        descripcion: mapping.descripcion,
      },
    });
    created.accountMaps += 1;
  }
}

async function requireVoucherType(
  tx: Prisma.TransactionClient,
  codigo: 'NOM' | 'FV',
): Promise<void> {
  const existing = await tx.tipoComprobante.findUnique({
    where: { codigo },
    select: { id: true, activo: true },
  });
  if (existing) {
    if (!existing.activo) {
      throw new Error(
        'El tipo global de comprobante ' + codigo + ' está inactivo.',
      );
    }
    return;
  }
  throw new Error(
    'No existe el tipo global de comprobante ' +
      codigo +
      '; ejecuta primero la configuración base de la aplicación.',
  );
}

async function ensureOpenAccountingPeriod(
  tx: Prisma.TransactionClient,
  tenantId: string,
  created: CreatedCounts,
) {
  const today = colombiaBusinessDate(new Date());
  let year = today.getUTCFullYear();
  let month = today.getUTCMonth() + 1;

  const periodContainingToday = await tx.periodoContable.findFirst({
    where: {
      tenantId,
      estado: EstadoPeriodo.ABIERTO,
      fechaInicio: { lte: today },
      fechaFin: { gte: today },
    },
    orderBy: [{ fechaInicio: 'asc' }, { createdAt: 'asc' }],
  });
  if (periodContainingToday) return periodContainingToday;

  for (let offset = 0; offset < 36; offset += 1) {
    const existing = await tx.periodoContable.findUnique({
      where: { tenantId_anio_mes: { tenantId, anio: year, mes: month } },
    });
    if (existing?.estado === EstadoPeriodo.ABIERTO) return existing;
    if (!existing) {
      const createdPeriod = await tx.periodoContable.create({
        data: {
          id: demoId(tenantId, `accounting-period-${year}-${month}`),
          tenantId,
          anio: year,
          mes: month,
          fechaInicio: monthStart(year, month),
          fechaFin: monthEnd(year, month),
          estado: EstadoPeriodo.ABIERTO,
        },
      });
      created.accountingPeriods += 1;
      return createdPeriod;
    }
    ({ year, month } = nextMonth(year, month));
  }

  throw new Error(
    'No se encontró un período contable abierto en los próximos 36 meses.',
  );
}

async function ensureCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  customer: (typeof DEMO_CUSTOMERS)[number],
  created: CreatedCounts,
): Promise<string> {
  const id = demoId(tenantId, customer.key);
  const existing = await tx.customer.findUnique({ where: { id } });
  assertTenant(existing, tenantId, customer.key);
  if (existing) return id;

  const sameNit = await tx.customer.findUnique({
    where: { tenantId_nit: { tenantId, nit: customer.nit } },
    select: { id: true },
  });
  if (sameNit) {
    throw new Error(
      `El NIT sintético ${customer.nit} ya pertenece a otro cliente; no se modificó.`,
    );
  }

  await tx.customer.create({
    data: {
      id,
      tenantId,
      nit: customer.nit,
      razonSocial: customer.razonSocial,
      email: customer.email,
      status: 'ACTIVE',
    },
  });
  created.customers += 1;
  return id;
}

async function ensureCustomerThirdParty(
  tx: Prisma.TransactionClient,
  tenantId: string,
  customerId: string,
  customer: (typeof DEMO_CUSTOMERS)[number],
  created: CreatedCounts,
): Promise<void> {
  const customerRow = await tx.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { terceroId: true },
  });
  if (!customerRow) {
    throw new Error(
      'No existe el cliente demo ' + customer.key + ' en el tenant.',
    );
  }

  if (customerRow.terceroId) {
    const linkedThirdParty = await tx.tercero.findFirst({
      where: {
        id: customerRow.terceroId,
        tenantId,
        tipoDocumento: 'NIT',
        numeroDocumento: customer.nit,
        esCliente: true,
        activo: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!linkedThirdParty) {
      throw new Error(
        'El cliente demo ' +
          customer.key +
          ' tiene un tercero contable distinto o no disponible; no se modificó.',
      );
    }
    return;
  }

  const id = demoId(tenantId, customer.key + '-third-party');
  const existing = await tx.tercero.findUnique({ where: { id } });
  assertTenant(existing, tenantId, customer.key + ' third party');
  if (existing) {
    if (
      existing.tipoDocumento !== 'NIT' ||
      existing.numeroDocumento !== customer.nit ||
      !existing.esCliente ||
      !existing.activo ||
      existing.deletedAt
    ) {
      throw new Error(
        'El tercero sintético de ' +
          customer.key +
          ' existe con datos incompatibles; no se modificó.',
      );
    }
  } else {
    const documentCollision = await tx.tercero.findUnique({
      where: {
        tenantId_tipoDocumento_numeroDocumento: {
          tenantId,
          tipoDocumento: 'NIT',
          numeroDocumento: customer.nit,
        },
      },
      select: { id: true },
    });
    if (documentCollision) {
      throw new Error(
        'El documento sintético ' +
          customer.nit +
          ' ya pertenece a otro tercero; no se vinculó automáticamente.',
      );
    }
    await tx.tercero.create({
      data: {
        id,
        tenantId,
        tipoDocumento: 'NIT',
        numeroDocumento: customer.nit,
        tipoPersona: 'JURIDICA',
        razonSocial: customer.razonSocial,
        email: customer.email,
        esCliente: true,
        activo: true,
      },
    });
    created.thirdParties += 1;
  }

  const linked = await tx.customer.updateMany({
    where: { id: customerId, tenantId, terceroId: null },
    data: { terceroId: id },
  });
  if (linked.count !== 1) {
    throw new Error(
      'El vínculo contable de ' +
        customer.key +
        ' cambió durante la carga; vuelve a ejecutarla.',
    );
  }
}

async function ensureProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  product: (typeof DEMO_PRODUCTS)[number],
  created: CreatedCounts,
): Promise<string> {
  const id = demoId(tenantId, product.key);
  const existing = await tx.productService.findUnique({ where: { id } });
  assertTenant(existing, tenantId, product.key);
  if (existing) return id;

  const sameName = await tx.productService.findFirst({
    where: { tenantId, nombre: product.nombre },
    select: { id: true },
  });
  if (sameName) {
    throw new Error(
      `El producto ${product.nombre} ya existe con otro identificador; no se modificó.`,
    );
  }

  await tx.productService.create({
    data: {
      id,
      tenantId,
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: product.precio,
      impuesto: 19,
      activo: true,
    },
  });
  created.products += 1;
  return id;
}

async function ensureInvoice(
  tx: Prisma.TransactionClient,
  tenantId: string,
  invoice: {
    key: string;
    numero: string;
    customerId: string;
    status: 'DRAFT';
    fechaEmision: Date;
    items: Array<{
      key: string;
      productServiceId: string;
      descripcion: string;
      cantidad: number;
      valorUnitario: number;
    }>;
  },
  created: CreatedCounts,
): Promise<void> {
  const id = demoId(tenantId, invoice.key);
  const existing = await tx.invoice.findUnique({ where: { id } });
  assertTenant(existing, tenantId, invoice.key);
  if (existing) return;

  const sameNumber = await tx.invoice.findFirst({
    where: { tenantId, numero: invoice.numero },
    select: { id: true },
  });
  if (sameNumber) {
    throw new Error(
      `El número de factura sintético ${invoice.numero} ya está ocupado; no se modificó.`,
    );
  }

  const customer = await tx.customer.findFirst({
    where: { id: invoice.customerId, tenantId, status: 'ACTIVE' },
  });
  if (!customer) {
    throw new Error('El cliente sintético debe existir y estar activo.');
  }
  const productIds = [
    ...new Set(invoice.items.map((item) => item.productServiceId)),
  ];
  const products = await tx.productService.findMany({
    where: { tenantId, id: { in: productIds }, activo: true },
    select: { id: true, impuesto: true },
  });
  if (products.length !== productIds.length) {
    throw new Error(
      'Cada línea sintética debe usar un producto activo del tenant.',
    );
  }
  const productRate = new Map(
    products.map((product) => [product.id, Number(product.impuesto)]),
  );
  const items = invoice.items.map((item) => {
    const porcentajeImpuesto = productRate.get(item.productServiceId);
    if (
      porcentajeImpuesto === undefined ||
      ![0, 5, 19].includes(porcentajeImpuesto)
    ) {
      throw new Error(
        'El producto sintético debe tener IVA configurado como 0, 5 o 19.',
      );
    }
    const subtotal = roundCurrency(item.cantidad * item.valorUnitario);
    return {
      id: demoId(tenantId, item.key),
      productServiceId: item.productServiceId,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      valorUnitario: item.valorUnitario,
      subtotal,
      porcentajeImpuesto,
      valorImpuesto: roundCurrency((subtotal * porcentajeImpuesto) / 100),
    };
  });
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.subtotal), 0),
  );
  const impuestos = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.valorImpuesto), 0),
  );

  await tx.invoice.create({
    data: {
      id,
      tenantId,
      customerId: invoice.customerId,
      customerRazonSocialSnapshot: customer.razonSocial,
      customerNitSnapshot: customer.nit,
      numero: invoice.numero,
      subtotal,
      impuestos,
      total: roundCurrency(subtotal + impuestos),
      status: invoice.status,
      fechaEmision: invoice.fechaEmision,
      items: { create: items },
    },
  });
  created.invoices += 1;
  created.invoiceItems += items.length;
}

function periodLabel(fechaFin: Date): string {
  const month = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    timeZone: 'UTC',
  }).format(fechaFin);
  return `DEMO Nómina ${month} ${fechaFin.getUTCFullYear()}`;
}

async function ensurePayrollThirdParty(
  tx: Prisma.TransactionClient,
  tenantId: string,
  created: CreatedCounts,
): Promise<void> {
  const existing = await tx.tercero.findUnique({
    where: {
      tenantId_tipoDocumento_numeroDocumento: {
        tenantId,
        tipoDocumento: 'CC',
        numeroDocumento: 'DEMO-EMP-001',
      },
    },
  });
  assertTenant(existing, tenantId, 'payroll third party');
  if (existing) {
    if (!existing.activo || existing.deletedAt || !existing.esEmpleado) {
      throw new Error(
        'El tercero de la persona sintética existe, pero no está activo como empleado; no se modificó.',
      );
    }
    return;
  }

  const id = demoId(tenantId, 'payroll-third-party');
  const collision = await tx.tercero.findUnique({ where: { id } });
  assertTenant(collision, tenantId, 'payroll third-party identifier');
  if (collision) {
    throw new Error(
      'El identificador del tercero demo está ocupado por otro registro; no se modificó.',
    );
  }

  await tx.tercero.create({
    data: {
      id,
      tenantId,
      tipoDocumento: 'CC',
      numeroDocumento: 'DEMO-EMP-001',
      tipoPersona: 'NATURAL',
      primerNombre: 'Ana',
      segundoNombre: 'Demo',
      primerApellido: 'Pérez',
      esEmpleado: true,
      email: 'ana.demo@example.test',
    },
  });
  created.thirdParties += 1;
}

async function ensurePayrollCostCenter(
  tx: Prisma.TransactionClient,
  tenantId: string,
  created: CreatedCounts,
): Promise<string> {
  const id = demoId(tenantId, 'payroll-cost-center');
  const existing = await tx.centroCosto.findUnique({ where: { id } });
  assertTenant(existing, tenantId, 'payroll cost center');
  if (existing) {
    if (
      existing.codigo !== 'DEMO-NOMINA' ||
      !existing.activo ||
      existing.deletedAt
    ) {
      throw new Error(
        'El centro de costo sintético existe, pero no está disponible; no se modificó.',
      );
    }
    return id;
  }

  const sameCode = await tx.centroCosto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: 'DEMO-NOMINA' } },
    select: { id: true },
  });
  if (sameCode) {
    throw new Error(
      'El código del centro de costo sintético ya está ocupado; no se modificó.',
    );
  }

  await tx.centroCosto.create({
    data: {
      id,
      tenantId,
      codigo: 'DEMO-NOMINA',
      nombre: 'DEMO Nómina',
    },
  });
  created.costCenters += 1;
  return id;
}

async function ensurePayrollData(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  accountingPeriod: { fechaInicio: Date; fechaFin: Date },
  existingPeriod: { id: string; status: PayrollPeriodStatus } | null,
  created: CreatedCounts,
): Promise<string> {
  const employeeId = demoId(tenantId, 'payroll-employee');
  const periodId = demoId(tenantId, 'payroll-period');
  const runId = demoId(tenantId, 'payroll-run');
  const snapshotId = demoId(tenantId, 'payroll-snapshot');

  const existingEmployee = await tx.empleado.findUnique({
    where: { id: employeeId },
  });
  assertTenant(existingEmployee, tenantId, 'payroll employee');
  if (
    existingEmployee &&
    (existingEmployee.cedula !== 'DEMO-EMP-001' ||
      existingEmployee.tipoDocumento !== 'CC')
  ) {
    throw new Error(
      'El empleado sintético existe con otra identidad documental; no se modificó.',
    );
  }
  if (!existingEmployee) {
    if (existingPeriod) {
      throw new Error(
        'El período sintético existe sin su empleado asociado; no se modificó.',
      );
    }
    const sameDocument = await tx.empleado.findUnique({
      where: { tenantId_cedula: { tenantId, cedula: 'DEMO-EMP-001' } },
      select: { id: true },
    });
    if (sameDocument) {
      throw new Error(
        'La cédula sintética DEMO-EMP-001 ya está ocupada; no se modificó.',
      );
    }
    await tx.empleado.create({
      data: {
        id: employeeId,
        tenantId,
        cedula: 'DEMO-EMP-001',
        tipoDocumento: 'CC',
        primerNombre: 'Ana',
        segundoNombre: 'Demo',
        primerApellido: 'Pérez',
        email: 'ana.demo@example.test',
        cargo: 'Cargo sintético de demostración',
        salario: new Prisma.Decimal(1_000_000),
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        estado: 'ACTIVO',
      },
    });
    created.employees += 1;
  }

  await ensurePayrollThirdParty(tx, tenantId, created);
  const costCenterId = existingPeriod
    ? demoId(tenantId, 'payroll-cost-center')
    : await ensurePayrollCostCenter(tx, tenantId, created);

  if (existingPeriod) {
    if (
      existingPeriod.status !== PayrollPeriodStatus.APROBADA &&
      existingPeriod.status !== PayrollPeriodStatus.CAUSADA
    ) {
      throw new Error(
        `El período sintético ya existe en estado ${existingPeriod.status}; no se cambió.`,
      );
    }
    return periodId;
  }

  const sameName = await tx.payrollPeriod.findFirst({
    where: { tenantId, nombre: periodLabel(accountingPeriod.fechaFin) },
    select: { id: true },
  });
  if (sameName) {
    throw new Error(
      'Ya existe un período con el nombre sintético de la demo y otro identificador; no se modificó.',
    );
  }

  await tx.payrollPeriod.create({
    data: {
      id: periodId,
      tenantId,
      nombre: periodLabel(accountingPeriod.fechaFin),
      fechaInicio: accountingPeriod.fechaInicio,
      fechaFin: accountingPeriod.fechaFin,
      status: PayrollPeriodStatus.APROBADA,
      aprobadoPorId: actorId,
      aprobadoEn: accountingPeriod.fechaFin,
    },
  });
  created.payrollPeriods += 1;

  await tx.payrollRun.create({
    data: {
      id: runId,
      tenantId,
      payrollPeriodId: periodId,
      employeeId,
      centroCostoId: costCenterId,
      totalDevengos: new Prisma.Decimal(1_000_000),
      totalDeducciones: new Prisma.Decimal(80_000),
      netoPagar: new Prisma.Decimal(920_000),
      totalAportesPatronales: new Prisma.Decimal(0),
      totalProvisiones: new Prisma.Decimal(0),
      salarioBaseSnapshot: new Prisma.Decimal(1_000_000),
      concepts: {
        create: [
          {
            id: demoId(tenantId, 'payroll-concept-salary'),
            codigo: 'SALARIO_BASE',
            tipo: 'EARNING',
            nombre: 'Salario base sintético',
            valor: new Prisma.Decimal(1_000_000),
          },
          {
            id: demoId(tenantId, 'payroll-concept-health'),
            codigo: 'SALUD_EMP',
            tipo: 'DEDUCTION',
            nombre: 'Salud empleado sintética',
            valor: new Prisma.Decimal(40_000),
          },
          {
            id: demoId(tenantId, 'payroll-concept-pension'),
            codigo: 'PENSION_EMP',
            tipo: 'DEDUCTION',
            nombre: 'Pensión empleado sintética',
            valor: new Prisma.Decimal(40_000),
          },
        ],
      },
    },
  });
  created.payrollRuns += 1;

  const snapshotPayload = {
    demo: {
      synthetic: true,
      operational: false,
      note: 'Datos de demostración; no usar para liquidación laboral real.',
    },
    employee: { salarioBaseUsado: 1_000_000 },
    concepts: [
      { codigo: 'SALARIO_BASE', valor: 1_000_000 },
      { codigo: 'SALUD_EMP', valor: 40_000 },
      { codigo: 'PENSION_EMP', valor: 40_000 },
    ],
  } satisfies Prisma.InputJsonValue;

  await tx.payrollSnapshot.create({
    data: {
      id: snapshotId,
      tenantId,
      payrollRunId: runId,
      payrollPeriodId: periodId,
      employeeId,
      centroCostoId: costCenterId,
      estadoPeriodo: PayrollPeriodStatus.APROBADA,
      origen: 'FINANCIAL_DEMO_SEED',
      payloadVersion: 1,
      payload: snapshotPayload,
      aprobadoPorId: actorId,
    },
  });
  created.payrollSnapshots += 1;
  return periodId;
}

/**
 * Adds deterministic, tenant-scoped synthetic billing and payroll data. It
 * never deletes or overwrites existing seed rows; new payroll data is posted
 * through the regular service, which changes its approved period to CAUSADA.
 * The target guard restricts use to a local development or test database.
 */
export async function seedFinancialDemoScenario(
  tenantId: string,
  actorId: string,
): Promise<FinancialDemoSeedResult> {
  assertLocalDemoSeedTarget(tenantId);
  const prisma = new PrismaService();
  await prisma.$connect();

  const created: CreatedCounts = {
    customers: 0,
    products: 0,
    invoices: 0,
    invoiceItems: 0,
    employees: 0,
    thirdParties: 0,
    costCenters: 0,
    payrollPeriods: 0,
    payrollRuns: 0,
    payrollSnapshots: 0,
    accountingPeriods: 0,
    accounts: 0,
    accountMaps: 0,
  };

  try {
    const [tenant, actor] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: tenantId, activo: true },
        select: { id: true, nombre: true, razonSocial: true },
      }),
      prisma.user.findFirst({
        where: { id: actorId, tenantId, activo: true, rol: 'ADMIN' },
        select: { id: true, email: true, rol: true },
      }),
    ]);
    if (!tenant)
      throw new Error('El tenant de demostración no existe o está inactivo.');
    if (!actor) {
      throw new Error(
        'El usuario indicado debe ser ADMIN activo del tenant seleccionado.',
      );
    }
    if (
      !/(demo|prueba|test|e2e)/i.test(`${tenant.nombre} ${tenant.razonSocial}`)
    ) {
      throw new Error(
        'El nombre del tenant debe identificarlo explícitamente como demo, prueba, test o E2E.',
      );
    }

    const contextService = new TenantContextService();
    const tenantContext = new TenantContextBoundary(contextService);
    const tenantPrisma = new TenantPrismaService(prisma, tenantContext);
    const audit = new AuditService(prisma);
    const ledger = new LedgerService(tenantPrisma, audit);
    const billing = new BillingService(prisma, tenantPrisma, ledger, audit);
    const preflight = new PayrollAccountingPreflightService(prisma);
    const payroll = new PayrollService(
      prisma,
      tenantPrisma,
      audit,
      ledger,
      preflight,
    );
    const context = {
      tenantId,
      userId: actor.id,
      rol: actor.rol,
      email: actor.email,
    };

    return await contextService.run(context, async () => {
      const seedSetup = await tenantPrisma.execute(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`financial-demo:${tenantId}`}), 0)`;
        const stablePeriodId = demoId(tenantId, 'payroll-period');
        const existingPeriod = await tx.payrollPeriod.findUnique({
          where: { id: stablePeriodId },
          select: {
            id: true,
            tenantId: true,
            status: true,
            fechaInicio: true,
            fechaFin: true,
          },
        });
        assertTenant(existingPeriod, tenantId, 'payroll period');

        if (
          existingPeriod &&
          existingPeriod.status !== PayrollPeriodStatus.APROBADA &&
          existingPeriod.status !== PayrollPeriodStatus.CAUSADA
        ) {
          throw new Error(
            `El período sintético ya existe en estado ${existingPeriod.status}; no se cambió.`,
          );
        }

        if (existingPeriod) {
          const [runs, snapshot, costCenter] = await Promise.all([
            tx.payrollRun.findMany({
              where: { tenantId, payrollPeriodId: existingPeriod.id },
              select: {
                id: true,
                employeeId: true,
                centroCostoId: true,
                totalDevengos: true,
                totalDeducciones: true,
                netoPagar: true,
                totalAportesPatronales: true,
                totalProvisiones: true,
                salarioBaseSnapshot: true,
                concepts: {
                  select: { id: true, codigo: true, tipo: true, valor: true },
                },
              },
            }),
            tx.payrollSnapshot.findUnique({
              where: { id: demoId(tenantId, 'payroll-snapshot') },
              select: {
                id: true,
                tenantId: true,
                payrollRunId: true,
                payrollPeriodId: true,
                employeeId: true,
                centroCostoId: true,
                estadoPeriodo: true,
                origen: true,
                payloadVersion: true,
                payload: true,
              },
            }),
            tx.centroCosto.findUnique({
              where: { id: demoId(tenantId, 'payroll-cost-center') },
              select: {
                id: true,
                tenantId: true,
                codigo: true,
                activo: true,
                deletedAt: true,
              },
            }),
          ]);
          const run = runs.length === 1 ? runs[0] : undefined;
          const expectedConcepts = [
            {
              id: demoId(tenantId, 'payroll-concept-salary'),
              codigo: 'SALARIO_BASE',
              tipo: 'EARNING',
              valor: 1_000_000,
            },
            {
              id: demoId(tenantId, 'payroll-concept-health'),
              codigo: 'SALUD_EMP',
              tipo: 'DEDUCTION',
              valor: 40_000,
            },
            {
              id: demoId(tenantId, 'payroll-concept-pension'),
              codigo: 'PENSION_EMP',
              tipo: 'DEDUCTION',
              valor: 40_000,
            },
          ];
          const expectedRunIsIntact = Boolean(
            run &&
            run.id === demoId(tenantId, 'payroll-run') &&
            run.employeeId === demoId(tenantId, 'payroll-employee') &&
            run.centroCostoId === demoId(tenantId, 'payroll-cost-center') &&
            Number(run.totalDevengos) === 1_000_000 &&
            Number(run.totalDeducciones) === 80_000 &&
            Number(run.netoPagar) === 920_000 &&
            run.totalAportesPatronales !== null &&
            Number(run.totalAportesPatronales) === 0 &&
            run.totalProvisiones !== null &&
            Number(run.totalProvisiones) === 0 &&
            run.salarioBaseSnapshot !== null &&
            Number(run.salarioBaseSnapshot) === 1_000_000 &&
            run.concepts.length === expectedConcepts.length &&
            expectedConcepts.every((expected) =>
              run.concepts.some(
                (concept) =>
                  concept.id === expected.id &&
                  concept.codigo === expected.codigo &&
                  concept.tipo === expected.tipo &&
                  Number(concept.valor) === expected.valor,
              ),
            ),
          );
          if (
            !expectedRunIsIntact ||
            !snapshot ||
            snapshot.tenantId !== tenantId ||
            snapshot.payrollRunId !== demoId(tenantId, 'payroll-run') ||
            snapshot.payrollPeriodId !== existingPeriod.id ||
            snapshot.employeeId !== demoId(tenantId, 'payroll-employee') ||
            snapshot.centroCostoId !==
              demoId(tenantId, 'payroll-cost-center') ||
            snapshot.estadoPeriodo !== PayrollPeriodStatus.APROBADA ||
            snapshot.origen !== 'FINANCIAL_DEMO_SEED' ||
            snapshot.payloadVersion !== 1 ||
            !isSyntheticPayrollSnapshot(snapshot.payload) ||
            !costCenter ||
            costCenter.tenantId !== tenantId ||
            costCenter.codigo !== 'DEMO-NOMINA' ||
            !costCenter.activo ||
            costCenter.deletedAt
          ) {
            throw new Error(
              'La nómina demo existente no conserva exclusivamente su liquidación y snapshot sintéticos; no se modificó.',
            );
          }
        }

        if (existingPeriod?.status !== PayrollPeriodStatus.CAUSADA) {
          await ensureSystemAccountMappings(
            tx,
            tenantId,
            created,
            PAYROLL_ACCOUNT_ROLES,
          );
          await requireVoucherType(tx, 'NOM');
        }

        let accountingPeriod: { id: string; fechaInicio: Date; fechaFin: Date };
        if (
          existingPeriod &&
          existingPeriod.status !== PayrollPeriodStatus.CAUSADA
        ) {
          const matchingPeriod = await tx.periodoContable.findFirst({
            where: {
              tenantId,
              estado: EstadoPeriodo.ABIERTO,
              fechaInicio: { lte: existingPeriod.fechaFin },
              fechaFin: { gte: existingPeriod.fechaFin },
            },
          });
          if (!matchingPeriod) {
            throw new Error(
              'El período contable de la nómina demo no está abierto; no se reabrió ni modificó.',
            );
          }
          accountingPeriod = matchingPeriod;
        } else if (existingPeriod) {
          accountingPeriod = {
            id: '',
            fechaInicio: existingPeriod.fechaInicio,
            fechaFin: existingPeriod.fechaFin,
          };
        } else {
          accountingPeriod = await ensureOpenAccountingPeriod(
            tx,
            tenantId,
            created,
          );
        }

        return { existingPeriod, accountingPeriod };
      });

      if (seedSetup.existingPeriod?.status !== PayrollPeriodStatus.CAUSADA) {
        const preflightResult = await preflight.validate(tenantId, {
          fechaCausacion: seedSetup.accountingPeriod.fechaFin,
        });
        if (preflightResult.status === 'ERROR') {
          throw new Error(
            `La configuración contable no permite causar la demo: ${preflightResult.validations
              .filter((validation) => validation.severity === 'ERROR')
              .map((validation) => validation.message)
              .join(' ')}`,
          );
        }
      }

      const monthStartDate = seedSetup.accountingPeriod.fechaInicio;
      const today = colombiaBusinessDate(new Date());
      const invoiceDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          12,
        ),
      );
      const invoiceYear = today.getUTCFullYear();
      const payrollPeriodId = await tenantPrisma.execute(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`financial-demo:${tenantId}`}), 0)`;

        await ensureSystemAccountMappings(
          tx,
          tenantId,
          created,
          INVOICE_ACCOUNT_ROLES,
        );
        await requireVoucherType(tx, 'FV');

        const customerIds = new Map<string, string>();
        for (const customer of DEMO_CUSTOMERS) {
          const customerId = await ensureCustomer(
            tx,
            tenantId,
            customer,
            created,
          );
          await ensureCustomerThirdParty(
            tx,
            tenantId,
            customerId,
            customer,
            created,
          );
          customerIds.set(customer.key, customerId);
        }

        const productIds = new Map<string, string>();
        for (const product of DEMO_PRODUCTS) {
          productIds.set(
            product.key,
            await ensureProduct(tx, tenantId, product, created),
          );
        }

        const trainingId = productIds.get('product-training')!;
        const supportId = productIds.get('product-support')!;
        const consultingId = productIds.get('product-consulting')!;
        const horizonCustomerId = customerIds.get('customer-horizonte')!;
        const aulaCustomerId = customerIds.get('customer-aula')!;

        await ensureInvoice(
          tx,
          tenantId,
          {
            key: 'invoice-issued-001',
            numero: `DEMO-${invoiceYear}-001`,
            customerId: horizonCustomerId,
            status: 'DRAFT',
            fechaEmision: invoiceDate,
            items: [
              {
                key: 'invoice-issued-001-item-001',
                productServiceId: trainingId,
                descripcion: 'DEMO Servicio de capacitación',
                cantidad: 2,
                valorUnitario: 120_000,
              },
            ],
          },
          created,
        );
        await ensureInvoice(
          tx,
          tenantId,
          {
            key: 'invoice-issued-002',
            numero: `DEMO-${invoiceYear}-002`,
            customerId: aulaCustomerId,
            status: 'DRAFT',
            fechaEmision: invoiceDate,
            items: [
              {
                key: 'invoice-issued-002-item-001',
                productServiceId: supportId,
                descripcion: 'DEMO Soporte administrativo',
                cantidad: 1,
                valorUnitario: 250_000,
              },
              {
                key: 'invoice-issued-002-item-002',
                productServiceId: trainingId,
                descripcion: 'DEMO Servicio de capacitación',
                cantidad: 1,
                valorUnitario: 120_000,
              },
            ],
          },
          created,
        );
        await ensureInvoice(
          tx,
          tenantId,
          {
            key: 'invoice-draft-003',
            numero: `DEMO-${invoiceYear}-003`,
            customerId: horizonCustomerId,
            status: 'DRAFT',
            fechaEmision: invoiceDate,
            items: [
              {
                key: 'invoice-draft-003-item-001',
                productServiceId: consultingId,
                descripcion: 'DEMO Consultoría',
                cantidad: 1,
                valorUnitario: 600_000,
              },
            ],
          },
          created,
        );

        return ensurePayrollData(
          tx,
          tenantId,
          actorId,
          {
            fechaInicio: monthStartDate,
            fechaFin: seedSetup.accountingPeriod.fechaFin,
          },
          seedSetup.existingPeriod,
          created,
        );
      });

      for (const invoiceId of [
        demoId(tenantId, 'invoice-issued-001'),
        demoId(tenantId, 'invoice-issued-002'),
      ]) {
        await billing.updateInvoiceStatus(tenantId, actorId, invoiceId, {
          status: 'ISSUED',
        });
      }

      if (seedSetup.existingPeriod?.status === PayrollPeriodStatus.CAUSADA) {
        const vouchers = await prisma.comprobanteContable.findMany({
          where: {
            tenantId,
            origenTipo: 'PAYROLL',
            origenId: payrollPeriodId,
            origenEvento: 'CAUSACION',
            estado: { not: 'ANULADO' },
          },
          select: { id: true },
        });
        if (vouchers.length !== 1) {
          throw new Error(
            'La nómina demo figura causada, pero no conserva exactamente un comprobante vigente.',
          );
        }
        return {
          tenantId,
          payrollPeriodId,
          comprobanteId: vouchers[0].id,
          status: 'YA_CAUSADA' as const,
          created,
        };
      }

      const posting = await payroll.contabilizar(
        tenantId,
        actorId,
        payrollPeriodId,
      );
      if (posting.status === 'PREFLIGHT_ERROR') {
        throw new Error(
          `No se pudo causar la nómina demo: ${posting.preflight.validations
            .filter((validation) => validation.severity === 'ERROR')
            .map((validation) => validation.message)
            .join(' ')}`,
        );
      }

      return {
        tenantId,
        payrollPeriodId,
        comprobanteId: posting.comprobanteId,
        status: posting.status,
        created,
      };
    });
  } finally {
    await prisma.$disconnect();
  }
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Uso: NODE_ENV=development FINANCIAL_DEMO_SEED_TENANT_ID=<id> pnpm --filter @saas/api prisma:seed:financial-demo -- --tenant-id <id> --actor-id <admin-id> --confirm-demo',
    );
    return;
  }

  const tenantId = option(args, '--tenant-id');
  const actorId = option(args, '--actor-id');
  if (!tenantId || !actorId || !args.includes('--confirm-demo')) {
    throw new Error(
      'Se requieren --tenant-id, --actor-id y --confirm-demo. Consulta --help.',
    );
  }
  const tenant = await seedFinancialDemoScenario(tenantId, actorId);
  console.log(
    `Demo financiera lista para tenant ${tenant.tenantId}: ${tenant.created.customers} clientes, ${tenant.created.products} productos, ${tenant.created.invoices} facturas nuevas; nómina ${tenant.payrollPeriodId} ${tenant.status}, comprobante ${tenant.comprobanteId}.`,
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Falló el seed financiero.',
    );
    process.exitCode = 1;
  });
}
