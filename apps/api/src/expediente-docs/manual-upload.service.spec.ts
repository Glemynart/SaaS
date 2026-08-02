import { ExpedienteCategoria } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type {
  PutObjectInput,
  StorageObjectMetadata,
} from '../storage/storage.types';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from './expediente-docs.service';

type EmployeeFindFirstArgs = {
  where: { id: string; tenantId: string; deletedAt: null };
  select: { id: true };
};
type EmployeeFindFirst = (
  args: EmployeeFindFirstArgs,
) => Promise<{ id: string } | null>;
type TenantClientMock = { empleado: { findFirst: EmployeeFindFirst } };
type TenantExecute = (
  work: (client: TenantClientMock) => Promise<unknown>,
) => Promise<unknown>;
type ExpedienteCreateInput = { data: Record<string, unknown> };
type ExpedienteCreate = (
  args: ExpedienteCreateInput,
) => Promise<{ id: string }>;
type FamilyFindFirst = (args: unknown) => Promise<{
  id: string;
  categoria: ExpedienteCategoria;
} | null>;
type DocumentFindFirst = (args: unknown) => Promise<{
  id: string;
  version: number;
  generatedDocumentId: string | null;
} | null>;
type TransactionClientMock = {
  expedienteDocFamily: { create: ExpedienteCreate };
  expedienteDoc: {
    create: ExpedienteCreate;
    update: (args: unknown) => Promise<unknown>;
  };
};
type Transaction = (
  work: (client: TransactionClientMock) => Promise<unknown>,
) => Promise<unknown>;
type AuditLog = (params: unknown, tx?: unknown) => Promise<unknown>;

