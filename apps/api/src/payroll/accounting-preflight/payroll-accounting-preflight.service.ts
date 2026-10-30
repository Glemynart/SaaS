import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Roles mínimos que la futura causación de nómina necesita resolver. Este
 * contrato pertenece a Payroll: Accounting continúa siendo ajeno a conceptos
 * laborales y solo expone el diccionario CuentaSistemaMap.
 */
export const PAYROLL_ACCOUNTING_REQUIRED_ROLES = [
  'SALARIOS_POR_PAGAR',
  'APORTES_SALUD_POR_PAGAR',
  'APORTES_RIESGOS_LABORALES_POR_PAGAR',
  'APORTES_PARAFISCALES_POR_PAGAR',
  'APORTES_PENSION_POR_PAGAR',
  'PROVISION_CESANTIAS_POR_PAGAR',
  'PROVISION_INTERESES_CESANTIAS_POR_PAGAR',
  'PROVISION_VACACIONES_POR_PAGAR',
  'PROVISION_PRIMA_POR_PAGAR',
  'GASTO_SUELDOS',
  'GASTO_APORTES_SALUD',
  'GASTO_APORTES_PENSION',
  'GASTO_APORTES_RIESGOS_LABORALES',
  'GASTO_APORTES_CAJA',
  'GASTO_APORTES_ICBF',
  'GASTO_APORTES_SENA',
  'GASTO_PROVISION_CESANTIAS',
  'GASTO_PROVISION_INTERESES_CESANTIAS',
  'GASTO_PROVISION_PRIMA',
  'GASTO_PROVISION_VACACIONES',
] as const;

export type PayrollAccountingPreflightStatus = 'OK' | 'WARNING' | 'ERROR';

export interface PayrollAccountingPreflightValidation {
  code: string;
  message: string;
  severity: PayrollAccountingPreflightStatus;
  component:
    | 'EMPRESA'
    | 'ACCOUNTING_CONFIGURATION'
    | 'CUENTA_SISTEMA_MAP'
    | 'PERIODO_CONTABLE';
}

export interface PayrollAccountingPreflightResult {
  status: PayrollAccountingPreflightStatus;
  validations: PayrollAccountingPreflightValidation[];
}

export interface PayrollAccountingPreflightInput {
  /** Fecha que Payroll propone para la futura causación; no es un posteo. */
  fechaCausacion: Date;
}

type SystemAccountMapForPreflight = {
  rol: string;
  activo: boolean;
  cuenta: {
    codigo: string;
    activa: boolean;
    imputable: boolean;
    deletedAt: Date | null;
  } | null;
};

type AccountingPeriodForPreflight = { estado: 'ABIERTO' | 'CERRADO' } | null;

const ERROR = 'ERROR' as const;
const OK = 'OK' as const;

function validation(
  code: string,
  message: string,
  severity: PayrollAccountingPreflightStatus,
  component: PayrollAccountingPreflightValidation['component'],
): PayrollAccountingPreflightValidation {
  return { code, message, severity, component };
}

function validateCompanyConfiguration(
  companyExists: boolean,
  accountCount: number,
): PayrollAccountingPreflightValidation[] {
  const validations: PayrollAccountingPreflightValidation[] = [];

  validations.push(
    companyExists
      ? validation(
          'COMPANY_CONFIGURATION_READY',
          'La empresa posee una configuración activa para contabilidad.',
          OK,
          'EMPRESA',
        )
      : validation(
          'COMPANY_CONFIGURATION_MISSING',
          'No existe una empresa activa para validar la configuración contable.',
          ERROR,
          'EMPRESA',
        ),
  );

  validations.push(
    accountCount > 0
      ? validation(
          'ACCOUNTING_CONFIGURATION_READY',
          'Existe un plan de cuentas contable para la empresa.',
          OK,
          'ACCOUNTING_CONFIGURATION',
        )
      : validation(
          'ACCOUNTING_CONFIGURATION_MISSING',
          'La empresa no tiene un plan de cuentas contable configurado.',
          ERROR,
          'ACCOUNTING_CONFIGURATION',
        ),
  );

  return validations;
}

