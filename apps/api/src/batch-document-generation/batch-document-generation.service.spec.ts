import {
  BatchDocumentGenerationPlanStatus,
  GeneratedDocumentStatus,
  LoteEstado,
} from '@prisma/client';
import { PdfRenderService } from '../pdf-render/pdf-render.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { BatchDocumentGenerationService } from './batch-document-generation.service';

const loteFindFirst = jest.fn();
const planFindMany = jest.fn();
const planFindFirst = jest.fn();
const planUpdateMany = jest.fn();
const documentFindFirst = jest.fn();
const documentCreate = jest.fn();
const documentUpdateMany = jest.fn();
const templateFindFirst = jest.fn();
const employeeFindFirst = jest.fn();
const tenantFindFirst = jest.fn();
const renderPdf = jest.fn();
const objectExists = jest.fn();
const getObject = jest.fn();
const putObject = jest.fn();

const TENANT = 'tenant-001';
const LOTE = '11111111-1111-4111-8111-111111111111';
const PLAN = '22222222-2222-4222-8222-222222222222';
const DOCUMENT = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const TEMPLATE = '55555555-5555-4555-8555-555555555555';

function mockPrismaClient() {
  return {
    loteContrato: { findFirst: loteFindFirst },
    batchDocumentGenerationPlan: {
      findMany: planFindMany,
      findFirst: planFindFirst,
      updateMany: planUpdateMany,
    },
    generatedDocument: {
      findFirst: documentFindFirst,
      create: documentCreate,
      updateMany: documentUpdateMany,
    },
    documentTemplate: { findFirst: templateFindFirst },
    empleado: { findFirst: employeeFindFirst },
    tenant: { findFirst: tenantFindFirst },
  };
}

type TenantWork = (
  client: ReturnType<typeof mockPrismaClient>,
  context: { tenantId: string },
) => unknown;

const execute = jest.fn((work: TenantWork): unknown =>
  work(mockPrismaClient(), { tenantId: TENANT }),
);

const plan = {
  id: PLAN,
  tenantId: TENANT,
  empleadoId: EMPLOYEE,
  plantillaId: TEMPLATE,
  plantillaSnapshot: {
    id: TEMPLATE,
    nombre: 'Contrato laboral',
    contenido: 'CONTRATO {{NOMBRE_COMPLETO}} - {{EMPRESA}}',
  },
  tipoDocumental: 'CONTRACT' as const,
  estado: BatchDocumentGenerationPlanStatus.CONFIRMADO,
};

const employee = {
  id: EMPLOYEE,
  primerNombre: 'Ana',
  segundoNombre: null,
  primerApellido: 'López',
  segundoApellido: null,
  tipoDocumento: 'CC',
  cedula: '123456789',
  cargo: 'Analista',
  salario: 2500000,
  tipoContrato: 'TERMINO_INDEFINIDO',
  fechaIngreso: new Date('2026-01-15'),
  sedeRef: { nombre: 'Principal' },
};

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

