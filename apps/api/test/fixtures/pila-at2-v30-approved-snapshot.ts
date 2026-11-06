import { PILA_CONTRIBUTION_ROUNDING_RULE_VERSION } from '../../src/payroll/pila-contribution-rounding';
import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from '../../src/payroll/pila-risk-activity-catalog';
import { PILA_FSP_SUBACCOUNT_RULE_VERSION } from '../../src/payroll/pila-fsp-subaccounts';
import type { PilaSnapshotPreparationInput } from '../../src/payroll/pila-preparation';

export type PilaApprovedSnapshotFixtureInput = {
  tenantId?: string;
  periodId?: string;
  employeeId?: string;
  contractId?: string;
  actorId?: string;
  employeeDocumentNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  paymentDate?: string;
};

const riskActivityCode = [...PILA_RISK_ACTIVITY_CODES].find(
  (code) => code[0] === '1',
)!;
export function completeApprovedSnapshot(
  input: PilaApprovedSnapshotFixtureInput = {},
): PilaSnapshotPreparationInput {
  const {
    tenantId = 'tenant-1',
    periodId = 'period-1',
    employeeId = 'employee-1',
    contractId = 'contract-1',
    actorId = 'payroll-user-1',
    employeeDocumentNumber = '1234567890',
    periodStart = '2026-10-01',
    periodEnd = '2026-10-31',
    paymentDate = '2026-11-06',
  } = input;
  const base = 3_000_000;

  return {
    employeeId,
    payloadVersion: 9,
    payload: {
      schemaVersion: 9,
      period: {
        payrollPeriodId: periodId,
        fechaInicio: periodStart,
        fechaFin: periodEnd,
      },
      employer: {
        tenantId,
        razonSocial: 'Empresa Demo Ñ SAS',
        nit: '900123456',
        digitoVerif: '7',
        direccion: 'Calle Demo 10',
        email: 'nomina@example.test',
        telefono: '6011234567',
        aportesExonerados: false,
        municipio: { codigo: '11001' },
        pila: {
          tipoDocumentoAportante: 'NI',
          naturalezaJuridica: '2',
          tipoPersona: 'J',
          formaPresentacion: 'U',
          claseAportante: 'B',
          codigoActividadEconomica: '1234',
          codigoArlAportante: '123456',
          tipoAportante: '1',
          codigoSucursal: '',
          nombreSucursal: '',
          fax: '',
          aportesExoneradosConfirmado: false,
          beneficioCcfLey1429: false,
          beneficioLey1429: false,
          sinAccionEspecial: true,
          representanteNumeroDocumento: '900123456',
          representanteTipoDocumento: 'CC',
          representantePrimerApellido: 'Demo',
          representanteSegundoApellido: '',
          representantePrimerNombre: 'Ana',
          representanteSegundoNombre: '',
        },
      },
      employee: {
        employeeId,
        tipoDocumento: 'CC',
        cedula: employeeDocumentNumber,
        fechaIngreso: '2026-01-01',
        fechaRetiro: null,
        primerNombre: 'Ana',
        segundoNombre: '',
        primerApellido: 'Pérez',
        segundoApellido: '',
      },
      contract: {
        contractId,
        fechaInicio: '2026-01-01',
        fechaFin: null,
      },
      worksite: { municipio: { codigo: '11001' } },
      pilaWorkLocations: [
        {
          assignmentId: 'location-1',
          tenantId,
          municipioId: 'municipality-1',
          municipio: {
            id: 'municipality-1',
            codigo: '11001',
            nombre: 'Bogotá',
            departamento: 'Bogotá D.C.',
          },
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
        },
      ],
      affiliations: [
        {
          tipoCotizanteCodigo: '01',
          subtipoCotizanteCodigo: '00',
          epsCodigo: 'EPS001',
          fondoPensionCodigo: 'AFP001',
          arlCodigo: 'ARL001',
          arlClaseRiesgo: '1',
          indicadorTarifaEspecialPensiones: '',
          cajaCompensacionCodigo: 'CCF001',
          cajaCompensacionNombre: 'Caja Demo',
          cajaCompensacionDepartamentoCodigo: '11',
          extranjeroNoObligadoPension: null,
          colombianoEnElExterior: false,
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
        },
      ],
      pilaRiskAssignments: [
        {
          tenantId,
          codigoActividadEconomica: riskActivityCode,
          formatoNormativoVersion: PILA_RISK_ACTIVITY_CATALOG_VERSION,
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
          centroTrabajo: {
            tenantId,
            arlCodigo: 'ARL001',
            codigoCentro: '00012',
          },
        },
      ],
      pilaEvents: [],
      payroll: {
        fechaPrevistaPagoPila: paymentDate,
        salarioBasicoCampo40: { valor: base, bloqueos: [] },
        tipoSalario: 'F',
        tipoSalarioBloqueos: [],
        diasCotizadosPorSubsistema: {
          pension: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          salud: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          riesgos: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          cajaCompensacion: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
        },
        ibcPorSubsistema: {
          pension: { valor: base, sourceCount: 1 },
          salud: { valor: base, sourceCount: 1 },
          riesgos: { valor: base, sourceCount: 1 },
          cajaCompensacion: { valor: base, sourceCount: 1 },
          otrosParafiscales: {
            valor: base,
            reglaVersion: 'CO_PARAFISCAL_BASE_V1',
            bloqueos: [],
          },
        },
        concepts: [
          {
            codigo: 'PENSION_EMP',
            tipo: 'DEDUCTION',
            base,
            factor: 0.04,
            valor: 120_000,
          },
          {
            codigo: 'PENSION_PAT',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.12,
            valor: 360_000,
          },
          {
            codigo: 'SALUD_EMP',
            tipo: 'DEDUCTION',
            base,
            factor: 0.04,
            valor: 120_000,
          },
          {
            codigo: 'SALUD_PAT',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.085,
            valor: 255_000,
          },
          {
            codigo: 'ARL',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.00522,
            valor: 15_700,
          },
          {
            codigo: 'CAJA',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.04,
            valor: 120_000,
          },
          {
            codigo: 'SENA',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.02,
            valor: 60_000,
          },
          {
            codigo: 'ICBF',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base,
            factor: 0.03,
            valor: 90_000,
          },
        ],
        novelties: [],
        pilaEvents: [],
        fspSubaccounts: {
          sourceScope: 'SINGLE_SOURCE_CONFIRMED',
          sourceScopeUpdatedAt: '2026-10-01T12:00:00.000Z',
          sourceScopeUpdatedById: actorId,
          status: 'READY',
          blocker: null,
          ruleVersion: PILA_FSP_SUBACCOUNT_RULE_VERSION,
          roundingRuleVersion: PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
          ibcPensionalAgregado: base,
          smmlv: 1_750_905,
          solidaridad: 0,
          subsistencia: 0,
          payrollFspAmount: 0,
        },
        voluntaryPensionDeclaration: {
          status: 'NONE_CONFIRMED',
          declaredAt: '2026-10-31T12:00:00.000Z',
          declaredById: actorId,
        },
      },
    },
  };
}
