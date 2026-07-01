import { PrismaClient } from '@prisma/client';

describe('Ledger — restricciones de base de datos (e2e)', () => {
  const prisma = new PrismaClient();
  const uid = () => Math.random().toString(36).slice(2, 10);

  let tenantId: string;
  let tipoId: string;
  let periodoId: string;
  let cuentaId: string;

  beforeAll(async () => {
    // Crear datos via Prisma (respeta defaults de BD)
    const tenant = await prisma.tenant.create({
      data: {
        nombre: `e2e-ledger-${uid()}`,
        nit: `900${uid()}`,
        digitoVerif: '0',
        razonSocial: 'E2E SA',
        email: `e2e-${uid()}@test.local`,
        activo: true,
      },
    });
    tenantId = tenant.id;

    const tipo = await prisma.tipoComprobante.create({
      data: { codigo: `E2E-${uid().toUpperCase()}`, nombre: 'E2E Test' },
    });
    tipoId = tipo.id;

    const periodo = await prisma.periodoContable.create({
      data: {
        tenantId,
        anio: 2026,
        mes: 7,
        fechaInicio: new Date('2026-07-01'),
        fechaFin: new Date('2026-07-31'),
      },
    });
    periodoId = periodo.id;

    const cuenta = await prisma.cuentaContable.create({
      data: {
        tenantId,
        codigo: `E2E-${uid().toUpperCase()}`,
        nombre: 'Cuenta E2E',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        nivel: 5,
        imputable: true,
        activa: true,
      },
    });
    cuentaId = cuenta.id;
  }, 30000);

  afterAll(async () => {
    await prisma.movimientoContable.deleteMany({ where: { tenantId } });
    await prisma.comprobanteContable.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { id: cuentaId } });
    await prisma.periodoContable.deleteMany({ where: { id: periodoId } });
    await prisma.tipoComprobante.deleteMany({ where: { id: tipoId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  const usuarioId = 'u-e2e-test';

  // Solo probamos con raw SQL lo que realmente necesita ser probado a nivel BD:
  // los CHECK constraints y los índices parciales.

  describe('CHECK comprobantes_origen_all_or_none', () => {
    it('permite los tres campos NULL', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE)
      `);
    });

    it('permite los tres campos NOT NULL', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha",
           "origenTipo","origenId","origenEvento")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,
          'PAYROLL','pay-101','CAUSACION')
      `);
    });

    it('rechaza solo origenTipo', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "comprobantes_contables"
            ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha","origenTipo")
          VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,'PAYROLL')
        `),
      ).rejects.toThrow();
    });

    it('rechaza origenTipo + origenId sin origenEvento', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "comprobantes_contables"
            ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha",
             "origenTipo","origenId")
          VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,'PAYROLL','pay-102')
        `),
      ).rejects.toThrow();
    });
  });

  describe('CHECK movimientos_debito_credito', () => {
    // Usamos Prisma para crear el comprobante FK
    let comprobanteId: string;

    beforeAll(async () => {
      const comp = await prisma.comprobanteContable.create({
        data: {
          tenantId,
          tipoComprobanteId: tipoId,
          periodoId,
          usuarioId,
          concepto: 'test',
          fecha: new Date(),
        },
      });
      comprobanteId = comp.id;
    });

    it('rechaza débito y crédito ambos en cero', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "movimientos_contables"
            ("id","tenantId","comprobanteId","linea","cuentaId","debito","credito")
          VALUES (gen_random_uuid(),'${tenantId}','${comprobanteId}',1,'${cuentaId}',0,0)
        `),
      ).rejects.toThrow();
    });

    it('rechaza débito y crédito ambos positivos', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "movimientos_contables"
            ("id","tenantId","comprobanteId","linea","cuentaId","debito","credito")
          VALUES (gen_random_uuid(),'${tenantId}','${comprobanteId}',1,'${cuentaId}',50000,50000)
        `),
      ).rejects.toThrow();
    });

    it('rechaza débito negativo', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "movimientos_contables"
            ("id","tenantId","comprobanteId","linea","cuentaId","debito","credito")
          VALUES (gen_random_uuid(),'${tenantId}','${comprobanteId}',1,'${cuentaId}',-10000,0)
        `),
      ).rejects.toThrow();
    });

    it('permite solo débito positivo', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "movimientos_contables"
          ("id","tenantId","comprobanteId","linea","cuentaId","debito","credito")
        VALUES (gen_random_uuid(),'${tenantId}','${comprobanteId}',1,'${cuentaId}',100000,0)
      `);
    });
  });

  describe('UNIQUE INDEX consecutivo (partial)', () => {
    it('rechaza duplicar (tenant, tipo, numero) con numero asignado', async () => {
      const num = Math.floor(Math.random() * 100000) + 900000;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha","numero","estado")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,${num},'CONTABILIZADO')
      `);
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "comprobantes_contables"
            ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha","numero","estado")
          VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,${num},'CONTABILIZADO')
        `),
      ).rejects.toThrow();
    });

    it('permite múltiples BORRADOR con numero NULL', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha","estado")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,'BORRADOR')
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha","estado")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,'BORRADOR')
      `);
    });
  });

  describe('UNIQUE INDEX idempotencia (partial)', () => {
    it('rechaza duplicar clave de origen', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha",
           "origenTipo","origenId","origenEvento")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,
          'PAYROLL','pay-i8','CAUSACION')
      `);
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "comprobantes_contables"
            ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha",
             "origenTipo","origenId","origenEvento")
          VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE,
            'PAYROLL','pay-i8','CAUSACION')
        `),
      ).rejects.toThrow();
    });

    it('permite múltiples comprobantes manuales sin origen', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE)
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "comprobantes_contables"
          ("id","createdAt","updatedAt","tenantId","tipoComprobanteId","periodoId","usuarioId","concepto","fecha")
        VALUES (gen_random_uuid(),NOW(),NOW(),'${tenantId}','${tipoId}','${periodoId}','${usuarioId}','test',CURRENT_DATE)
      `);
    });
  });

  describe('FK NO ACTION', () => {
    it('impide borrar comprobante con movimientos', async () => {
      const cid = `comp-fk-${uid()}`;
      await prisma.comprobanteContable.create({
        data: {
          id: cid,
          tenantId,
          tipoComprobanteId: tipoId,
          periodoId,
          usuarioId,
          concepto: 'test',
          fecha: new Date(),
          movimientos: {
            create: {
              tenantId,
              linea: 1,
              cuentaId,
              debito: 100000,
              credito: 0,
            },
          },
        },
      });
      await expect(
        prisma.comprobanteContable.delete({ where: { id: cid } }),
      ).rejects.toThrow();
    });
  });
});
