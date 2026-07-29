import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { GeneratedDocumentsService } from './generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import { PdfRenderService } from '../pdf-render/pdf-render.service';

describe('GeneratedDocumentsService.generatePdf', () => {
  let service: GeneratedDocumentsService;

  const mockFindFirst = jest.fn();
  const mockDocumentTemplateFindFirst = jest.fn();
  const mockGeneratedDocumentCreate = jest.fn();
  const mockGeneratedDocumentDelete = jest.fn();
  const mockTenantPrismaExecute = jest.fn();
  const mockTenantFindUnique = jest.fn();
  const mockTransaction = jest.fn();
  const mockTxCreate = jest.fn();
  const mockTxUpdate = jest.fn();
  const mockGeneratedDocumentUpdate = jest.fn();
  const mockExpedienteDocFindFirst = jest.fn();
  const mockCreateFromGeneratedDoc = jest.fn();
  const mockPublishGeneratedDocument = jest.fn();
  const mockAuditLog = jest.fn();
  const mockPutObject = jest.fn();
  const mockObjectExists = jest.fn();
  const mockGetObject = jest.fn();
  const mockRenderPdf = jest.fn();

  beforeEach(async () => {
    mockFindFirst.mockReset().mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      contenidoFinal: '<p>Contenido</p>',
      employee: {
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Gómez',
        segundoApellido: null,
        cedula: '123',
      },
      tipo: 'CERTIFICATION',
      contratoId: null,
    });
    mockTenantFindUnique.mockReset().mockResolvedValue({
      id: 't1',
      razonSocial: 'Razón Social',
      nombre: 'Empresa',
      logoUrl: null,
    });
    mockTxUpdate.mockReset().mockResolvedValue({
      id: 'd1',
      pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      nombre: 'Documento',
      tipo: 'CERTIFICATION',
      employeeId: 'e1',
      tenantId: 't1',
      contratoId: null,
    });
    mockTxCreate.mockReset().mockResolvedValue({ id: 'd-certification' });
    mockTransaction
      .mockReset()
      .mockImplementation((cb: (tx: unknown) => unknown) =>
        cb({
          generatedDocument: {
            create: mockTxCreate,
            update: mockTxUpdate,
          },
        }),
      );
    mockCreateFromGeneratedDoc.mockReset().mockResolvedValue(undefined);
    mockPublishGeneratedDocument.mockReset().mockResolvedValue({
      outcome: 'CREATED',
      expedienteDocId: 'expediente-001',
      generatedDocumentId: 'd1',
    });
    mockAuditLog.mockReset().mockResolvedValue(undefined);
    mockPutObject.mockReset().mockResolvedValue({ key: 'k', size: 5 });
    mockObjectExists.mockReset().mockResolvedValue(false);
    mockGetObject.mockReset();
    mockRenderPdf.mockReset().mockResolvedValue(Buffer.from('PDF-BYTES'));
    mockGeneratedDocumentUpdate.mockReset();
    mockExpedienteDocFindFirst.mockReset().mockResolvedValue(null);
    mockDocumentTemplateFindFirst.mockReset();
    mockGeneratedDocumentCreate.mockReset();
    mockGeneratedDocumentDelete.mockReset();
    mockTenantPrismaExecute.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeneratedDocumentsService,
        {
          provide: PrismaService,
          useValue: {
            generatedDocument: {
              findFirst: mockFindFirst,
              update: mockGeneratedDocumentUpdate,
              create: mockGeneratedDocumentCreate,
              delete: mockGeneratedDocumentDelete,
            },
            expedienteDoc: { findFirst: mockExpedienteDocFindFirst },
            documentTemplate: { findFirst: mockDocumentTemplateFindFirst },
            tenant: { findUnique: mockTenantFindUnique },
            $transaction: mockTransaction,
          },
        },
        {
          provide: TenantPrismaService,
          useValue: { execute: mockTenantPrismaExecute },
        },
        {
          provide: ExpedienteDocsService,
          useValue: {
            createFromGeneratedDoc: mockCreateFromGeneratedDoc,
            publishGeneratedDocument: mockPublishGeneratedDocument,
          },
        },
        { provide: AuditService, useValue: { log: mockAuditLog } },
        {
          provide: StorageService,
          useValue: {
            putObject: mockPutObject,
            objectExists: mockObjectExists,
            getObject: mockGetObject,
          },
        },
        { provide: PdfRenderService, useValue: { renderPdf: mockRenderPdf } },
      ],
    }).compile();

    service = moduleRef.get(GeneratedDocumentsService);
  });

  it('rechaza generar CONTRACT mediante el flujo legacy', async () => {
    mockTenantPrismaExecute.mockImplementation((callback) =>
      callback({ empleado: { findFirst: jest.fn().mockResolvedValue({}) } }),
    );
    mockDocumentTemplateFindFirst.mockResolvedValue({
      id: 'template-contract',
      tipo: 'CONTRACT',
      activo: true,
    });

    await expect(
      service.generate('t1', 'u1', {
        employeeId: 'employee-001',
        templateId: 'template-contract',
        nombre: 'Contrato',
      }),
    ).rejects.toThrow(
      'Los documentos CONTRACT deben generarse desde el contrato.',
    );

    expect(mockGeneratedDocumentCreate).not.toHaveBeenCalled();
  });

  it('emite CERTIFICATION con contenidoFinal canónico y auditoría transaccional', async () => {
    const employee = {
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Gómez',
      segundoApellido: null,
      tipoDocumento: 'CC',
      cedula: '123',
      cargo: 'Analista',
      salario: 1000000,
      tipoContrato: 'TERMINO_INDEFINIDO',
      fechaIngreso: new Date('2025-01-01'),
      sedeRef: null,
    };
    mockTenantPrismaExecute.mockImplementation((callback) =>
      callback({
        empleado: { findFirst: jest.fn().mockResolvedValue(employee) },
      }),
    );
    mockDocumentTemplateFindFirst.mockResolvedValue({
      id: 'template-certification',
      tipo: 'CERTIFICATION',
      activo: true,
      contenido: '<p>{{NOMBRE_COMPLETO}} — {{CARGO}} — {{EMPRESA}}</p>',
    });

    await expect(
      service.generate('t1', 'u1', {
        employeeId: 'employee-001',
        templateId: 'template-certification',
        nombre: 'Certificación',
      }),
    ).resolves.toEqual({ id: 'd-certification' });

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contenidoFinal: '<p>Ana Gómez — Analista — Razón Social</p>',
        tipo: 'CERTIFICATION',
      }),
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CERTIFICATION_ISSUED',
        entityId: 'd-certification',
        metadata: {
          employeeId: 'employee-001',
          templateId: 'template-certification',
        },
      }),
      expect.anything(),
    );
    expect(mockGeneratedDocumentCreate).not.toHaveBeenCalled();
  });

  it('crea un nuevo GeneratedDocument por cada solicitud explícita de CERTIFICATION', async () => {
    const employee = {
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Gómez',
      segundoApellido: null,
      tipoDocumento: 'CC',
      cedula: '123',
      cargo: 'Analista',
      salario: 1000000,
      tipoContrato: 'TERMINO_INDEFINIDO',
      fechaIngreso: new Date('2025-01-01'),
      sedeRef: null,
    };
    mockTenantPrismaExecute.mockImplementation((callback) =>
      callback({
        empleado: { findFirst: jest.fn().mockResolvedValue(employee) },
      }),
    );
    mockDocumentTemplateFindFirst.mockResolvedValue({
      id: 'template-certification',
      tipo: 'CERTIFICATION',
      activo: true,
      contenido: '<p>{{NOMBRE_COMPLETO}}</p>',
    });
    mockTxCreate
      .mockResolvedValueOnce({ id: 'd-certification-1' })
      .mockResolvedValueOnce({ id: 'd-certification-2' });

    await service.generate('t1', 'u1', {
      employeeId: 'employee-001',
      templateId: 'template-certification',
      nombre: 'Certificación 1',
    });
    await service.generate('t1', 'u1', {
      employeeId: 'employee-001',
      templateId: 'template-certification',
      nombre: 'Certificación 2',
    });

    expect(mockTxCreate).toHaveBeenCalledTimes(2);
    expect(mockTxCreate.mock.calls[0][0].data.nombre).toBe('Certificación 1');
    expect(mockTxCreate.mock.calls[1][0].data.nombre).toBe('Certificación 2');
  });

  it('rechaza renderizar CONTRACT mediante generate-pdf legacy', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'd-contract',
      tenantId: 't1',
      contenidoFinal: '<p>Contrato</p>',
      tipo: 'CONTRACT',
      contratoId: 'contract-001',
      employee: {
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Gómez',
        segundoApellido: null,
        cedula: '123',
      },
    });

    await expect(service.generatePdf('t1', 'u1', 'd-contract')).rejects.toThrow(
      'Los documentos CONTRACT deben renderizarse desde el contrato.',
    );

    expect(mockRenderPdf).not.toHaveBeenCalled();
    expect(mockCreateFromGeneratedDoc).not.toHaveBeenCalled();
  });

  it('impide eliminar un GeneratedDocument CONTRACT publicado', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'd-contract',
      tenantId: 't1',
      tipo: 'CONTRACT',
    });

    await expect(service.remove('t1', 'd-contract')).rejects.toThrow(
      'Los documentos CONTRACT publicados son inmutables',
    );

    expect(mockGeneratedDocumentDelete).not.toHaveBeenCalled();
  });

  it('impide eliminar un GeneratedDocument CERTIFICATION publicado', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'd-certification',
      tenantId: 't1',
      tipo: 'CERTIFICATION',
    });
    mockExpedienteDocFindFirst.mockResolvedValue({ id: 'expediente-001' });

    await expect(service.remove('t1', 'd-certification')).rejects.toThrow(
      'Los documentos CERTIFICATION publicados son inmutables',
    );

    expect(mockGeneratedDocumentDelete).not.toHaveBeenCalled();
  });

  it('mantiene la eliminación para GeneratedDocument no publicado', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({
      id: 'd-letter',
      tenantId: 't1',
      tipo: 'LETTER',
    });
    mockGeneratedDocumentDelete.mockResolvedValue({ id: 'd1' });

    await expect(service.remove('t1', 'd-letter')).resolves.toEqual({
      id: 'd1',
    });

    expect(mockGeneratedDocumentDelete).toHaveBeenCalledWith({
      where: { id: 'd-letter' },
    });
  });

  it('materializa y publica CERTIFICATION exclusivamente desde contenidoFinal', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        nombre: 'Certificación',
        tipo: 'CERTIFICATION',
      })
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contenido canónico</p>',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
      });
    mockPutObject.mockResolvedValue({ key: 'pdfs/t1-d1.pdf', size: 9 });

    const result = await service.generatePdf('t1', 'u1', 'd1');

    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    expect(mockRenderPdf).toHaveBeenCalledWith(
      expect.stringContaining('Contenido canónico'),
    );
    expect(mockTenantFindUnique).not.toHaveBeenCalled();
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    const arg = mockPutObject.mock.calls[0][0];
    expect(arg.key).toBe('pdfs/t1-d1.pdf');
    expect(arg.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(arg.body)).toBe(true);
    expect(result.pdfUrl).toBe('/uploads/pdfs/t1-d1.pdf');
    expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: {
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfSizeBytes: 9,
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
        estado: 'MATERIALIZADO',
      },
    });
    expect(mockCreateFromGeneratedDoc).not.toHaveBeenCalled();
    expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
      't1',
      'u1',
      'd1',
      expect.objectContaining({
        id: 'd1',
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      }),
    );
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('reutiliza el PDF canónico existente al completar la publicación de CERTIFICATION', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        nombre: 'Certificación',
        tipo: 'CERTIFICATION',
      })
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contenido canónico</p>',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
      });
    mockObjectExists.mockResolvedValue(true);
    mockGetObject.mockResolvedValue(Buffer.from('PDF existente'));
    mockPublishGeneratedDocument.mockResolvedValue({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-001',
      generatedDocumentId: 'd1',
    });

    await service.generatePdf('t1', 'u1', 'd1');

    expect(mockRenderPdf).not.toHaveBeenCalled();
    expect(mockPutObject).not.toHaveBeenCalled();
    expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
      't1',
      'u1',
      'd1',
      expect.objectContaining({
        materialized: false,
        pdfSizeBytes: Buffer.byteLength('PDF existente'),
      }),
    );
  });

  it('mantiene el flujo legacy para tipos no contractuales distintos de CERTIFICATION', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        nombre: 'Carta',
        tipo: 'LETTER',
      })
      .mockResolvedValueOnce({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contenido</p>',
        employee: {
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Gómez',
          segundoApellido: null,
          cedula: '123',
        },
        tipo: 'LETTER',
        contratoId: null,
      });

    await service.generatePdf('t1', 'u1', 'd1');

    expect(mockCreateFromGeneratedDoc).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PDF_GENERATE' }),
    );
  });

  describe('materializePdf', () => {
    it('renderiza únicamente contenidoFinal sin publicar metadata aún', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contrato inmutable</p>',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
      });
      mockPutObject.mockResolvedValue({ key: 'pdfs/t1-d1.pdf', size: 9 });

      const result = await service.materializePdf('t1', 'd1');

      expect(mockTenantFindUnique).not.toHaveBeenCalled();
      expect(mockRenderPdf).toHaveBeenCalledWith(
        expect.stringContaining('<p>Contrato inmutable</p>'),
      );
      expect(mockRenderPdf).not.toHaveBeenCalledWith(
        expect.stringContaining('Ana'),
      );
      expect(mockPutObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'pdfs/t1-d1.pdf',
          contentType: 'application/pdf',
        }),
      );
      expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          pdfStorageKey: 'pdfs/t1-d1.pdf',
          pdfSizeBytes: 9,
          pdfUrl: '/uploads/pdfs/t1-d1.pdf',
          estado: 'MATERIALIZADO',
        },
      });
      expect(result).toEqual({
        id: 'd1',
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfSizeBytes: 9,
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
        materialized: true,
      });
      expect(mockCreateFromGeneratedDoc).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('recupera metadata de un PDF físico existente sin volver a renderizar', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contrato inmutable</p>',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
      });
      mockObjectExists.mockResolvedValue(true);
      mockGetObject.mockResolvedValue(Buffer.from('PDF existente'));

      const result = await service.materializePdf('t1', 'd1');

      expect(mockRenderPdf).not.toHaveBeenCalled();
      expect(mockPutObject).not.toHaveBeenCalled();
      expect(mockGetObject).toHaveBeenCalledWith('pdfs/t1-d1.pdf');
      expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          pdfStorageKey: 'pdfs/t1-d1.pdf',
          pdfSizeBytes: Buffer.byteLength('PDF existente'),
          pdfUrl: '/uploads/pdfs/t1-d1.pdf',
          estado: 'MATERIALIZADO',
        },
      });
      expect(result).toMatchObject({
        pdfSizeBytes: Buffer.byteLength('PDF existente'),
        materialized: false,
      });
    });

    it('reintenta sobre el mismo PDF físico sin publicar metadata por separado', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contrato inmutable</p>',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
      });
      mockObjectExists.mockResolvedValue(true);
      mockGetObject.mockResolvedValue(Buffer.from('PDF existente'));

      const first = await service.materializePdf('t1', 'd1');
      const second = await service.materializePdf('t1', 'd1');

      expect(second).toEqual(first);
      expect(mockRenderPdf).not.toHaveBeenCalled();
      expect(mockPutObject).not.toHaveBeenCalled();
      expect(mockGeneratedDocumentUpdate).toHaveBeenCalledTimes(2);
    });

    it('devuelve metadata canónica desde el artefacto físico sin persistirla', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contrato inmutable</p>',
        pdfStorageKey: 'legacy/t1-d1.pdf',
        pdfSizeBytes: 1,
        pdfUrl: '/uploads/legacy/t1-d1.pdf',
      });
      mockObjectExists.mockResolvedValue(true);
      mockGetObject.mockResolvedValue(Buffer.from('PDF canónico'));

      const result = await service.materializePdf('t1', 'd1');

      expect(mockRenderPdf).not.toHaveBeenCalled();
      expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          pdfStorageKey: 'pdfs/t1-d1.pdf',
          pdfSizeBytes: Buffer.byteLength('PDF canónico'),
          pdfUrl: '/uploads/pdfs/t1-d1.pdf',
          estado: 'MATERIALIZADO',
        },
      });
      expect(result).toMatchObject({
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfSizeBytes: Buffer.byteLength('PDF canónico'),
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      });
    });

    it('mantiene el filtro de tenant al recuperar el documento', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(service.materializePdf('tenant-otro', 'd1')).rejects.toThrow(
        'Documento generado no encontrado',
      );

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'd1', tenantId: 'tenant-otro' },
        select: expect.any(Object),
      });
    });

    it('no escribe metadata cuando el documento y el artefacto ya están sincronizados', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        tenantId: 't1',
        contenidoFinal: '<p>Contrato inmutable</p>',
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfSizeBytes: Buffer.byteLength('PDF existente'),
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
        estado: 'MATERIALIZADO',
      });
      mockObjectExists.mockResolvedValue(true);
      mockGetObject.mockResolvedValue(Buffer.from('PDF existente'));

      await service.materializePdf('t1', 'd1');

      expect(mockGeneratedDocumentUpdate).not.toHaveBeenCalled();
      expect(mockRenderPdf).not.toHaveBeenCalled();
    });
  });

  describe('getPdfForDownload', () => {
    it('lee mediante StorageService después de filtrar por tenant', async () => {
      const body = Buffer.from('PDF privado');
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        nombre: 'Certificación laboral',
        pdfStorageKey: 'pdfs/t1-d1.pdf',
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      });
      mockGetObject.mockResolvedValue(body);

      await expect(service.getPdfForDownload('t1', 'd1')).resolves.toEqual({
        nombre: 'Certificación laboral',
        body,
      });
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'd1', tenantId: 't1' },
        select: {
          id: true,
          nombre: true,
          pdfStorageKey: true,
          pdfUrl: true,
        },
      });
      expect(mockGetObject).toHaveBeenCalledWith('pdfs/t1-d1.pdf');
    });

    it('no intenta leer almacenamiento cuando el documento no pertenece al tenant', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(
        service.getPdfForDownload('tenant-otro', 'd1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockGetObject).not.toHaveBeenCalled();
    });

    it('usa la clave canónica como fallback para documentos existentes', async () => {
      const body = Buffer.from('PDF legado');
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        nombre: 'Documento legado',
        pdfStorageKey: 'legacy/missing.pdf',
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      });
      mockGetObject
        .mockRejectedValueOnce(
          new StorageObjectNotFoundError('legacy/missing.pdf'),
        )
        .mockResolvedValueOnce(body);

      await expect(service.getPdfForDownload('t1', 'd1')).resolves.toEqual({
        nombre: 'Documento legado',
        body,
      });
      expect(mockGetObject).toHaveBeenNthCalledWith(1, 'legacy/missing.pdf');
      expect(mockGetObject).toHaveBeenNthCalledWith(2, 'pdfs/t1-d1.pdf');
    });

    it('traduce la ausencia del archivo a NotFound', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'd1',
        nombre: 'Documento',
        pdfStorageKey: null,
        pdfUrl: '/uploads/pdfs/t1-d1.pdf',
      });
      mockGetObject.mockRejectedValue(
        new StorageObjectNotFoundError('pdfs/t1-d1.pdf'),
      );

      await expect(service.getPdfForDownload('t1', 'd1')).rejects.toThrow(
        'Archivo PDF no encontrado',
      );
    });
  });

  it('el código fuente no contiene Puppeteer ni escrituras directas a fs', () => {
    const src = fs.readFileSync(
      join(__dirname, 'generated-documents.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(
      /writeFileSync|writeFile\(|createWriteStream|mkdirSync/,
    );
    expect(src).not.toMatch(/puppeteer/);
    expect(src).not.toMatch(/getBrowser/);
    expect(src).toMatch(/pdfRender\.renderPdf/);
    expect(src).toMatch(/storage\.putObject/);
    expect(src).toMatch(/storage\.getObject/);
  });
});
