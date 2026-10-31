import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildInvoiceAccountingLines,
  type InvoiceAccountingSnapshot,
  type InvoiceSystemAccounts,
} from './invoice-accounting.mapper';

const accounts: InvoiceSystemAccounts = {
  CLIENTES_NACIONALES: 'account-receivable',
  INGRESOS_OPERACIONALES: 'account-income',
  IVA_GENERADO: 'account-tax',
};

function decimal(value: number | string) {
  return new Prisma.Decimal(value);
}

function invoice(
  overrides: Partial<InvoiceAccountingSnapshot> = {},
): InvoiceAccountingSnapshot {
  return {
    numero: 'FV-001',
    terceroId: 'third-party-1',
    subtotal: decimal(100_000),
    impuestos: decimal(19_000),
    total: decimal(119_000),
    items: [
      {
        descripcion: 'Servicio',
        subtotal: decimal(100_000),
        impuestoTarifa: decimal(19),
        impuestoValor: decimal(19_000),
      },
    ],
    ...overrides,
  };
}

describe('buildInvoiceAccountingLines', () => {
  it('balances receivable, income and the per-line tax snapshot', () => {
    const lines = buildInvoiceAccountingLines(invoice(), accounts);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      cuentaId: accounts.CLIENTES_NACIONALES,
      terceroId: 'third-party-1',
      debito: decimal(119_000),
    });
    expect(lines[1]).toMatchObject({
      cuentaId: accounts.INGRESOS_OPERACIONALES,
      terceroId: 'third-party-1',
      credito: decimal(100_000),
    });
    expect(lines[2]).toMatchObject({
      cuentaId: accounts.IVA_GENERADO,
      credito: decimal(19_000),
      baseGravable: decimal(100_000),
    });
  });

  it('groups lines by configured rate and omits a zero tax movement', () => {
    const lines = buildInvoiceAccountingLines(
      invoice({
        subtotal: decimal(200),
        impuestos: decimal(19),
        total: decimal(219),
        items: [
          {
            descripcion: 'Tasa cero',
            subtotal: decimal(100),
            impuestoTarifa: decimal(0),
            impuestoValor: decimal(0),
          },
          {
            descripcion: 'Tasa gravada',
            subtotal: decimal(100),
            impuestoTarifa: decimal(19),
            impuestoValor: decimal(19),
          },
        ],
      }),
      accounts,
    );

    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatchObject({
      cuentaId: accounts.IVA_GENERADO,
      credito: decimal(19),
      baseGravable: decimal(100),
    });
  });

  it('does not post snapshots missing from historical invoice lines', () => {
    expect(() =>
      buildInvoiceAccountingLines(
        invoice({
          items: [
            {
              descripcion: 'Histórica',
              subtotal: decimal(100_000),
              impuestoTarifa: null,
              impuestoValor: null,
            },
          ],
        }),
        accounts,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects missing third parties and zero-value invoices', () => {
    expect(() =>
      buildInvoiceAccountingLines(invoice({ terceroId: '' }), accounts),
    ).toThrow(BadRequestException);
    expect(() =>
      buildInvoiceAccountingLines(
        invoice({
          subtotal: decimal(0),
          impuestos: decimal(0),
          total: decimal(0),
          items: [
            {
              descripcion: 'Sin valor',
              subtotal: decimal(0),
              impuestoTarifa: decimal(19),
              impuestoValor: decimal(0),
            },
          ],
        }),
        accounts,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a tax snapshot that does not match its rate and base', () => {
    expect(() =>
      buildInvoiceAccountingLines(
        invoice({
          items: [
            {
              descripcion: 'Alterada',
              subtotal: decimal(100_000),
              impuestoTarifa: decimal(19),
              impuestoValor: decimal(1),
            },
          ],
        }),
        accounts,
      ),
    ).toThrow(BadRequestException);
  });
});
