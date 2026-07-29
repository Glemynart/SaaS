import { DocumentTemplateType } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentResolutionService } from './document-resolution.service';

const loteFindFirst = jest.fn();
const employeeFindMany = jest.fn();
const relationshipFindMany = jest.fn();
const configurationFindMany = jest.fn();
const planUpsert = jest.fn();
const planFindMany = jest.fn();
const execute = jest.fn();
const TENANT = 'tenant-001';
const LOTE = '11111111-1111-4111-8111-111111111111';
const EMPLOYEE = '22222222-2222-4222-8222-222222222222';

type MockClient = {
  loteContrato: { findFirst: typeof loteFindFirst };
  empleado: { findMany: typeof employeeFindMany };
  vinculoLaboral: { findMany: typeof relationshipFindMany };
  configuracionDocumentalPerfil: { findMany: typeof configurationFindMany };
  batchDocumentGenerationPlan: {
    upsert: typeof planUpsert;
    findMany: typeof planFindMany;
  };
};

const lote = {
  configuracion: { empleadoIds: [EMPLOYEE] },
  documentTemplate: { tipo: DocumentTemplateType.CONTRACT },
};
const employee = { id: EMPLOYEE, primerNombre: 'Ana', primerApellido: 'López' };
const relationship = {
  id: 'relationship',
  empleadoId: EMPLOYEE,
  perfilContractualId: 'profile',
  perfilContractual: {
    id: 'profile',
    codigo: 'DOCENTE',
    nombre: 'Docente',
    activo: true,
  },
};
const configuration = {
  id: 'configuration',
  perfilContractualId: 'profile',
  plantillaId: 'template',
  vigenteDesde: new Date('2026-01-01'),
  vigenteHasta: null,
  plantilla: {
    id: 'template',
    nombre: 'Contrato docente',
    updatedAt: new Date('2026-01-01'),
    contenido: 'versión confirmada',
  },
};

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

