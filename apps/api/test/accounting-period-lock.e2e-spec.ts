import { PrismaClient } from '@prisma/client';
import { lockAccountingPeriod } from '../src/accounting/accounting-period-lock';

describe('Accounting period locks (e2e)', () => {
  const firstClient = new PrismaClient();
  const secondClient = new PrismaClient();
  const uid = () => Math.random().toString(36).slice(2, 10);

  let tenantId: string;
  let periodoId: string;

  beforeAll(async () => {
    const tenant = await firstClient.tenant.create({
      data: {
        nombre: `e2e-period-lock-${uid()}`,
        nit: `901${uid()}`,
        digitoVerif: '0',
        razonSocial: 'Period lock E2E SA',
        email: `period-lock-${uid()}@test.local`,
        activo: true,
      },
    });
    tenantId = tenant.id;

    const periodo = await firstClient.periodoContable.create({
      data: {
        tenantId,
        anio: 2026,
        mes: 8,
        fechaInicio: new Date('2026-08-01'),
        fechaFin: new Date('2026-08-31'),
      },
    });
    periodoId = periodo.id;
  });

  afterAll(async () => {
    await firstClient.periodoContable.delete({ where: { id: periodoId } });
    await firstClient.tenant.delete({ where: { id: tenantId } });
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it('rejects a posting that obtains the period lock after its closure', async () => {
    let signalClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      signalClosed = resolve;
    });
    let releaseClose!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });

    const closing = firstClient.$transaction(async (tx) => {
      await lockAccountingPeriod(tx, tenantId, periodoId);
      await tx.periodoContable.update({
        where: { id: periodoId },
        data: { estado: 'CERRADO' },
      });
      signalClosed();
      await release;
    });

    await closed;

    const posting = secondClient.$transaction(async (tx) => {
      await lockAccountingPeriod(tx, tenantId, periodoId);
      return tx.periodoContable.findFirst({
        where: { id: periodoId, tenantId, estado: 'ABIERTO' },
        select: { id: true },
      });
    });

    releaseClose();

    await expect(posting).resolves.toBeNull();
    await closing;
  });

  it('lets a close proceed after an in-flight posting releases the period lock', async () => {
    await firstClient.periodoContable.update({
      where: { id: periodoId },
      data: { estado: 'ABIERTO' },
    });

    let signalPosting!: () => void;
    const postingStarted = new Promise<void>((resolve) => {
      signalPosting = resolve;
    });
    let releasePosting!: () => void;
    const release = new Promise<void>((resolve) => {
      releasePosting = resolve;
    });

    const posting = firstClient.$transaction(async (tx) => {
      await lockAccountingPeriod(tx, tenantId, periodoId);
      const periodo = await tx.periodoContable.findFirst({
        where: { id: periodoId, tenantId, estado: 'ABIERTO' },
        select: { id: true },
      });
      signalPosting();
      await release;
      return periodo;
    });

    await postingStarted;

    const closing = secondClient.$transaction(async (tx) => {
      await lockAccountingPeriod(tx, tenantId, periodoId);
      return tx.periodoContable.update({
        where: { id: periodoId },
        data: { estado: 'CERRADO' },
        select: { estado: true },
      });
    });

    releasePosting();

    await expect(posting).resolves.toEqual({ id: periodoId });
    await expect(closing).resolves.toEqual({ estado: 'CERRADO' });
  });
});
