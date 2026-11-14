import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { DEFAULT_SYSTEM_ACCOUNT_MAPPINGS } from './system-account-mappings';

// Campos de la plantilla que se copian tal cual al clonar.
const CLONE_SELECT = {
  codigo: true,
  nombre: true,
  claseContable: true,
  naturaleza: true,
  nivel: true,
  cuentaPadreId: true,
  imputable: true,
  esCuentaSistema: true,
  requiereTercero: true,
  requiereCentroCosto: true,
  requiereBase: true,
} as const;

export interface ProvisioningResult {
  status: 'provisioned' | 'already_provisioned';
  cuentas: number;
  mapeos: number;
}

/**
 * Provisión contable por tenant: clona la plantilla PUC global (tenantId NULL)
 * al tenant y crea sus CuentaSistemaMap por defecto. Explícito, transaccional,
 * idempotente y reversible. NO contiene lógica contable (sin posteo, sin saldos).
 *
 * TipoComprobante es catálogo GLOBAL → no se clona.
 */
@Injectable()
export class AccountingProvisioningService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Clona el plan de cuentas global al tenant y siembra los mapeos de sistema.
   * Idempotente: si el tenant ya tiene cuentas, no hace nada (no-op).
   */
  async clonarPlanDeCuentas(
    tenantId: string,
    userId: string,
  ): Promise<ProvisioningResult> {
    await this.ensureTenantExists(tenantId);

    const result = await this.prisma.$transaction(async (tx) => {
      const yaProvisionado = await tx.cuentaContable.count({
        where: { tenantId },
      });
      if (yaProvisionado > 0) {
        return {
          status: 'already_provisioned' as const,
          cuentas: yaProvisionado,
          mapeos: await tx.cuentaSistemaMap.count({ where: { tenantId } }),
        };
      }

      const plantilla = await tx.cuentaContable.findMany({
        where: { tenantId: null },
        select: { id: true, ...CLONE_SELECT },
      });
      if (plantilla.length === 0) {
        throw new ConflictException(
          'No existe plantilla PUC global. Ejecuta el seed antes de provisionar.',
        );
      }

      // id(plantilla) → codigo, para re-resolver cuentaPadreId tras el clon.
      const codigoPorIdPlantilla = new Map<string, string>();
      for (const c of plantilla) codigoPorIdPlantilla.set(c.id, c.codigo);

      // Crear de menor a mayor profundidad para que el padre ya exista.
      const ordenadas = [...plantilla].sort(
        (a, b) =>
          a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo),
      );

      const idNuevoPorCodigo = new Map<string, string>();
      for (const c of ordenadas) {
        const padreCodigo = c.cuentaPadreId
          ? (codigoPorIdPlantilla.get(c.cuentaPadreId) ?? null)
          : null;
        const cuentaPadreId = padreCodigo
          ? (idNuevoPorCodigo.get(padreCodigo) ?? null)
          : null;

        const creada = await tx.cuentaContable.create({
          data: {
            tenantId,
            codigo: c.codigo,
            nombre: c.nombre,
            claseContable: c.claseContable,
            naturaleza: c.naturaleza,
            nivel: c.nivel,
            cuentaPadreId,
            imputable: c.imputable,
            esCuentaSistema: c.esCuentaSistema,
            requiereTercero: c.requiereTercero,
            requiereCentroCosto: c.requiereCentroCosto,
            requiereBase: c.requiereBase,
          },
          select: { id: true },
        });
        idNuevoPorCodigo.set(c.codigo, creada.id);
      }

      // Mapeos de sistema: resolver rol → codigo → cuenta clonada del tenant.
      let mapeos = 0;
      for (const m of DEFAULT_SYSTEM_ACCOUNT_MAPPINGS) {
        const cuentaId = idNuevoPorCodigo.get(m.codigo);
        if (!cuentaId) {
          throw new InternalServerErrorException(
            `La plantilla PUC no contiene la cuenta de sistema ${m.codigo} (rol ${m.rol}).`,
          );
        }
        await tx.cuentaSistemaMap.create({
          data: { tenantId, rol: m.rol, cuentaId, descripcion: m.descripcion },
        });
        mapeos += 1;
      }

      return {
        status: 'provisioned' as const,
        cuentas: idNuevoPorCodigo.size,
        mapeos,
      };
    });

    if (result.status === 'provisioned') {
      this.audit
        .log({
          tenantId,
          userId,
          action: 'ACCOUNTING_PROVISIONED',
          entityType: 'CuentaContable',
          metadata: { cuentas: result.cuentas, mapeos: result.mapeos },
        })
        .catch(() => {});
    }

    return result;
  }

  /**
   * Reversión de la provisión (proceso explícito, NO expuesto como endpoint).
   * Rechaza tenants con movimientos antes de borrar; la FK RESTRICT del Ledger
   * conserva una barrera de integridad adicional. Reservado para procesos
   * internos de onboarding/tests.
   */
  async desaprovisionar(
    tenantId: string,
    userId: string,
  ): Promise<{ cuentas: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const cuentasConMovimientos = await tx.cuentaContable.count({
        where: { tenantId, movimientos: { some: {} } },
      });
      if (cuentasConMovimientos > 0) {
        throw new ConflictException(
          'No se puede desprovisionar la contabilidad de un tenant con movimientos contables.',
        );
      }

      await tx.cuentaSistemaMap.deleteMany({ where: { tenantId } });
      const { count } = await tx.cuentaContable.deleteMany({
        where: { tenantId },
      });
      return { cuentas: count };
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'ACCOUNTING_DEPROVISIONED',
        entityType: 'CuentaContable',
        metadata: { cuentas: result.cuentas },
      })
      .catch(() => {});

    return result;
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
  }
}
