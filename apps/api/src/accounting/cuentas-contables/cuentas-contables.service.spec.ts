import { ConflictException } from '@nestjs/common';
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

  function build(cuenta: Record<string, unknown>) {
    const prisma = {
      cuentaContable: {
        findFirst: jest.fn().mockResolvedValue(cuenta),
        update: jest.fn().mockResolvedValue({ ...cuenta, nombre: 'nuevo' }),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CuentasContablesService(
      prisma as never,
      audit as never,
    );
    return { service, prisma };
  }

  it.each([
    'activa',
    'imputable',
    'requiereTercero',
    'requiereCentroCosto',
    'requiereBase',
  ])('rechaza modificar "%s" en una cuenta de sistema', async (campo) => {
    const { service, prisma } = build(cuentaSistema);
    await expect(
      service.update('t1', 'u1', 'c1', { [campo]: true } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cuentaContable.update).not.toHaveBeenCalled();
  });

  it('permite cambiar solo el nombre en una cuenta de sistema', async () => {
    const { service, prisma } = build(cuentaSistema);
    await service.update('t1', 'u1', 'c1', { nombre: 'nuevo' });
    expect(prisma.cuentaContable.update).toHaveBeenCalledTimes(1);
  });

  it('permite modificar banderas en una cuenta NO de sistema', async () => {
    const { service, prisma } = build(cuentaNormal);
    await service.update('t1', 'u1', 'c2', { activa: false });
    expect(prisma.cuentaContable.update).toHaveBeenCalledTimes(1);
  });
});