describe('BatchDocumentGenerationService', () => {
  let service: BatchDocumentGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    loteFindFirst.mockResolvedValue({ estado: LoteEstado.EN_PROCESO });
    planFindMany.mockResolvedValue([{ id: PLAN }]);
    planFindFirst.mockResolvedValue(plan);
    planUpdateMany.mockResolvedValue({ count: 1 });
    documentFindFirst.mockResolvedValue(null);
    documentCreate.mockResolvedValue({
      id: DOCUMENT,
      estado: GeneratedDocumentStatus.PENDIENTE_MATERIALIZACION,
      contenidoFinal: 'CONTRATO Ana López - Empresa Uno',
    });
    documentUpdateMany.mockResolvedValue({ count: 1 });
    templateFindFirst.mockResolvedValue({
      id: TEMPLATE,
      nombre: 'Contrato laboral',
      tipo: 'CONTRACT',
    });
    employeeFindFirst.mockResolvedValue(employee);
    tenantFindFirst.mockResolvedValue({
      nombre: 'Empresa Uno',
      razonSocial: null,
      nit: '900123456',
      representanteLegal: 'Laura Gómez',
      logoUrl: null,
      firmaRepresentanteUrl: null,
    });
    renderPdf.mockResolvedValue(Buffer.from('PDF-BYTES'));
    objectExists.mockResolvedValue(false);
    getObject.mockResolvedValue(Buffer.from('PDF-BYTES'));
    putObject.mockResolvedValue({
      key: `pdfs/${TENANT}-${DOCUMENT}.pdf`,
      size: 9,
      contentType: 'application/pdf',
    });
    service = new BatchDocumentGenerationService(
      { execute } as unknown as TenantPrismaService,
      { renderPdf } as unknown as PdfRenderService,
      { objectExists, getObject, putObject } as unknown as StorageService,
    );
  });

  it('genera, renderiza, almacena y materializa el documento del plan', async () => {
    await expect(service.start(LOTE)).resolves.toEqual({
      loteId: LOTE,
      total: 1,
      documents: [
        { planId: PLAN, documentId: DOCUMENT, outcome: 'MATERIALIZED' },
      ],
    });

    expect(documentCreate).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          tenantId: TENANT,
          employeeId: EMPLOYEE,
          templateId: TEMPLATE,
          batchDocumentGenerationPlanId: PLAN,
          contenidoFinal: 'CONTRATO Ana López - Empresa Uno',
          tipo: 'CONTRACT',
        }),
      }),
    );
    expect(renderPdf).toHaveBeenCalledWith(
      expect.stringContaining('CONTRATO Ana López - Empresa Uno'),
    );
    expect(putObject).toHaveBeenCalledWith({
      key: `pdfs/${TENANT}-${DOCUMENT}.pdf`,
      body: Buffer.from('PDF-BYTES'),
      contentType: 'application/pdf',
    });
  });

  it('actualiza GeneratedDocument y consume el plan después de almacenar', async () => {
    await service.start(LOTE);

    expect(documentUpdateMany).toHaveBeenCalledWith({
      where: { id: DOCUMENT, tenantId: TENANT },
      data: {
        pdfStorageKey: `pdfs/${TENANT}-${DOCUMENT}.pdf`,
        pdfUrl: `/uploads/pdfs/${TENANT}-${DOCUMENT}.pdf`,
        pdfSizeBytes: 9,
        estado: GeneratedDocumentStatus.MATERIALIZADO,
      },
    });
    expect(planUpdateMany).toHaveBeenCalledWith({
      where: { id: PLAN, tenantId: TENANT },
      data: { estado: BatchDocumentGenerationPlanStatus.CONSUMIDO },
    });
  });

  it('no consume el plan si no se materializa exactamente un documento', async () => {
    documentUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.start(LOTE)).rejects.toThrow(
      'No se pudo materializar exactamente un documento generado.',
    );

    expect(planUpdateMany).not.toHaveBeenCalled();
    expect(documentUpdateMany).toHaveBeenLastCalledWith({
      where: { id: DOCUMENT, tenantId: TENANT },
      data: { estado: GeneratedDocumentStatus.FALLIDO },
    });
  });

  it('falla si no se consume exactamente un plan tras materializar el documento', async () => {
    planUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.start(LOTE)).rejects.toThrow(
      'No se pudo consumir exactamente un plan de generación.',
    );

    expect(planUpdateMany).toHaveBeenCalledTimes(1);
    expect(documentUpdateMany).toHaveBeenLastCalledWith({
      where: { id: DOCUMENT, tenantId: TENANT },
      data: { estado: GeneratedDocumentStatus.FALLIDO },
    });
  });

  it('reutiliza un documento materializado sin renderizar ni almacenar de nuevo', async () => {
    planFindFirst.mockResolvedValue({
      ...plan,
      estado: BatchDocumentGenerationPlanStatus.CONSUMIDO,
    });
    documentFindFirst.mockResolvedValue({
      id: DOCUMENT,
      estado: GeneratedDocumentStatus.MATERIALIZADO,
      contenidoFinal: 'snapshot existente',
    });

    await expect(service.start(LOTE)).resolves.toMatchObject({
      documents: [{ planId: PLAN, documentId: DOCUMENT, outcome: 'EXISTING' }],
    });

    expect(documentCreate).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(documentUpdateMany).not.toHaveBeenCalled();
    expect(planUpdateMany).not.toHaveBeenCalled();
  });

  it('recupera un documento fallido usando el artefacto ya almacenado', async () => {
    documentFindFirst.mockResolvedValue({
      id: DOCUMENT,
      estado: GeneratedDocumentStatus.FALLIDO,
      contenidoFinal: 'snapshot existente',
    });
    objectExists.mockResolvedValue(true);
    getObject.mockResolvedValue(Buffer.from('PDF existente'));

    await expect(service.start(LOTE)).resolves.toMatchObject({
      documents: [
        { planId: PLAN, documentId: DOCUMENT, outcome: 'MATERIALIZED' },
      ],
    });

    expect(documentCreate).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(documentUpdateMany).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          pdfSizeBytes: Buffer.byteLength('PDF existente'),
          estado: GeneratedDocumentStatus.MATERIALIZADO,
        }),
      }),
    );
  });

  it('marca el documento como FALLIDO si el render falla y conserva el plan', async () => {
    renderPdf.mockRejectedValue(new Error('render falló'));

    await expect(service.start(LOTE)).rejects.toThrow('render falló');

    expect(putObject).not.toHaveBeenCalled();
    expect(documentUpdateMany).toHaveBeenCalledWith({
      where: { id: DOCUMENT, tenantId: TENANT },
      data: { estado: GeneratedDocumentStatus.FALLIDO },
    });
    expect(planUpdateMany).not.toHaveBeenCalled();
  });

  it('marca el documento como FALLIDO si StorageService falla y conserva el plan', async () => {
    putObject.mockRejectedValue(new Error('storage falló'));

    await expect(service.start(LOTE)).rejects.toThrow('storage falló');

    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(documentUpdateMany).toHaveBeenCalledWith({
      where: { id: DOCUMENT, tenantId: TENANT },
      data: { estado: GeneratedDocumentStatus.FALLIDO },
    });
    expect(planUpdateMany).not.toHaveBeenCalled();
  });

  it('deja el documento recuperable si falla la persistencia después de almacenar', async () => {
    documentUpdateMany.mockRejectedValueOnce(new Error('persistencia falló'));

    await expect(service.start(LOTE)).rejects.toThrow('persistencia falló');

    expect(putObject).toHaveBeenCalledTimes(1);
    expect(documentUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: DOCUMENT, tenantId: TENANT },
      data: { estado: GeneratedDocumentStatus.FALLIDO },
    });
    expect(planUpdateMany).not.toHaveBeenCalled();
  });

  it('aísla lote, plan, plantilla, empleado y documento al tenant activo', async () => {
    await service.start(LOTE);

    expect(loteFindFirst).toHaveBeenCalledWith(
      objectContaining({ where: { id: LOTE, tenantId: TENANT } }),
    );
    expect(planFindMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ tenantId: TENANT, loteId: LOTE }),
      }),
    );
    expect(planFindFirst).toHaveBeenCalledWith(
      objectContaining({ where: { id: PLAN, tenantId: TENANT } }),
    );
    expect(documentFindFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          tenantId: TENANT,
          batchDocumentGenerationPlanId: PLAN,
        }),
      }),
    );
    expect(templateFindFirst).toHaveBeenCalledWith(
      objectContaining({ where: { id: TEMPLATE, tenantId: TENANT } }),
    );
    expect(employeeFindFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ id: EMPLOYEE, tenantId: TENANT }),
      }),
    );
  });
});
