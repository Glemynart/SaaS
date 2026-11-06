'use client';

import { useState } from 'react';
import { ClipboardCheck, FileDown, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useCreatePayrollPilaExport,
  usePayrollPilaExports,
  usePayrollPilaPreparation,
} from '../hooks/use-payroll';
import type {
  PilaDetailFieldCandidateStatus,
  PilaPreparationAffectedEmployee,
  PilaPreparationIssue,
  PayrollPeriodStatus,
} from '../services/payroll-api';

const recordLabels: Record<PilaPreparationIssue['record'], string> = {
  APORTANTE_TIPO_1: 'Archivo tipo 1, aportante',
  CABECERA_TIPO_2: 'Archivo tipo 2, cabecera',
  DETALLE_TIPO_2: 'Archivo tipo 2, cotizante',
  SNAPSHOT: 'Snapshot de nómina',
};

function formatPilaBytes(bytes: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'unit',
    unit: 'byte',
    unitDisplay: 'narrow',
    maximumFractionDigits: 0,
  }).format(bytes);
}

const detailFieldLabels: Record<PilaDetailFieldCandidateStatus['fieldNumber'], string> = {
  15: 'Ingreso (ING)',
  16: 'Retiro (RET)',
  17: 'Traslado desde EPS/EOC (TDE)',
  18: 'Traslado a EPS/EOC (TAE)',
  19: 'Traslado desde administradora de pensiones (TDP)',
  20: 'Traslado a administradora de pensiones (TAP)',
  21: 'Variación permanente de salario (VSP)',
  22: 'Corrección de planilla',
  23: 'Variación transitoria de salario (VST)',
  24: 'Suspensión o licencia no remunerada (SLN)',
  25: 'Incapacidad general (IGE)',
  26: 'Licencia de maternidad o paternidad (LMA)',
  27: 'Vacaciones o licencia remunerada (VAC-LR)',
  28: 'Aporte voluntario a pensión (AVP)',
  29: 'Variación de centro de trabajo (VCT)',
  30: 'Días por accidente laboral (IRL)',
  32: 'Destino de traslado de pensión',
  34: 'Destino de traslado de EPS',
  46: 'Tarifa de pensión',
  47: 'Cotización obligatoria a pensiones',
  48: 'Aporte voluntario del afiliado a pensión',
  49: 'Aporte voluntario del aportante a pensión',
  50: 'Total de aportes a pensión (campos 47–49)',
  51: 'FSP, subcuenta de solidaridad',
  52: 'FSP, subcuenta de subsistencia',
  53: 'Valor no retenido por aportes voluntarios',
  54: 'Tarifa de salud',
  55: 'Cotización obligatoria a salud',
  56: 'Valor de UPC adicional (solo cotizante 40)',
  57: 'Autorización de incapacidad',
  58: 'Valor de incapacidad',
  59: 'Autorización de licencia maternidad/paternidad',
  60: 'Valor de licencia maternidad',
  61: 'Tarifa inicial de riesgos laborales',
  63: 'Aporte ARL',
  64: 'Tarifa CCF',
  65: 'Aporte a caja de compensación',
  66: 'Tarifa SENA',
  67: 'Aporte SENA',
  68: 'Tarifa ICBF',
  69: 'Aporte ICBF',
  70: 'Tarifa ESAP',
  71: 'Aporte ESAP',
  72: 'Tarifa MEN',
  73: 'Aporte MEN',
  74: 'Documento del cotizante principal',
  75: 'Identificación del cotizante principal',
  76: 'Exoneración del cotizante',
  80: 'Fecha de ingreso',
  81: 'Fecha de retiro',
  82: 'Fecha de inicio VSP',
  83: 'Fecha de inicio SLN',
  84: 'Fecha de fin SLN',
  85: 'Fecha de inicio IGE',
  86: 'Fecha de fin IGE',
  87: 'Fecha de inicio LMA',
  88: 'Fecha de fin LMA',
  89: 'Fecha de inicio VAC-LR',
  90: 'Fecha de fin VAC-LR',
  91: 'Fecha de inicio VCT',
  92: 'Fecha de fin VCT',
  93: 'Fecha de inicio IRL',
  94: 'Fecha de fin IRL',
};

