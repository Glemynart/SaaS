import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import { join } from 'path';
import { GeneratedDocumentsService } from './generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { StorageService } from '../storage/storage.service';
import { PdfRenderService } from '../pdf-render/pdf-render.service';

describe('GeneratedDocumentsService.generatePdf', () => {
  let service: GeneratedDocumentsService;

  const mockFindFirst = jest.fn();
  const mockTenantFindUnique = jest.fn();
  const mockTransaction = jest.fn();
  const mockTxUpdate = jest.fn();
  const mockGeneratedDocumentUpdate = jest.fn();
  const mockCreateFromGeneratedDoc = jest.fn();
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
      tipo: 'CONTRATO',
      employeeId: 'e1',
      tenantId: 't1',
      contratoId: null,
    });
    mockTransaction
      .mockReset()
      .mockImplementation((cb: (tx: unknown) => unknown) =>
        cb({ generatedDocument: { update: mockTxUpdate } }),
      );
    mockCreateFromGeneratedDoc.mockReset().mockResolvedValue(undefined);
    mockAuditLog.mockReset().mockResolvedValue(undefined);
    mockPutObject.mockReset().mockResolvedValue({ key: 'k', size: 5 });
    mockObjectExists.mockReset().mockResolvedValue(false);
    mockGetObject.mockReset();
    mockRenderPdf.mockReset().mockResolvedValue(Buffer.from('PDF-BYTES'));
    mockGeneratedDocumentUpdate.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeneratedDocumentsService,
        {
          provide: PrismaService,
          useValue: {
            generatedDocument: {
              findFirst: mockFindFirst,
              update: mockGeneratedDocumentUpdate,
            },
            tenant: { findUnique: mockTenantFindUnique },
            $transaction: mockTransaction,
          },
        },
        {
          provide: TenantPrismaService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ExpedienteDocsService,
          useValue: { createFromGeneratedDoc: mockCreateFromGeneratedDoc },
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

  it('genera el PDF vía PdfRenderService y lo persiste vía StorageService', async () => {
    const result = await service.generatePdf('t1', 'u1', 'd1');

    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    expect(mockRenderPdf).toHaveBeenCalledWith(
      expect.stringContaining('Contenido'),
    );
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    const arg = mockPutObject.mock.calls[0][0];
    expect(arg.key).toBe('pdfs/t1-d1.pdf');
    expect(arg.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(arg.body)).toBe(true);
    expect(result.pdfUrl).toBe('/uploads/pdfs/t1-d1.pdf');
  });

  it('mantiene el flujo: registra ExpedienteDoc y audita', async () => {
    await service.generatePdf('t1', 'u1', 'd1');

    expect(mockCreateFromGeneratedDoc).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PDF_GENERATE' }),
    );
  });

  describe('materializePdf', () => {
    it('renderiza únicamente contenidoFinal y persiste la identidad canónica', async () => {
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
      expect(result).toMatchObject({
        pdfSizeBytes: Buffer.byteLength('PDF existente'),
        materialized: false,
      });
    });

    it('repara metadata no canónica desde el artefacto físico existente', async () => {
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

      await service.materializePdf('t1', 'd1');

      expect(mockRenderPdf).not.toHaveBeenCalled();
      expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          pdfStorageKey: 'pdfs/t1-d1.pdf',
          pdfSizeBytes: Buffer.byteLength('PDF canónico'),
          pdfUrl: '/uploads/pdfs/t1-d1.pdf',
        },
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
      });
      mockObjectExists.mockResolvedValue(true);
      mockGetObject.mockResolvedValue(Buffer.from('PDF existente'));

      await service.materializePdf('t1', 'd1');

      expect(mockGeneratedDocumentUpdate).not.toHaveBeenCalled();
      expect(mockRenderPdf).not.toHaveBeenCalled();
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
  });
});
