import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CuentasContablesService } from './cuentas-contables.service';

// Cubre la protección de cuentas de sistema en update(): sus banderas de control
// no deben poder modificarse (contrato para C1 / CuentaSistemaMap).
describe('CuentasContablesService.update — protección esCuentaSistema', () => {
  const cuentaSistema = {
    id: 'c1',
    codigo: '240805',
    esCuentaSistema: true,
    deletedAt: null,
  };
  const cuentaNormal = { ...cuentaSistema, id: 'c2', esCuentaSistema: false };

  function build(cuenta: Record<string, unknown>, contextTenantId = 't1') {
    const tx = {
      cuentaContable: {
        findFirst: jest.fn().mockResolvedValue(cuenta),
        create: jest.fn().mockResolvedValue(cuenta),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ ...cuenta, nombre: 'nuevo' }),
      },
    };
    const tenantPrisma = {
      execute: jest.fn((work: (client: unknown, context: unknown) => unknown) =>
        work(tx, { tenantId: contextTenantId }),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CuentasContablesService(
      tenantPrisma as never,
      audit as never,
    );
    return { service, tx, tenantPrisma };
  }

  it.each([
    'activa',
    'imputable',
    'requiereTercero',
    'requiereCentroCosto',
    'requiereBase',
  ])('rechaza modificar "%s" en una cuenta de sistema', async (campo) => {
    const { service, tx } = build(cuentaSistema);
    await expect(
      service.update('t1', 'u1', 'c1', { [campo]: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.cuentaContable.update).not.toHaveBeenCalled();
  });

  it('permite cambiar solo el nombre en una cuenta de sistema', async () => {
    const { service, tx, tenantPrisma } = build(cuentaSistema);
    await service.update('t1', 'u1', 'c1', { nombre: 'nuevo' });
    expect(tenantPrisma.execute).toHaveBeenCalledTimes(1);
    expect(tx.cuentaContable.update).toHaveBeenCalledTimes(1);
  });

  it('permite modificar banderas en una cuenta NO de sistema', async () => {
    const { service, tx } = build(cuentaNormal);
    await service.update('t1', 'u1', 'c2', { activa: false });
    expect(tx.cuentaContable.update).toHaveBeenCalledTimes(1);
  });

  it('rechaza una discrepancia entre el tenant solicitado y el contexto activo', async () => {
    const { service, tx } = build(cuentaNormal, 't2');
    await expect(
      service.update('t1', 'u1', 'c2', { nombre: 'no debe cambiar' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.cuentaContable.findFirst).not.toHaveBeenCalled();
    expect(tx.cuentaContable.update).not.toHaveBeenCalled();
  });
});

describe('CuentasContablesService — auditoría transaccional', () => {
  const cuenta = {
    id: 'c1',
    codigo: '1105',
    nombre: 'Caja',
    esCuentaSistema: false,
    deletedAt: null,
  };

  function build() {
    const tx = {
      cuentaContable: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue(cuenta),
        update: jest.fn().mockResolvedValue(cuenta),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const tenantPrisma = {
      execute: jest.fn((work: (client: unknown, context: unknown) => unknown) =>
        work(tx, { tenantId: 't1' }),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CuentasContablesService(
      tenantPrisma as never,
      audit as never,
    );
    return { service, tx, audit };
  }

  it('writes account creation audit through the same transaction client', async () => {
    const { service, tx, audit } = build();
    tx.cuentaContable.findFirst.mockResolvedValue(null);

    await service.create('t1', 'u1', {
      codigo: '1105',
      nombre: 'Caja',
      claseContable: 'ACTIVO',
      naturaleza: 'DEBITO',
      nivel: 1,
    } as never);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUENTA_CONTABLE_CREATE' }),
      tx,
    );
  });

  it('rejects account creation when its transactional audit fails', async () => {
    const { service, tx, audit } = build();
    tx.cuentaContable.findFirst.mockResolvedValue(null);
    audit.log.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.create('t1', 'u1', {
        codigo: '1105',
        nombre: 'Caja',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        nivel: 1,
      } as never),
    ).rejects.toThrow('audit down');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUENTA_CONTABLE_CREATE' }),
      tx,
    );
  });

  it('rejects account updates when their transactional audit fails', async () => {
    const { service, tx, audit } = build();
    tx.cuentaContable.findFirst.mockResolvedValue(cuenta);
    audit.log.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.update('t1', 'u1', 'c1', { nombre: 'Caja menor' }),
    ).rejects.toThrow('audit down');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUENTA_CONTABLE_UPDATE' }),
      tx,
    );
  });

  it('rejects account removal when its transactional audit fails', async () => {
    const { service, tx, audit } = build();
    tx.cuentaContable.findFirst.mockResolvedValue(cuenta);
    audit.log.mockRejectedValueOnce(new Error('audit down'));

    await expect(service.remove('t1', 'u1', 'c1')).rejects.toThrow(
      'audit down',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUENTA_CONTABLE_DELETE' }),
      tx,
    );
  });
});
