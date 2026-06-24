import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import { join } from 'path';
import { GeneratedDocumentsService } from './generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { StorageService } from '../storage/storage.service';

interface FakePage {
  setContent: jest.Mock;
  pdf: jest.Mock;
}
interface FakeBrowser {
  newPage: jest.Mock;
  close: jest.Mock;
}

describe('GeneratedDocumentsService.generatePdf', () => {
  let service: GeneratedDocumentsService;

  const mockFindFirst = jest.fn();
  const mockTenantFindUnique = jest.fn();
  const mockTransaction = jest.fn();
  const mockTxUpdate = jest.fn();
  const mockCreateFromGeneratedDoc = jest.fn();
  const mockAuditLog = jest.fn();
  const mockPutObject = jest.fn();

  let fakePage: FakePage;
  let fakeBrowser: FakeBrowser;

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeneratedDocumentsService,
        {
          provide: PrismaService,
          useValue: {
            generatedDocument: { findFirst: mockFindFirst },
            tenant: { findUnique: mockTenantFindUnique },
            $transaction: mockTransaction,
          },
        },
        {
          provide: ExpedienteDocsService,
          useValue: { createFromGeneratedDoc: mockCreateFromGeneratedDoc },
        },
        { provide: AuditService, useValue: { log: mockAuditLog } },
        { provide: StorageService, useValue: { putObject: mockPutObject } },
      ],
    }).compile();

    service = moduleRef.get(GeneratedDocumentsService);

    fakePage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('PDF-BYTES')),
    };
    fakeBrowser = {
      newPage: jest.fn().mockResolvedValue(fakePage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(
        service as unknown as { getBrowser: () => Promise<FakeBrowser> },
        'getBrowser',
      )
      .mockResolvedValue(fakeBrowser);
  });

  it('genera el PDF en buffer y lo persiste vía StorageService', async () => {
    const result = await service.generatePdf('t1', 'u1', 'd1');

    expect(mockPutObject).toHaveBeenCalledTimes(1);
    const arg = mockPutObject.mock.calls[0][0];
    expect(arg.key).toBe('pdfs/t1-d1.pdf');
    expect(arg.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(arg.body)).toBe(true);
    expect(result.pdfUrl).toBe('/uploads/pdfs/t1-d1.pdf');
  });

  it('invoca page.pdf sin la opción path (no escribe a disco)', async () => {
    await service.generatePdf('t1', 'u1', 'd1');

    expect(fakePage.pdf).toHaveBeenCalledWith(
      expect.not.objectContaining({ path: expect.anything() }),
    );
  });

  it('mantiene el flujo: registra ExpedienteDoc y audita', async () => {
    await service.generatePdf('t1', 'u1', 'd1');

    expect(mockCreateFromGeneratedDoc).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PDF_GENERATE' }),
    );
  });

  it('el código fuente no contiene escrituras directas a fs', () => {
    const src = fs.readFileSync(
      join(__dirname, 'generated-documents.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(
      /writeFileSync|writeFile\(|createWriteStream|mkdirSync/,
    );
    expect(src).toMatch(/storage\.putObject/);
  });
});
