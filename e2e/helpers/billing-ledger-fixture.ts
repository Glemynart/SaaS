import { randomUUID } from 'node:crypto';

type BillingLedgerFixture = { disconnect: () => Promise<void> };

/** Seeds only disposable Browser E2E data required to issue an internal invoice. */
export async function seedBillingLedgerFixture(
  tenantId: string,
  customerNit: string,
  customerName: string,
): Promise<BillingLedgerFixture> {
  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const thirdPartyId = randomUUID();

  await prisma.$connect();
  await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx.tipoComprobante.upsert({
      where: { codigo: 'FV' },
      update: { activo: true },
      create: { codigo: 'FV', nombre: 'Factura de venta', prefijo: 'FV' },
    });
    await tx.tipoComprobante.upsert({
      where: { codigo: 'CI' },
      update: { activo: true },
      create: { codigo: 'CI', nombre: 'Comprobante de ingreso', prefijo: 'CI' },
    });

    const now = new Date();
    const calendarParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      calendar: 'gregory',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const year = Number(calendarParts.find((part) => part.type === 'year')?.value);
    const month = Number(calendarParts.find((part) => part.type === 'month')?.value);
    const period = await tx.periodoContable.findUnique({
      where: { tenantId_anio_mes: { tenantId, anio: year, mes: month } },
    });
    if (!period) {
      await tx.periodoContable.create({
        data: {
          tenantId,
          anio: year,
          mes: month,
          fechaInicio: new Date(Date.UTC(year, month - 1, 1)),
          fechaFin: new Date(Date.UTC(year, month, 0)),
          estado: 'ABIERTO',
        },
      });
    } else if (period.estado !== 'ABIERTO') {
      throw new Error('La prueba necesita un período contable abierto en el mes actual.');
    }

    const accountRoles = [
      {
        rol: 'CAJA_GENERAL',
        codigo: `E2E-${suffix}-CASH`,
        nombre: 'Caja general E2E',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        requiereTercero: false,
        requiereBase: false,
      },
      {
        rol: 'BANCO_PRINCIPAL',
        codigo: `E2E-${suffix}-BANK`,
        nombre: 'Banco principal E2E',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        requiereTercero: false,
        requiereBase: false,
      },
      {
        rol: 'CLIENTES_NACIONALES',
        codigo: `E2E-${suffix}-AR`,
        nombre: 'Clientes nacionales E2E',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        requiereTercero: true,
        requiereBase: false,
      },
      {
        rol: 'INGRESOS_OPERACIONALES',
        codigo: `E2E-${suffix}-REV`,
        nombre: 'Ingresos operacionales E2E',
        claseContable: 'INGRESOS',
        naturaleza: 'CREDITO',
        requiereTercero: true,
        requiereBase: false,
      },
      {
        rol: 'IVA_GENERADO',
        codigo: `E2E-${suffix}-IVA`,
        nombre: 'IVA generado E2E',
        claseContable: 'PASIVO',
        naturaleza: 'CREDITO',
        requiereTercero: false,
        requiereBase: true,
      },
    ] as const;

    for (const accountRole of accountRoles) {
      const existingMap = await tx.cuentaSistemaMap.findFirst({
        where: { tenantId, rol: accountRole.rol },
        select: { id: true },
      });
      if (existingMap) continue;

      const account = await tx.cuentaContable.create({
        data: {
          tenantId,
          codigo: accountRole.codigo,
          nombre: accountRole.nombre,
          claseContable: accountRole.claseContable,
          naturaleza: accountRole.naturaleza,
          nivel: 5,
          imputable: true,
          esCuentaSistema: false,
          requiereTercero: accountRole.requiereTercero,
          requiereCentroCosto: false,
          requiereBase: accountRole.requiereBase,
          activa: true,
        },
      });
      await tx.cuentaSistemaMap.create({
        data: { tenantId, rol: accountRole.rol, cuentaId: account.id },
      });
    }

    await tx.tercero.create({
      data: {
        id: thirdPartyId,
        tenantId,
        tipoDocumento: 'NIT',
        numeroDocumento: customerNit,
        tipoPersona: 'JURIDICA',
        razonSocial: customerName,
        esCliente: true,
        activo: true,
      },
    });
  });

  return { disconnect: () => prisma.$disconnect() };
}