const headerFieldLabels: Record<number, string> = {
  1: 'Tipo de registro',
  2: 'Modalidad de planilla',
  3: 'Secuencia del aportante',
  4: 'Razón social',
  5: 'Tipo de documento del aportante',
  6: 'Número de identificación del aportante',
  7: 'Dígito de verificación',
  8: 'Tipo de planilla',
  9: 'Número de planilla asociada',
  10: 'Fecha de pago de planilla asociada',
  11: 'Forma de presentación',
  12: 'Código de sucursal',
  13: 'Nombre de sucursal',
  14: 'Código ARL del aportante',
  15: 'Período para sistemas distintos a salud',
  16: 'Período de salud',
  17: 'Número de radicación',
  18: 'Fecha efectiva de pago',
  19: 'Cantidad de cotizantes',
  20: 'Total IBC de caja de compensación',
  21: 'Tipo de aportante',
  22: 'Código del operador',
};

const employerFieldLabels: Record<number, string> = {
  1: 'Razón social del aportante',
  2: 'Tipo de documento del aportante',
  3: 'Número de identificación del aportante',
  4: 'Dígito de verificación',
  5: 'Código de sucursal',
  6: 'Nombre de sucursal',
  7: 'Clase de aportante',
  8: 'Naturaleza jurídica',
  9: 'Tipo de persona',
  10: 'Forma de presentación',
  11: 'Dirección del aportante',
  12: 'Código del municipio',
  13: 'Código del departamento',
  14: 'Actividad económica',
  15: 'Teléfono',
  16: 'Fax',
  17: 'Correo electrónico',
  18: 'Número de documento del representante',
  19: 'Dígito de verificación del representante',
  20: 'Tipo de documento del representante',
  21: 'Primer apellido del representante',
  22: 'Segundo apellido del representante',
  23: 'Primer nombre del representante',
  24: 'Segundo nombre del representante',
  25: 'Fecha de inicio de situación especial',
  26: 'Acción especial',
  27: 'Fecha de fin de situación especial',
  28: 'Código del operador',
  29: 'Período de pago',
  30: 'Tipo de aportante',
  31: 'Fecha de matrícula mercantil',
  32: 'Departamento del domicilio principal',
  33: 'Exoneración de aportes',
  34: 'Beneficio CCF de Ley 1429',
};

function candidateDisplay(
  candidate: {
    values: Partial<
      Record<number, { value: string | number | null; emptyAs?: 'spaces' | 'zeros' }>
    >;
    unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
  },
  fieldNumber: number,
): string {
  const value = candidate.values[fieldNumber];
  if (value) {
    if (value.value === null) {
      if (value.emptyAs === 'spaces') return 'En blanco según regla candidata';
      if (value.emptyAs === 'zeros') return 'Ceros según regla candidata';
      return 'Sin valor';
    }
    return typeof value.value === 'number'
      ? new Intl.NumberFormat('es-CO').format(value.value)
      : value.value;
  }
  return (
    candidate.unresolvedFields.find((field) => field.fieldNumber === fieldNumber)?.reason ??
    'Sin candidato disponible.'
  );
}

