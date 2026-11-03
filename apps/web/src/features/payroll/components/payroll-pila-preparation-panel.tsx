'use client';

import { useState } from 'react';
import { ClipboardCheck, LoaderCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePayrollPilaPreparation } from '../hooks/use-payroll';
import type {
  PilaDetailFieldCandidateStatus,
  PilaPreparationIssue,
  PayrollPeriodStatus,
} from '../services/payroll-api';

const recordLabels: Record<PilaPreparationIssue['record'], string> = {
  APORTANTE_TIPO_1: 'Archivo tipo 1, aportante',
  CABECERA_TIPO_2: 'Archivo tipo 2, cabecera',
  DETALLE_TIPO_2: 'Archivo tipo 2, cotizante',
  SNAPSHOT: 'Snapshot de nómina',
};

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
      return value.emptyAs === 'spaces' ? 'En blanco según regla candidata' : 'Sin valor';
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

export function PayrollPilaPreparationPanel({
  periodId,
  periodStatus,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
}) {
  const [requested, setRequested] = useState(false);
  const query = usePayrollPilaPreparation(periodId, requested);

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
            Revisa los datos congelados en los snapshots aprobados frente a campos de AT2 v30 con
            fuente identificada. El mapeo y las reglas aplicables siguen en reconciliación; este
            informe no valida un archivo completo.
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
                    {exportReadiness.fileGenerationStatus === 'NOT_IMPLEMENTED'
                      ? 'No implementadas'
                      : 'Disponibles'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Validación local</dt>
                  <dd>
                    {exportReadiness.localValidationStatus === 'PRELIMINARY'
                      ? 'Preliminar; no cubre el archivo completo'
                      : 'Completa'}
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
            aria-labelledby="pila-employer-candidate-title"
          >
            <h3 id="pila-employer-candidate-title" className="font-medium">
              Archivo tipo 1 · aportante · candidatos por campo
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.data.employerCandidate.supportedSnapshots
                ? 'Tenant y período coinciden; se muestran valores candidatos solo cuando todos los snapshots concuerdan.'
                : 'Se requieren snapshots PILA v2 únicos y consistentes con el tenant y período aprobado.'}{' '}
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
                ? 'Valores candidatos calculados desde snapshots PILA v2 del mismo tenant y período.'
                : 'Se requieren snapshots PILA v2 del mismo tenant y período para proponer valores.'}{' '}
              Los campos asignados al operador y los datos faltantes muestran su motivo. Esta
              revisión no genera el archivo ni confirma su aceptación.
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
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
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
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
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
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
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
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
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
              vacío; las correcciones de planilla N quedan fuera de alcance. Para períodos desde
              2025-07-01, los campos 28 y 53 quedan en blanco y 48/49 en cero por el corte AT2; los
              períodos históricos o que lo cruzan siguen pendientes por falta de fuentes congeladas.
              Este informe no habilita la descarga del archivo.
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
                                <ul className="mt-2 list-inside list-disc">
                                  {affectedEmployees.map((name, employeeIndex) => (
                                    <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                      {name}
                                    </li>
                                  ))}
                                </ul>
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
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
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
                      <ul className="mt-2 list-inside list-disc text-muted-foreground">
                        {issue.affectedEmployees.map((name, index) => (
                          <li key={`${issue.code}-${index}`}>{name}</li>
                        ))}
                      </ul>
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
