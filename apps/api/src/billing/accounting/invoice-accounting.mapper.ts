import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LineaComprobanteInput } from '../../accounting/ledger/ledger.types';

export const INVOICE_ACCOUNTING_REQUIRED_ROLES = [
  'CLIENTES_NACIONALES',
  'INGRESOS_OPERACIONALES',
  'IVA_GENERADO',
] as const;

type InvoiceAccountRole = (typeof INVOICE_ACCOUNTING_REQUIRED_ROLES)[number];

export type InvoiceSystemAccounts = Record<InvoiceAccountRole, string>;

export interface InvoiceAccountingSnapshot {
  numero: string;
  subtotal: Prisma.Decimal;
  impuestos: Prisma.Decimal;
  total: Prisma.Decimal;
  terceroId: string;
  items: Array<{
    descripcion: string;
    subtotal: Prisma.Decimal;
    impuestoTarifa: Prisma.Decimal | null;
    impuestoValor: Prisma.Decimal | null;
  }>;
}

type TaxGroup = { base: Prisma.Decimal; impuesto: Prisma.Decimal };

function roundCop(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function buildInvoiceAccountingLines(
  invoice: InvoiceAccountingSnapshot,
  accounts: InvoiceSystemAccounts,
): LineaComprobanteInput[] {
  if (!invoice.terceroId) {
    throw new BadRequestException(
      'Asocia un tercero contable activo con rol de cliente antes de emitir la factura.',
    );
  }

  if (invoice.items.length === 0) {
    throw new BadRequestException(
      'La factura no tiene líneas para contabilizar.',
    );
  }

  if (invoice.total.lte(0)) {
    throw new BadRequestException(
      'No se puede contabilizar una factura con total igual a cero.',
    );
  }

  let subtotal = new Prisma.Decimal(0);
  let impuestos = new Prisma.Decimal(0);
  const groups = new Map<string, TaxGroup>();

  for (const [index, item] of invoice.items.entries()) {
    const rate = item.impuestoTarifa;
    const tax = item.impuestoValor;
    if (rate === null || tax === null) {
      throw new BadRequestException(
        `La línea ${index + 1} no conserva snapshot de tasa e impuesto; requiere revisión antes de emitir.`,
      );
    }
    if (rate.isNegative() || rate.gt(100) || rate.decimalPlaces() > 2) {
      throw new BadRequestException(
        `La línea ${index + 1} tiene un snapshot de tasa no válido.`,
      );
    }
    if (item.subtotal.isNegative() || tax.isNegative()) {
      throw new BadRequestException(
        `La línea ${index + 1} contiene valores negativos no contabilizables.`,
      );
    }

    const expectedTax = roundCop(item.subtotal.mul(rate).div(100));
    if (!expectedTax.eq(tax)) {
      throw new BadRequestException(
        `El impuesto guardado en la línea ${index + 1} no coincide con su snapshot; requiere revisión.`,
      );
    }

    subtotal = subtotal.plus(item.subtotal);
    impuestos = impuestos.plus(tax);

    const key = rate.toFixed(2);
    const group = groups.get(key) ?? {
      base: new Prisma.Decimal(0),
      impuesto: new Prisma.Decimal(0),
    };
    group.base = group.base.plus(item.subtotal);
    group.impuesto = group.impuesto.plus(tax);
    groups.set(key, group);
  }

  if (
    !subtotal.eq(invoice.subtotal) ||
    !impuestos.eq(invoice.impuestos) ||
    !subtotal.plus(impuestos).eq(invoice.total)
  ) {
    throw new BadRequestException(
      'Los totales de la factura no coinciden con sus líneas y snapshots; requiere revisión.',
    );
  }

  const lines: LineaComprobanteInput[] = [
    {
      cuentaId: accounts.CLIENTES_NACIONALES,
      terceroId: invoice.terceroId,
      debito: invoice.total,
      credito: new Prisma.Decimal(0),
      descripcion: `Cuenta por cobrar factura ${invoice.numero}`,
    },
    {
      cuentaId: accounts.INGRESOS_OPERACIONALES,
      terceroId: invoice.terceroId,
      debito: new Prisma.Decimal(0),
      credito: subtotal,
      descripcion: `Ingreso factura ${invoice.numero}`,
    },
  ];

  for (const [rate, group] of groups) {
    if (group.impuesto.isZero()) continue;
    lines.push({
      cuentaId: accounts.IVA_GENERADO,
      debito: new Prisma.Decimal(0),
      credito: group.impuesto,
      baseGravable: group.base,
      descripcion: `Impuesto de factura ${invoice.numero} a tasa interna ${rate}%`,
    });
  }

  const debits = lines.reduce(
    (sum, line) => sum.plus(line.debito),
    new Prisma.Decimal(0),
  );
  const credits = lines.reduce(
    (sum, line) => sum.plus(line.credito),
    new Prisma.Decimal(0),
  );
  if (!debits.eq(credits)) {
    throw new BadRequestException(
      'El asiento de la factura no está balanceado; no se emitió.',
    );
  }

  return lines;
}