function AffectedEmployeesList({
  employees,
  className,
}: {
  employees: PilaPreparationAffectedEmployee[];
  className: string;
}) {
  const nameCounts = new Map<string, number>();
  for (const employee of employees) {
    nameCounts.set(employee.name, (nameCounts.get(employee.name) ?? 0) + 1);
  }
  const seenNames = new Map<string, number>();

  return (
    <ul className={className}>
      {employees.map((employee) => {
        const duplicateName = (nameCounts.get(employee.name) ?? 0) > 1;
        const occurrence = (seenNames.get(employee.name) ?? 0) + 1;
        seenNames.set(employee.name, occurrence);
        const label = duplicateName ? `${employee.name} · registro ${occurrence}` : employee.name;

        return (
          <li key={employee.id}>
            <Link
              href={`/empleados/${encodeURIComponent(employee.id)}`}
              className="text-primary underline underline-offset-2 hover:text-foreground"
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PayrollPilaPreparationPanel({
  periodId,
  periodStatus,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
}) {
  const [requested, setRequested] = useState(false);
  const query = usePayrollPilaPreparation(periodId, requested);
  const exportsQuery = usePayrollPilaExports(periodId, requested);
  const createExport = useCreatePayrollPilaExport(periodId);

  if (periodStatus !== 'APROBADA' && periodStatus !== 'CAUSADA') return null;

  const exportReadiness = query.data?.exportReadiness;

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-surface p-5"
      aria-labelledby="pila-preparation-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="pila-preparation-title" className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Preparación de datos PILA
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Revisa la preparación de los snapshots aprobados y genera archivos tipo 1 y 2 solo
            cuando las reglas locales no detectan brechas. La aceptación de un operador se verifica
            por separado.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => setRequested(true)}
        >
          {query.isFetching && (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {query.isFetching ? 'Revisando…' : query.data ? 'Actualizar revisión' : 'Revisar datos'}
        </Button>
      </div>

      {query.isError && (
        <Alert variant="destructive" className="mt-4">
          {query.error instanceof Error
            ? query.error.message
            : 'No se pudo revisar la preparación de datos PILA.'}
        </Alert>
      )}

      {query.data && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-pension-transition-title"
          >
            <h3 id="pila-pension-transition-title" className="font-medium">
              Afiliación pensional histórica · campo 5
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado S/N leído únicamente de los snapshots aprobados. Los snapshots anteriores a v7
              no incluyen este campo; no se completa desde la ficha actual del empleado.
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Estado S</dt>
                <dd>{query.data.pensionTransitionSummary.statusS}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estado N</dt>
                <dd>{query.data.pensionTransitionSummary.statusN}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sin valor S/N utilizable</dt>
                <dd>{query.data.pensionTransitionSummary.sinValorUtilizable}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Snapshot histórico sin campo 5</dt>
                <dd>{query.data.pensionTransitionSummary.historicosSinCampo5}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Snapshot sin alcance verificable</dt>
                <dd>{query.data.pensionTransitionSummary.alcanceNoVerificado}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versión incompatible</dt>
                <dd>{query.data.pensionTransitionSummary.versionIncompatible}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Snapshots incluidos</dt>
                <dd>{query.data.pensionTransitionSummary.totalSnapshots}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              El estado de transición queda como evidencia histórica. Los campos 51/52 usan la regla
              anterior al 1 de abril de 2027 y solo se proponen si su fuente, período, fecha
              prevista de pago e importes concilian. Los archivos generados conservan los snapshots
              de origen y no modifican la nómina aprobada.
            </p>
          </section>

          {exportReadiness && (
            <section
              className="rounded-lg border border-border p-4"
              aria-labelledby="pila-export-readiness-title"
            >
              <h3 id="pila-export-readiness-title" className="font-medium">
                Estado de exportación PILA
              </h3>
              <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Layout de registros</dt>
                  <dd>{exportReadiness.recordLayoutVersion.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Generación y descarga</dt>
                  <dd>
                    {exportReadiness.fileGenerationStatus === 'IMPLEMENTED'
                      ? 'Disponibles para casos sin brechas'
                      : 'No disponibles'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Validación local</dt>
                  <dd>
                    {exportReadiness.localValidationStatus === 'PER_EXPORT'
                      ? 'Estructura y codificación al generar'
                      : 'No ejecutada'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aceptación del operador</dt>
                  <dd>
                    {exportReadiness.operatorAcceptanceStatus === 'NOT_VERIFIED'
                      ? 'No verificada'
                      : 'Verificada'}
                  </dd>
                </div>
              </dl>

              <ul className="mt-4 space-y-3">
                {exportReadiness.blockers.map((blocker) => (
                  <li key={blocker.code} className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-sm font-medium">{blocker.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {blocker.scope === 'FILE_GENERATION'
                        ? 'Bloquea la generación del archivo.'
                        : 'Pendiente para declarar compatibilidad con un operador.'}{' '}
                      {blocker.message}
                    </p>
                    {blocker.fields.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        {blocker.fields.map(({ record, fieldNumbers }) => (
                          <li key={`${blocker.code}-${record}`}>
                            {recordLabels[record]}: campos {fieldNumbers.join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Evidencia: {blocker.evidence}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-export-history-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="pila-export-history-title" className="font-medium">
                  Archivos PILA del período
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada generación guarda una versión inmutable de los archivos y los hashes de
                  verificación. La descarga no afirma aceptación, liquidación ni pago del operador.
                </p>
              </div>
              <Button
                type="button"
                disabled={!query.data.archivoGenerable || createExport.isPending}
                onClick={() => createExport.mutate()}
              >
                {createExport.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {createExport.isPending ? 'Generando…' : 'Generar y guardar archivos'}
              </Button>
            </div>

            {!query.data.archivoGenerable && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                Corrige las brechas del preflight para habilitar la generación.
              </p>
            )}
            {createExport.isError && (
              <Alert variant="destructive" className="mt-3">
                {createExport.error instanceof Error
                  ? createExport.error.message
                  : 'No se pudieron generar los archivos PILA.'}
              </Alert>
            )}
            {exportsQuery.isError && (
              <Alert variant="destructive" className="mt-3">
                {exportsQuery.error instanceof Error
                  ? exportsQuery.error.message
                  : 'No se pudo consultar el historial de archivos PILA.'}
              </Alert>
            )}
            {exportsQuery.isLoading && <p className="mt-3 text-sm">Consultando historial…</p>}
            {exportsQuery.data?.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Aún no se han generado archivos para este período.
              </p>
            )}
            {exportsQuery.data && exportsQuery.data.length > 0 && (
              <ul className="mt-4 space-y-3">
                {exportsQuery.data.map((pilaExport) => (
                  <li key={pilaExport.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {new Intl.DateTimeFormat('es-CO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'America/Bogota',
                        }).format(new Date(pilaExport.createdAt))}{' '}
                        · Generado y validado localmente
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {pilaExport.sourceSnapshotCount} snapshots · AT2{' '}
                        {pilaExport.normativeVersion}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Período {pilaExport.period.fechaInicio}–{pilaExport.period.fechaFin} · Pago
                      PILA previsto {pilaExport.period.fechaPrevistaPagoPila ?? 'sin fecha'} ·
                      Formato {pilaExport.fileFormatVersion} · Compatibilidad con operadores no
                      verificada
                    </p>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Versiones de reglas aplicadas</summary>
                      <ul className="mt-1 list-inside list-disc">
                        {pilaExport.normativeRuleVersions.map((version) => (
                          <li key={version} className="font-mono">
                            {version}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <a
                        className="underline underline-offset-4"
                        href={`/api/payroll/periods/${encodeURIComponent(periodId)}/pila-exports/${encodeURIComponent(pilaExport.id)}/type-1`}
                      >
                        Descargar tipo 1 ({formatPilaBytes(pilaExport.type1.sizeBytes)})
                      </a>
                      <a
                        className="underline underline-offset-4"
                        href={`/api/payroll/periods/${encodeURIComponent(periodId)}/pila-exports/${encodeURIComponent(pilaExport.id)}/type-2`}
                      >
                        Descargar tipo 2 ({formatPilaBytes(pilaExport.type2.sizeBytes)})
                      </a>
                    </div>
                    <p className="mt-2 break-all font-mono text-2xs text-muted-foreground">
                      SHA-256 tipo 1: {pilaExport.type1.sha256} · tipo 2: {pilaExport.type2.sha256}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-detail-sequence-title"
          >
            <h3 id="pila-detail-sequence-title" className="font-medium">
              Secuencia del detalle tipo 2
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El campo 2 N5 requiere un consecutivo que inicia en 00001. Se propone únicamente
              cuando todos los empleados de las ejecuciones aprobadas tienen exactamente un snapshot
              compatible para este tenant y período.
            </p>
            <p className="mt-2 text-sm">
              {query.data.detailRecordSequence.status === 'CANDIDATE'
                ? `Secuencia candidata para ${query.data.detailRecordSequence.candidateRecords} registros, en orden estable por ID de empleado.`
                : `Pendiente: ${query.data.detailRecordSequence.pendingReason ?? 'No se pudo confirmar el conjunto completo de registros.'}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El consecutivo se incluye en el candidato local del archivo. La aceptación del formato
              por un operador todavía debe verificarse con una carga real.
            </p>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-employer-candidate-title"
          >
            <h3 id="pila-employer-candidate-title" className="font-medium">
              Archivo tipo 1 · aportante · candidatos por campo
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.data.employerCandidate.supportedSnapshots
                ? 'Tenant y período coinciden; se muestran valores candidatos solo cuando todos los snapshots concuerdan.'
                : 'Se requieren snapshots PILA v2–v10 únicos y consistentes con el tenant y período aprobado.'}{' '}
              Los datos faltantes o diferentes quedan pendientes. Esta revisión no genera el archivo
              ni confirma la aceptación de un operador.
            </p>
            <details className="mt-3 rounded-md bg-muted/40 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                Ver estado de los 34 campos del aportante
              </summary>
              <ol className="mt-3 space-y-2">
                {Array.from({ length: 34 }, (_, index) => index + 1).map((fieldNumber) => (
                  <li
                    key={fieldNumber}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      Campo {fieldNumber} · {employerFieldLabels[fieldNumber]}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {candidateDisplay(query.data.employerCandidate, fieldNumber)}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-header-candidate-title"
          >
            <h3 id="pila-header-candidate-title" className="font-medium">
              Encabezado tipo 2 · candidatos por campo
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.data.headerCandidate.supportedSnapshots
                ? 'Valores candidatos calculados desde snapshots PILA v2–v10 del mismo tenant y período.'
                : 'Se requieren snapshots PILA v2–v10 del mismo tenant y período para proponer valores.'}{' '}
              Los campos asignados al operador muestran la posición vacía candidata; los datos
              faltantes muestran su motivo. Esta revisión no genera el archivo ni confirma su
              aceptación.
            </p>
            <details className="mt-3 rounded-md bg-muted/40 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                Ver estado de los 22 campos del encabezado
              </summary>
              <ol className="mt-3 space-y-2">
                {Array.from({ length: 22 }, (_, index) => index + 1).map((fieldNumber) => (
                  <li
                    key={fieldNumber}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      Campo {fieldNumber} · {headerFieldLabels[fieldNumber]}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {candidateDisplay(query.data.headerCandidate, fieldNumber)}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-no-event-fields-title"
          >
            <h3 id="pila-no-event-fields-title" className="font-medium">
              Campos IGE/LMA sin novedad
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Blanco y cero solo se proponen cuando el snapshot completo no contiene eventos ni
              novedades. La captura de valores para IGE/LMA sigue pendiente.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailNoEventFieldCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <AffectedEmployeesList
                                employees={affectedEmployees}
                                className="mt-2 list-inside list-disc"
                              />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-standard-dependent-empty-fields-title"
          >
            <h3 id="pila-standard-dependent-empty-fields-title" className="font-medium">
              Campos no aplicables a dependientes estándar
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AT2 v30 exige dejar vacíos los destinos de traslado 32 y 34 y el campo 56 para
              dependientes 01/00; este último solo se diligencia para el cotizante tipo 40. Los
              datos del cotizante principal 74 y 75 también aplican únicamente al tipo 40. Estos
              candidatos no habilitan la descarga PILA.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailStandardDependentEmptyCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <AffectedEmployeesList
                                employees={affectedEmployees}
                                className="mt-2 list-inside list-disc"
                              />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-private-employer-esap-men-title"
          >
            <h3 id="pila-private-employer-esap-men-title" className="font-medium">
              Aportes ESAP y MEN para empleador privado
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para empleadores privados tipo 1, AT2 v30 admite tarifa cero cuando no hay obligación.
              Los valores 71 y 73 se proponen en cero solo si existe el IBC 95 congelado.
              Empleadores públicos y otros tipos quedan pendientes. La descarga sigue deshabilitada.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailPrivateEmployerEsapMenCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <AffectedEmployeesList
                                employees={affectedEmployees}
                                className="mt-2 list-inside list-disc"
                              />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-non-exempt-cotizante-title"
          >
            <h3 id="pila-non-exempt-cotizante-title" className="font-medium">
              Exoneración del cotizante
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El campo 76 se propone como N únicamente cuando el snapshot del empleador y su
              confirmación PILA declaran no exoneración de forma coherente. La exoneración positiva
              sigue pendiente de validar por empleado. No se habilita la descarga.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailNonExemptCotizanteCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <AffectedEmployeesList
                                employees={affectedEmployees}
                                className="mt-2 list-inside list-disc"
                              />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-absent-event-fields-title"
          >
            <h3 id="pila-absent-event-fields-title" className="font-medium">
              Eventos y particularidades de planilla
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para snapshots completos sin eventos PILA ni novedades Payroll se proponen los blancos
              y el cero definidos por AT2 v30. Como el MVP usa planilla E, el campo 22 se propone
              vacío; las correcciones de planilla N quedan fuera de alcance. Para dependientes 01/00
              de mes completo, los campos 28, 48, 49 y 53 solo se proponen con declaración auditada
              de ausencia de aportes en el snapshot PILA v8 y período y pago anteriores al
              2027-04-01. Aportes presentes, falta de declaración, snapshots históricos y fechas de
              transición quedan pendientes. El campo 50 también queda pendiente mientras 47–49 no
              estén resueltos. Este informe no habilita la descarga del archivo.
            </p>
            <details className="mt-3 rounded-md bg-muted/40 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                Ver estado de {query.data.detailAbsentEventCandidates.length} campos
              </summary>
              <ul className="mt-3 space-y-3">
                {query.data.detailAbsentEventCandidates.map((status) => (
                  <li
                    key={status.fieldNumber}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="text-sm font-medium">
                      Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Con candidato: {status.candidateEmployees}; pendientes:{' '}
                      {status.pendingEmployees}.
                    </p>
                    {status.pendingReasons.length > 0 && (
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                          <li key={`${status.fieldNumber}-${index}`}>
                            <p>{reason}</p>
                            {affectedEmployees.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-primary">
                                  Ver {affectedEmployees.length} empleados afectados
                                </summary>
                                <AffectedEmployeesList
                                  employees={affectedEmployees}
                                  className="mt-2 list-inside list-disc"
                                />
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-contribution-candidates-title"
          >
            <h3 id="pila-contribution-candidates-title" className="font-medium">
              Candidatos parciales de aportes
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Estos conteos indican si el snapshot aporta un valor candidato para cada campo. No
              confirman que la planilla completa cumpla las reglas PILA ni habilitan su descarga.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailContributionCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {detailFieldLabels[status.fieldNumber] ?? 'AT2'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <AffectedEmployeesList
                                employees={affectedEmployees}
                                className="mt-2 list-inside list-disc"
                              />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <Alert>
            {query.data.mensaje} Período: {query.data.period.fechaInicio} a{' '}
            {query.data.period.fechaFin}. Fecha prevista de aportes:{' '}
            {query.data.period.fechaPrevistaPagoPila ?? 'sin registrar'}.
          </Alert>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>
              Snapshots revisados: <strong>{query.data.snapshotsRevisados}</strong>
            </span>
            <span>
              Con datos pendientes: <strong>{query.data.empleadosConDatosPendientes}</strong>
            </span>
            <span>
              Sin brechas detectadas: <strong>{query.data.empleadosSinBrechasDetectadas}</strong>
            </span>
          </div>

          {query.data.issues.length > 0 ? (
            <ul className="space-y-3">
              {query.data.issues.map((issue) => (
                <li
                  key={`${issue.record}-${issue.fieldNumber ?? 'snapshot'}-${issue.code}`}
                  className="rounded-lg border border-border px-4 py-3"
                >
                  <p className="text-sm font-medium">
                    {recordLabels[issue.record]}
                    {issue.fieldNumber !== null ? ` · campo ${issue.fieldNumber}` : ''}
                    {issue.affectedCount > 0 ? ` · ${issue.affectedCount} empleados` : ''}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                  {issue.affectedEmployees.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">
                        Ver empleados afectados
                      </summary>
                      <AffectedEmployeesList
                        employees={issue.affectedEmployees}
                        className="mt-2 list-inside list-disc text-muted-foreground"
                      />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se detectaron brechas en los campos incluidos en esta revisión.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
