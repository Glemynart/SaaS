import { PrismaClient } from '@prisma/client';
import { lockPayrollCorrectionDependencies } from '../src/accounting/payroll-correction-dependency-lock';

describe('Payroll correction dependency locks (e2e)', () => {
  const firstClient = new PrismaClient();
  const secondClient = new PrismaClient();

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it('holds a dependency lock until the first transaction ends', async () => {
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    let releaseFirst!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = firstClient.$transaction(async (tx) => {
      await lockPayrollCorrectionDependencies(tx, 'tenant-lock', [
        'correction-a',
      ]);
      signalLocked();
      await release;
    });

    await locked;

    await expect(
      secondClient.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '100ms'`;
        await lockPayrollCorrectionDependencies(tx, 'tenant-lock', [
          'correction-a',
        ]);
      }),
    ).rejects.toThrow();

    releaseFirst();
    await first;
  });

  it('does not serialize unrelated corrections', async () => {
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    let releaseFirst!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = firstClient.$transaction(async (tx) => {
      await lockPayrollCorrectionDependencies(tx, 'tenant-lock', [
        'correction-a',
      ]);
      signalLocked();
      await release;
    });

    await locked;

    await expect(
      secondClient.$transaction((tx) =>
        lockPayrollCorrectionDependencies(tx, 'tenant-lock', ['correction-b']),
      ),
    ).resolves.toBeUndefined();

    releaseFirst();
    await first;
  });
});
