import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ExpedienteDocsController } from './expediente-docs.controller';

describe('ExpedienteDocsController role policy', () => {
  const reflector = new Reflector();
  const controller = ExpedienteDocsController.prototype;
  const operationalRoles = [UserRole.ADMIN, UserRole.OPERADOR];
  const operationalHandlers = [
    'findByEmployee',
    'findOne',
    'findHistory',
    'download',
    'uploadManual',
  ];

  function rolesFor(method: string) {
    const handler = Object.getOwnPropertyDescriptor(controller, method)
      ?.value as (...args: never[]) => unknown;
    return reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [handler]);
  }

  it.each(operationalHandlers)(
    'allows only operational roles to read or write through %s',
    (method) => {
      expect(rolesFor(method)).toEqual(operationalRoles);
    },
  );

  it('keeps destructive operations restricted to administrators', () => {
    expect(rolesFor('remove')).toEqual([UserRole.ADMIN]);
  });
});