describe('DocumentResolutionService', () => {
  let service: DocumentResolutionService;
  beforeEach(() => {
    jest.clearAllMocks();
    loteFindFirst.mockResolvedValue(lote);
    employeeFindMany.mockResolvedValue([employee]);
    relationshipFindMany.mockResolvedValue([relationship]);
    configurationFindMany.mockResolvedValue([configuration]);
    planFindMany.mockResolvedValue([]);
    execute.mockImplementation(
      (work: (client: MockClient, context: { tenantId: string }) => unknown) =>
        work(
          {
            loteContrato: { findFirst: loteFindFirst },
            empleado: { findMany: employeeFindMany },
            vinculoLaboral: { findMany: relationshipFindMany },
            configuracionDocumentalPerfil: { findMany: configurationFindMany },
            batchDocumentGenerationPlan: {
              upsert: planUpsert,
              findMany: planFindMany,
            },
          },
          { tenantId: TENANT },
        ),
    );
    service = new DocumentResolutionService({
      execute,
    } as unknown as TenantPrismaService);
  });
  const preview = () =>
    service.preview({ loteId: LOTE, fechaProceso: '2026-06-01' });
  const confirm = () =>
    service.confirm({ loteId: LOTE, fechaProceso: '2026-06-01' });

  it('confirma planes con snapshots y el tenant de la transacción', async () => {
    planUpsert.mockResolvedValue({ id: 'plan-1' });
    await expect(confirm()).resolves.toEqual([{ id: 'plan-1' }]);
    expect(planUpsert).toHaveBeenCalledWith(
      objectContaining({
        create: objectContaining({
          tenantId: TENANT,
          loteId: LOTE,
          empleadoId: EMPLOYEE,
          perfilSnapshot: relationship.perfilContractual,
        }),
      }),
    );
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('permite una segunda confirmación sin duplicar ni modificar snapshots', async () => {
    const existingPlan = {
      id: 'plan-1',
      perfilSnapshot: relationship.perfilContractual,
    };
    planUpsert.mockResolvedValue(existingPlan);

    await expect(confirm()).resolves.toEqual([existingPlan]);
    await expect(confirm()).resolves.toEqual([existingPlan]);

    expect(planUpsert).toHaveBeenCalledTimes(2);
    expect(planUpsert).toHaveBeenLastCalledWith(
      objectContaining({ update: {}, create: objectContaining({}) }),
    );
  });

  it('reutiliza planes existentes sin volver a resolver cambios posteriores', async () => {
    const existingPlan = {
      id: 'plan-1',
      plantillaSnapshot: { contenido: 'histórico' },
    };
    planFindMany.mockResolvedValue([existingPlan]);
    relationshipFindMany.mockResolvedValue([]);
    configurationFindMany.mockResolvedValue([]);

    await expect(confirm()).resolves.toEqual([existingPlan]);
    expect(employeeFindMany).not.toHaveBeenCalled();
    expect(planUpsert).not.toHaveBeenCalled();
  });

  it('conserva el snapshot histórico cuando la plantilla cambia después de confirmar', async () => {
    const historicalSnapshot = {
      id: 'template',
      contenido: 'versión confirmada',
    };
    planUpsert.mockResolvedValue({
      id: 'plan-1',
      plantillaSnapshot: historicalSnapshot,
    });
    await confirm();

    planFindMany.mockResolvedValue([
      { id: 'plan-1', plantillaSnapshot: historicalSnapshot },
    ]);
    configuration.plantilla = {
      ...configuration.plantilla,
      contenido: 'versión posterior',
    };

    await expect(confirm()).resolves.toEqual([
      { id: 'plan-1', plantillaSnapshot: historicalSnapshot },
    ]);
    expect(planUpsert).toHaveBeenCalledTimes(1);
    expect(configurationFindMany).toHaveBeenCalledTimes(1);
  });

  it('hace rollback lógico sin crear planes si hay una resolución bloqueada', async () => {
    relationshipFindMany.mockResolvedValue([]);
    await expect(confirm()).rejects.toThrow();
    expect(planUpsert).not.toHaveBeenCalled();
  });

  it('resuelve una plantilla vigente de forma determinística', async () => {
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({
        estado: 'RESUELTO',
        plantillaSeleccionada: configuration.plantilla,
        tipoDocumental: DocumentTemplateType.CONTRACT,
      }),
    ]);
  });
  it('bloquea el vínculo inexistente', async () => {
    relationshipFindMany.mockResolvedValue([]);
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({
        estado: 'BLOQUEADO',
        motivoBloqueo: 'VINCULO_INEXISTENTE_O_FUERA_DE_VIGENCIA',
      }),
    ]);
  });
  it('bloquea un perfil inactivo', async () => {
    relationshipFindMany.mockResolvedValue([
      {
        ...relationship,
        perfilContractual: { ...relationship.perfilContractual, activo: false },
      },
    ]);
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({ motivoBloqueo: 'PERFIL_INACTIVO' }),
    ]);
  });
  it('bloquea configuración inexistente, fuera de vigencia o plantilla inactiva', async () => {
    configurationFindMany.mockResolvedValue([]);
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({
        motivoBloqueo: 'CONFIGURACION_O_PLANTILLA_NO_VIGENTE',
      }),
    ]);
  });
  it('aísla empleados de otro tenant', async () => {
    employeeFindMany.mockResolvedValue([]);
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({
        motivoBloqueo: 'EMPLEADO_INEXISTENTE_O_FUERA_DEL_TENANT',
      }),
    ]);
    expect(employeeFindMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ tenantId: TENANT }),
      }),
    );
  });
  it('produce resultados independientes para múltiples empleados', async () => {
    const second = '33333333-3333-4333-8333-333333333333';
    loteFindFirst.mockResolvedValue({
      ...lote,
      configuracion: { empleadoIds: [EMPLOYEE, second] },
    });
    employeeFindMany.mockResolvedValue([employee, { ...employee, id: second }]);
    relationshipFindMany.mockResolvedValue([relationship]);
    await expect(preview()).resolves.toEqual([
      expect.objectContaining({ estado: 'RESUELTO' }),
      objectContaining({
        empleado: objectContaining({ id: second }),
        estado: 'BLOQUEADO',
      }),
    ]);
  });
});
