import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ExpedienteDocsService } from './expediente-docs.service';
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

  it('encodes Unicode filenames safely when downloading expediente documents', async () => {
    const body = Buffer.from('%PDF-1.7');
    const download = jest.fn().mockResolvedValue({
      mimeType: 'application/pdf',
      nombre: 'Acta — Gómez.pdf',
      body,
    });
    const controller = new ExpedienteDocsController({
      download,
    } as unknown as ExpedienteDocsService);
    const setHeader = jest.fn();
    const send = jest.fn();

    await controller.download({} as CurrentUserPayload, 'doc-001', {
      setHeader,
      send,
    } as unknown as Response);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Acta _ Gomez.pdf"; filename*=UTF-8\'\'Acta%20%E2%80%94%20G%C3%B3mez.pdf',
    );
    expect(send).toHaveBeenCalledWith(body);
  });
});