function validateSystemAccountMaps(
  maps: SystemAccountMapForPreflight[],
): PayrollAccountingPreflightValidation[] {
  const mapsByRole = new Map(maps.map((map) => [map.rol, map]));

  return PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((role) => {
    const map = mapsByRole.get(role);
    if (!map) {
      return validation(
        'SYSTEM_ACCOUNT_MAP_MISSING',
        `Falta el mapeo de cuenta del sistema requerido: ${role}.`,
        ERROR,
        'CUENTA_SISTEMA_MAP',
      );
    }

    if (!map.activo) {
      return validation(
        'SYSTEM_ACCOUNT_MAP_INACTIVE',
        `El mapeo de cuenta del sistema ${role} está inactivo.`,
        ERROR,
        'CUENTA_SISTEMA_MAP',
      );
    }

    if (!map.cuenta || map.cuenta.deletedAt) {
      return validation(
        'SYSTEM_ACCOUNT_MISSING',
        `La cuenta configurada para ${role} no existe o fue eliminada.`,
        ERROR,
        'CUENTA_SISTEMA_MAP',
      );
    }

    if (!map.cuenta.activa) {
      return validation(
        'SYSTEM_ACCOUNT_INACTIVE',
        `La cuenta ${map.cuenta.codigo} configurada para ${role} está inactiva.`,
        ERROR,
        'CUENTA_SISTEMA_MAP',
      );
    }

    if (!map.cuenta.imputable) {
      return validation(
        'SYSTEM_ACCOUNT_NOT_IMPUTABLE',
        `La cuenta ${map.cuenta.codigo} configurada para ${role} no es imputable.`,
        ERROR,
        'CUENTA_SISTEMA_MAP',
      );
    }

    return validation(
      'SYSTEM_ACCOUNT_MAP_READY',
      `El mapeo ${role} apunta a una cuenta contable activa.`,
      OK,
      'CUENTA_SISTEMA_MAP',
    );
  });
}

function validateAccountingPeriod(
  period: AccountingPeriodForPreflight,
): PayrollAccountingPreflightValidation {
  if (!period) {
    return validation(
      'ACCOUNTING_PERIOD_MISSING',
      'No existe un período contable para la fecha de causación propuesta.',
      ERROR,
      'PERIODO_CONTABLE',
    );
  }

  if (period.estado !== 'ABIERTO') {
    return validation(
      'ACCOUNTING_PERIOD_CLOSED',
      'El período contable de la fecha de causación propuesta está cerrado.',
      ERROR,
      'PERIODO_CONTABLE',
    );
  }

  return validation(
    'ACCOUNTING_PERIOD_READY',
    'Existe un período contable abierto para la fecha de causación propuesta.',
    OK,
    'PERIODO_CONTABLE',
  );
}

function resolveStatus(
  validations: PayrollAccountingPreflightValidation[],
): PayrollAccountingPreflightStatus {
  if (validations.some((item) => item.severity === ERROR)) return ERROR;
  if (validations.some((item) => item.severity === 'WARNING')) return 'WARNING';
  return OK;
}

/**
 * Diagnóstico de solo lectura previo a la causación. No conoce montos ni
 * conceptos de nómina, no construye líneas y nunca invoca LedgerService.
 */
@Injectable()
export class PayrollAccountingPreflightService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    tenantId: string,
    input: PayrollAccountingPreflightInput,
  ): Promise<PayrollAccountingPreflightResult> {
    const [company, accountCount, maps, period] = await Promise.all([
      this.prisma.tenant.findFirst({
        where: { id: tenantId, activo: true },
        select: { id: true },
      }),
      this.prisma.cuentaContable.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.cuentaSistemaMap.findMany({
        where: {
          tenantId,
          rol: { in: [...PAYROLL_ACCOUNTING_REQUIRED_ROLES] },
        },
        select: {
          rol: true,
          activo: true,
          cuenta: {
            select: {
              codigo: true,
              activa: true,
              imputable: true,
              deletedAt: true,
            },
          },
        },
      }),
      this.prisma.periodoContable.findFirst({
        where: {
          tenantId,
          fechaInicio: { lte: input.fechaCausacion },
          fechaFin: { gte: input.fechaCausacion },
        },
        select: { estado: true },
      }),
    ]);

    const validations = [
      ...validateCompanyConfiguration(Boolean(company), accountCount),
      ...validateSystemAccountMaps(maps),
      validateAccountingPeriod(period),
    ];

    return { status: resolveStatus(validations), validations };
  }
}