describe('ExpedienteDocsService.uploadManual', () => {
  const tenantId = 'tenant-001';
  const employeeId = 'employee-001';
  const userId = 'user-001';
  const file = {
    originalname: 'cedula.pdf',
    buffer: Buffer.from('%PDF-1.7\ncontenido'),
  };

  let service: ExpedienteDocsService;
  let employeeFindFirst: jest.MockedFunction<EmployeeFindFirst>;
  let expedienteDocCreate: jest.MockedFunction<ExpedienteCreate>;
  let expedienteDocFamilyCreate: jest.MockedFunction<ExpedienteCreate>;
  let familyFindFirst: jest.MockedFunction<FamilyFindFirst>;
  let documentFindFirst: jest.MockedFunction<DocumentFindFirst>;
  let expedienteDocUpdate: jest.MockedFunction<
    (args: unknown) => Promise<unknown>
  >;
  let transaction: jest.MockedFunction<Transaction>;
  let auditLog: jest.MockedFunction<AuditLog>;
  let putObject: jest.MockedFunction<
    (input: PutObjectInput) => Promise<StorageObjectMetadata>
  >;
  let deleteObject: jest.MockedFunction<(key: string) => Promise<void>>;
  let tenantExecute: jest.MockedFunction<TenantExecute>;

  beforeEach(() => {
    employeeFindFirst = jest.fn() as jest.MockedFunction<EmployeeFindFirst>;
    employeeFindFirst.mockResolvedValue({ id: employeeId });
    expedienteDocCreate = jest.fn() as jest.MockedFunction<ExpedienteCreate>;
    expedienteDocCreate.mockResolvedValue({ id: 'doc-001' });
    expedienteDocFamilyCreate =
      jest.fn() as jest.MockedFunction<ExpedienteCreate>;
    expedienteDocFamilyCreate.mockResolvedValue({ id: 'family-001' });
    familyFindFirst = jest.fn() as jest.MockedFunction<FamilyFindFirst>;
    familyFindFirst.mockResolvedValue(null);
    documentFindFirst = jest.fn() as jest.MockedFunction<DocumentFindFirst>;
    documentFindFirst.mockResolvedValue(null);
    expedienteDocUpdate = jest.fn() as jest.MockedFunction<
      (args: unknown) => Promise<unknown>
    >;
    expedienteDocUpdate.mockResolvedValue({ id: 'doc-001', vigente: false });
    auditLog = jest.fn() as jest.MockedFunction<AuditLog>;
    auditLog.mockResolvedValue(undefined);
    putObject = jest.fn() as jest.MockedFunction<
      (input: PutObjectInput) => Promise<StorageObjectMetadata>
    >;
    putObject.mockResolvedValue({
      key: 'stored-key',
      size: file.buffer.length,
      contentType: 'application/pdf',
    });
    deleteObject = jest.fn() as jest.MockedFunction<
      (key: string) => Promise<void>
    >;
    deleteObject.mockResolvedValue(undefined);
    tenantExecute = jest.fn() as jest.MockedFunction<TenantExecute>;
    tenantExecute.mockImplementation((work) =>
      work({ empleado: { findFirst: employeeFindFirst } }),
    );
    transaction = jest.fn() as jest.MockedFunction<Transaction>;
    transaction.mockImplementation((work) =>
      work({
        expedienteDocFamily: { create: expedienteDocFamilyCreate },
        expedienteDoc: {
          create: expedienteDocCreate,
          update: expedienteDocUpdate,
        },
      }),
    );

    service = new ExpedienteDocsService(
      {
        $transaction: transaction,
        expedienteDocFamily: { findFirst: familyFindFirst },
        expedienteDoc: { findFirst: documentFindFirst },
      } as unknown as PrismaService,
      { execute: tenantExecute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
      { putObject, deleteObject } as unknown as StorageService,
    );
  });

  it('stores, indexes and audits a manual document within the tenant', async () => {
    await expect(
      service.uploadManual(
        tenantId,
        userId,
        'admin@example.test',
        employeeId,
        ExpedienteCategoria.DOCUMENTO_PERSONAL,
        file,
      ),
    ).resolves.toEqual({ id: 'doc-001' });

    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    const storedInput = putObject.mock.calls[0]?.[0];
    expect(storedInput).toBeDefined();
    expect(storedInput?.body).toBe(file.buffer);
    expect(storedInput?.contentType).toBe('application/pdf');
    expect(storedInput?.key).toMatch(
      new RegExp(
        `^${tenantId}/expediente/${employeeId}/DOCUMENTO_PERSONAL/.+_v1\\.pdf$`,
      ),
    );

    const createInput = expedienteDocCreate.mock.calls[0]?.[0];
    expect(createInput).toBeDefined();
    expect(createInput?.data).toMatchObject({
      tenantId,
      empleadoId: employeeId,
      categoria: ExpedienteCategoria.DOCUMENTO_PERSONAL,
      nombre: 'cedula.pdf',
      mimeType: 'application/pdf',
      tamanoBytes: file.buffer.length,
      subidoPorId: userId,
    });
    expect(createInput?.data.generatedDocumentId).toBeUndefined();
    expect(createInput?.data).toMatchObject({
      version: 1,
      vigente: true,
      reemplazaId: undefined,
    });
    expect(expedienteDocFamilyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        tenantId,
        empleadoId: employeeId,
        categoria: ExpedienteCategoria.DOCUMENTO_PERSONAL,
        nombre: 'cedula.pdf',
      }),
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'EXPEDIENTE_DOCUMENT_UPLOADED',
        entityType: 'ExpedienteDoc',
      }),
      expect.anything(),
    );
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('does not store a document for an employee outside the tenant', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      service.uploadManual(
        tenantId,
        userId,
        'admin@example.test',
        employeeId,
        ExpedienteCategoria.OTRO,
        file,
      ),
    ).rejects.toThrow('Empleado no encontrado');

    expect(putObject).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates the next immutable revision in the same document family', async () => {
    const familyId = 'family-001';
    familyFindFirst.mockResolvedValue({
      id: familyId,
      categoria: ExpedienteCategoria.DOCUMENTO_PERSONAL,
    });
    documentFindFirst.mockResolvedValue({
      id: 'doc-001',
      version: 1,
      generatedDocumentId: null,
    });
    expedienteDocCreate.mockResolvedValue({ id: 'doc-002' });

    await expect(
      service.uploadManual(
        tenantId,
        userId,
        'admin@example.test',
        employeeId,
        ExpedienteCategoria.DOCUMENTO_PERSONAL,
        { ...file, originalname: 'cedula-actualizada.pdf' },
        familyId,
      ),
    ).resolves.toEqual({ id: 'doc-002' });

    expect(putObject.mock.calls[0]?.[0].key).toMatch(
      new RegExp(
        `^${tenantId}/expediente/${employeeId}/DOCUMENTO_PERSONAL/${familyId}_v2\\.pdf$`,
      ),
    );
    expect(expedienteDocUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-001' },
      data: { vigente: false },
    });
    expect(expedienteDocCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familiaId: familyId,
        reemplazaId: 'doc-001',
        version: 2,
        vigente: true,
      }),
    });
    expect(expedienteDocFamilyCreate).not.toHaveBeenCalled();
  });

  it('does not allow a revision to change document category', async () => {
    familyFindFirst.mockResolvedValue({
      id: 'family-001',
      categoria: ExpedienteCategoria.DOCUMENTO_PERSONAL,
    });

    await expect(
      service.uploadManual(
        tenantId,
        userId,
        'admin@example.test',
        employeeId,
        ExpedienteCategoria.CERTIFICADO,
        file,
        'family-001',
      ),
    ).rejects.toThrow('Una revisión debe conservar la familia documental');

    expect(putObject).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('removes the stored object when persistence or audit fails', async () => {
    auditLog.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.uploadManual(
        tenantId,
        userId,
        'admin@example.test',
        employeeId,
        ExpedienteCategoria.OTRO,
        file,
      ),
    ).rejects.toThrow('audit failed');

    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/_v1\.pdf$/),
    );
  });
});
