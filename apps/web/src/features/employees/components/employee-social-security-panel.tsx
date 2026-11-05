'use client';

import { useState, type FormEvent } from 'react';
import { CalendarCheck, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { getUserFacingError } from '@/lib/error-message';
import { COLOMBIA_DANE_DEPARTMENTS } from '@saas/types';
import {
  useCloseSocialSecurityAffiliation,
  useCreateSocialSecurityAffiliation,
  useSocialSecurityAffiliations,
} from '../hooks/use-employees';

type LegacyValues = {
  eps: string | null;
  fondoPension: string | null;
  arl: string | null;
  cajaCompensacion: string | null;
};

type FormValues = {
  tipoCotizanteCodigo: string;
  subtipoCotizanteCodigo: string;
  epsCodigo: string;
  epsNombre: string;
  fondoPensionCodigo: string;
  fondoPensionNombre: string;
  estadoAfiliacionPensional: string;
  indicadorTarifaEspecialPensiones: string;
  arlCodigo: string;
  arlNombre: string;
  arlClaseRiesgo: string;
  cajaCompensacionCodigo: string;
  cajaCompensacionNombre: string;
  cajaCompensacionDepartamentoCodigo: string;
  extranjeroNoObligadoPension: boolean | null;
  colombianoEnElExterior: boolean | null;
  vigenteDesde: string;
  vigenteHasta: string;
};

const emptyForm: FormValues = {
  tipoCotizanteCodigo: '',
  subtipoCotizanteCodigo: '',
  epsCodigo: '',
  epsNombre: '',
  fondoPensionCodigo: '',
  fondoPensionNombre: '',
  estadoAfiliacionPensional: '',
  indicadorTarifaEspecialPensiones: '',
  arlCodigo: '',
  arlNombre: '',
  arlClaseRiesgo: '',
  cajaCompensacionCodigo: '',
  cajaCompensacionNombre: '',
  cajaCompensacionDepartamentoCodigo: '',
  extranjeroNoObligadoPension: null,
  colombianoEnElExterior: null,
  vigenteDesde: '',
  vigenteHasta: '',
};

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha final';
  const dateOnly = value.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00.000Z`).toLocaleDateString('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

function pensionTariffName(value: string | null) {
  if (value === '') return 'Normal confirmada';
  if (value === '1') return 'Actividades de alto riesgo';
  if (value === '2') return 'Senadores';
  if (value === '3') return 'CTI';
  if (value === '4') return 'Aviadores';
  return 'Sin confirmar';
}

function LegacyReference({ values }: { values: LegacyValues }) {
  const entries = [
    ['EPS', values.eps],
    ['Pensión', values.fondoPension],
    ['ARL', values.arl],
    ['Caja', values.cajaCompensacion],
  ] as const;

  return (
    <div className="rounded-md border border-border-soft bg-muted/30 p-3">
      <p className="text-xs font-semibold text-foreground">Datos heredados para referencia</p>
      <p className="mt-1 text-xs text-muted-foreground">
        No se copian ni se usan como códigos PILA. Confirma los códigos con los documentos de
        afiliación.
      </p>
      <dl className="mt-2 grid gap-x-5 gap-y-1 text-xs sm:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value || 'Sin dato'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EmployeeSocialSecurityPanel({
  employeeId,
  employeeDocumentType,
  employeeContractType,
  legacyValues,
}: {
  employeeId: string;
  employeeDocumentType: string;
  employeeContractType: string;
  legacyValues: LegacyValues;
}) {
  const {
    data: affiliations = [],
    isLoading,
    isError,
    error,
  } = useSocialSecurityAffiliations(employeeId);
  const createMutation = useCreateSocialSecurityAffiliation();
  const closeMutation = useCloseSocialSecurityAffiliation();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeDate, setCloseDate] = useState('');
  const supportsPilaAffiliation = ['TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR'].includes(
    employeeContractType,
  );

  const setValue = (
    field: Exclude<keyof FormValues, 'extranjeroNoObligadoPension' | 'colombianoEnElExterior'>,
    value: string,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setDeclaration = (
    field: 'extranjeroNoObligadoPension' | 'colombianoEnElExterior',
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value === '' ? null : value === 'true',
    }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(
      {
        employeeId,
        data: {
          tipoCotizanteCodigo: form.tipoCotizanteCodigo,
          subtipoCotizanteCodigo: form.subtipoCotizanteCodigo,
          epsCodigo: form.epsCodigo,
          epsNombre: form.epsNombre,
          fondoPensionCodigo: form.fondoPensionCodigo,
          fondoPensionNombre: form.fondoPensionNombre,
          estadoAfiliacionPensional:
            form.estadoAfiliacionPensional === 'S' || form.estadoAfiliacionPensional === 'N'
              ? form.estadoAfiliacionPensional
              : null,
          indicadorTarifaEspecialPensiones:
            form.indicadorTarifaEspecialPensiones === 'NORMAL'
              ? ''
              : ['1', '2', '3', '4'].includes(form.indicadorTarifaEspecialPensiones)
                ? (form.indicadorTarifaEspecialPensiones as '1' | '2' | '3' | '4')
                : null,
          arlCodigo: form.arlCodigo,
          arlNombre: form.arlNombre,
          arlClaseRiesgo: form.arlClaseRiesgo,
          cajaCompensacionCodigo: form.cajaCompensacionCodigo,
          cajaCompensacionNombre: form.cajaCompensacionNombre,
          cajaCompensacionDepartamentoCodigo: form.cajaCompensacionDepartamentoCodigo,
          extranjeroNoObligadoPension: form.extranjeroNoObligadoPension,
          colombianoEnElExterior: form.colombianoEnElExterior,
          vigenteDesde: form.vigenteDesde,
          vigenteHasta: form.vigenteHasta || null,
        },
      },
      {
        onSuccess: () => {
          setForm(emptyForm);
          setIsAdding(false);
          toast.success('Afiliación registrada en el historial.');
        },
        onError: (submitError) =>
          toast.error(getUserFacingError(submitError, 'No se pudo registrar la afiliación.')),
      },
    );
  };

  const closeAffiliation = (event: FormEvent<HTMLFormElement>, affiliationId: string) => {
    event.preventDefault();
    closeMutation.mutate(
      { employeeId, affiliationId, vigenteHasta: closeDate },
      {
        onSuccess: () => {
          setClosingId(null);
          setCloseDate('');
          toast.success('Se guardó el final de vigencia en el historial.');
        },
        onError: (closeError) =>
          toast.error(getUserFacingError(closeError, 'No se pudo finalizar la vigencia.')),
      },
    );
  };

  return (
    <section className="mt-6 space-y-4 rounded-(--radius-card) border border-border bg-surface p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              Afiliaciones de seguridad social
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Historial por vigencia para preparar la exportación PILA. Esta pantalla conserva los
            datos ingresados; todavía no valida los códigos contra el catálogo del operador.
          </p>
        </div>
        {!isAdding && supportsPilaAffiliation && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Registrar afiliación
          </Button>
        )}
      </div>

      <Alert>
        El MVP registra trabajadores dependientes estándar. Cada registro es una versión completa
        del conjunto de EPS, pensión, ARL y caja desde la fecha indicada. Si cambia una entidad,
        vuelve a confirmar todas las afiliaciones que siguen vigentes. Una nueva versión sin fecha
        final cierra el día anterior la versión abierta previa; también puedes finalizarla sin
        reemplazo. Confirma también las declaraciones de residencia o exención aplicables al tipo de
        documento; una afiliación histórica no se completa automáticamente. Los campos heredados
        nunca se convierten automáticamente.
      </Alert>

      {!supportsPilaAffiliation && (
        <p className="text-sm text-muted-foreground">
          La captura PILA disponible en esta etapa aplica a contratos laborales estándar.
        </p>
      )}

      <LegacyReference values={legacyValues} />

      {isError && (
        <Alert variant="destructive">
          {getUserFacingError(error, 'No se pudo cargar el historial de afiliaciones.')}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Cargando historial…
        </div>
      ) : affiliations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay afiliaciones estructuradas. Los datos antiguos no se usarán para preparar PILA.
        </p>
      ) : (
        <ol className="space-y-3">
          {affiliations.map((affiliation) => (
            <li key={affiliation.id} className="rounded-md border border-border-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(affiliation.vigenteDesde)} – {formatDate(affiliation.vigenteHasta)}
                </p>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Cotizante {affiliation.tipoCotizanteCodigo} · Riesgo {affiliation.arlClaseRiesgo}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <AffiliationItem
                  label="EPS"
                  name={affiliation.epsNombre}
                  code={affiliation.epsCodigo}
                />
                <AffiliationItem
                  label="Pensión"
                  name={affiliation.fondoPensionNombre}
                  code={affiliation.fondoPensionCodigo}
                />
                <AffiliationItem
                  label="Transición pensional (campo 5)"
                  name={
                    affiliation.estadoAfiliacionPensional === 'S'
                      ? 'En transición'
                      : affiliation.estadoAfiliacionPensional === 'N'
                        ? 'Sin transición'
                        : 'Sin confirmar'
                  }
                  code={affiliation.estadoAfiliacionPensional ?? '—'}
                />
                <AffiliationItem
                  label="Tarifa de pensiones (campo 79)"
                  name={pensionTariffName(affiliation.indicadorTarifaEspecialPensiones)}
                  code={
                    affiliation.indicadorTarifaEspecialPensiones === ''
                      ? 'Blanco confirmado'
                      : (affiliation.indicadorTarifaEspecialPensiones ?? '—')
                  }
                />
                <AffiliationItem
                  label="ARL"
                  name={affiliation.arlNombre}
                  code={affiliation.arlCodigo}
                />
                <AffiliationItem
                  label="Caja de compensación"
                  name={affiliation.cajaCompensacionNombre}
                  code={affiliation.cajaCompensacionCodigo}
                />
                <AffiliationItem
                  label="Departamento de la CCF (DIVIPOLA)"
                  name={
                    COLOMBIA_DANE_DEPARTMENTS.find(
                      ({ codigo }) => codigo === affiliation.cajaCompensacionDepartamentoCodigo,
                    )?.nombre ?? 'Sin dato histórico'
                  }
                  code={affiliation.cajaCompensacionDepartamentoCodigo ?? '—'}
                />
                {(employeeDocumentType === 'CC' || employeeDocumentType === 'TI') && (
                  <DeclarationItem
                    label="Colombiano en el exterior"
                    value={affiliation.colombianoEnElExterior}
                  />
                )}
                {(employeeDocumentType === 'CE' || employeeDocumentType === 'PA') && (
                  <DeclarationItem
                    label="Extranjero no obligado a cotizar a pensión"
                    value={affiliation.extranjeroNoObligadoPension}
                  />
                )}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                El código es declarado por el empleador y aún requiere validación normativa antes de
                exportar.
              </p>
              {affiliation.vigenteHasta === null && (
                <div className="mt-3">
                  {closingId === affiliation.id ? (
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => closeAffiliation(event, affiliation.id)}
                    >
                      <FormField label="Válida hasta" required className="min-w-48">
                        <Input
                          type="date"
                          required
                          value={closeDate}
                          onChange={(event) => setCloseDate(event.target.value)}
                        />
                      </FormField>
                      <Button type="submit" size="sm" disabled={closeMutation.isPending}>
                        {closeMutation.isPending && (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        )}
                        Guardar fecha
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setClosingId(null)}
                      >
                        Cancelar
                      </Button>
                    </form>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setClosingId(affiliation.id);
                        const today = new Date().toISOString().slice(0, 10);
                        const startDate = affiliation.vigenteDesde.slice(0, 10);
                        setCloseDate(today < startDate ? startDate : today);
                      }}
                    >
                      <CalendarCheck className="size-4" aria-hidden="true" />
                      Finalizar vigencia
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {isAdding && (
        <form onSubmit={submit} className="space-y-5 rounded-md border border-border p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nueva afiliación</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Confirma el conjunto completo de entidades y sus códigos según los soportes. No copies
              nombres como si fueran códigos.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo de cotizante" required>
              <Select
                required
                value={form.tipoCotizanteCodigo}
                onChange={(event) => setValue('tipoCotizanteCodigo', event.target.value)}
              >
                <option value="">Selecciona</option>
                <option value="01">01 · Dependiente estándar</option>
              </Select>
            </FormField>
            <FormField
              label="Subtipo de cotizante"
              required
              hint="AT2 exige un subtipo. Usa 00 si no aplica un subtipo especial; otros subtipos quedan fuera de la preparación PILA actual."
            >
              <Input
                required
                value={form.subtipoCotizanteCodigo}
                onChange={(event) => setValue('subtipoCotizanteCodigo', event.target.value)}
                inputMode="numeric"
                pattern="[0-9]{2}"
                maxLength={2}
                placeholder="00"
              />
            </FormField>
            <FormField label="Vigente desde" required>
              <Input
                type="date"
                required
                value={form.vigenteDesde}
                onChange={(event) => setValue('vigenteDesde', event.target.value)}
              />
            </FormField>
            <FormField label="Vigente hasta" hint="Déjalo vacío si continúa vigente.">
              <Input
                type="date"
                value={form.vigenteHasta}
                onChange={(event) => setValue('vigenteHasta', event.target.value)}
              />
            </FormField>

            <AffiliationFields
              label="EPS"
              code={form.epsCodigo}
              name={form.epsNombre}
              onCodeChange={(value) => setValue('epsCodigo', value)}
              onNameChange={(value) => setValue('epsNombre', value)}
            />
            <AffiliationFields
              label="Fondo de pensión"
              code={form.fondoPensionCodigo}
              name={form.fondoPensionNombre}
              onCodeChange={(value) => setValue('fondoPensionCodigo', value)}
              onNameChange={(value) => setValue('fondoPensionNombre', value)}
            />
            <FormField
              label="Transición pensional (campo 5)"
              hint="Registra S o N tal como aparece en el soporte vigente: S indica transición y N indica que no está en transición. Si no tienes el soporte, déjalo sin confirmar. Este dato por sí solo no habilita los campos FSP de PILA."
            >
              <Select
                value={form.estadoAfiliacionPensional}
                onChange={(event) => setValue('estadoAfiliacionPensional', event.target.value)}
              >
                <option value="">Sin confirmar</option>
                <option value="S">S — En transición</option>
                <option value="N">N — Sin transición</option>
              </Select>
            </FormField>
            <FormField
              label="Tarifa de pensiones (campo 79)"
              hint="Confirma la tarifa en el soporte vigente. Solo la tarifa normal está dentro del MVP; las categorías especiales bloquean la exportación."
            >
              <Select
                value={form.indicadorTarifaEspecialPensiones}
                onChange={(event) =>
                  setValue('indicadorTarifaEspecialPensiones', event.target.value)
                }
              >
                <option value="">Sin confirmar</option>
                <option value="NORMAL">Normal (blanco en el archivo)</option>
                <option value="1">1 · Actividades de alto riesgo</option>
                <option value="2">2 · Senadores</option>
                <option value="3">3 · CTI</option>
                <option value="4">4 · Aviadores</option>
              </Select>
            </FormField>
            <AffiliationFields
              label="ARL"
              code={form.arlCodigo}
              name={form.arlNombre}
              onCodeChange={(value) => setValue('arlCodigo', value)}
              onNameChange={(value) => setValue('arlNombre', value)}
            />
            <FormField label="Clase de riesgo ARL" required>
              <Select
                required
                value={form.arlClaseRiesgo}
                onChange={(event) => setValue('arlClaseRiesgo', event.target.value)}
              >
                <option value="">Selecciona</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            </FormField>
            <AffiliationFields
              label="Caja de compensación"
              code={form.cajaCompensacionCodigo}
              name={form.cajaCompensacionNombre}
              onCodeChange={(value) => setValue('cajaCompensacionCodigo', value)}
              onNameChange={(value) => setValue('cajaCompensacionNombre', value)}
            />
            <FormField
              label="Departamento donde está ubicada la CCF"
              required
              hint="Registra el departamento que aparece en la constancia de afiliación. Se guarda como código DIVIPOLA de dos dígitos y se compara con el municipio laboral para los campos 9 y 10 de PILA."
            >
              <Select
                required
                value={form.cajaCompensacionDepartamentoCodigo}
                onChange={(event) =>
                  setValue('cajaCompensacionDepartamentoCodigo', event.target.value)
                }
              >
                <option value="">Selecciona un departamento</option>
                {COLOMBIA_DANE_DEPARTMENTS.map(({ codigo, nombre }) => (
                  <option key={codigo} value={codigo}>
                    {codigo} · {nombre}
                  </option>
                ))}
              </Select>
            </FormField>
            {(employeeDocumentType === 'CC' || employeeDocumentType === 'TI') && (
              <FormField
                label="¿Es colombiano en el exterior?"
                required
                hint="Confirma la declaración del cotizante para el campo 8 de AT2."
              >
                <Select
                  required
                  value={
                    form.colombianoEnElExterior === null ? '' : String(form.colombianoEnElExterior)
                  }
                  onChange={(event) => setDeclaration('colombianoEnElExterior', event.target.value)}
                >
                  <option value="">Selecciona una respuesta</option>
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </Select>
              </FormField>
            )}
            {(employeeDocumentType === 'CE' || employeeDocumentType === 'PA') && (
              <FormField
                label="¿El cotizante extranjero está exento de cotizar a pensión?"
                required
                hint="Confirma la declaración del cotizante para el campo 7 de AT2."
              >
                <Select
                  required
                  value={
                    form.extranjeroNoObligadoPension === null
                      ? ''
                      : String(form.extranjeroNoObligadoPension)
                  }
                  onChange={(event) =>
                    setDeclaration('extranjeroNoObligadoPension', event.target.value)
                  }
                >
                  <option value="">Selecciona una respuesta</option>
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </Select>
              </FormField>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Guardar afiliación
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function DeclarationItem({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">
        {value === null ? 'Sin confirmar' : value ? 'Sí' : 'No'}
      </dd>
    </div>
  );
}

function AffiliationFields({
  label,
  code,
  name,
  onCodeChange,
  onNameChange,
}: {
  label: string;
  code: string;
  name: string;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-4 rounded-md border border-border-soft p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">{label}</legend>
      <FormField
        label={`Código ${label}`}
        required
        hint="Máximo 6 caracteres, según el anexo PILA."
      >
        <Input
          required
          maxLength={6}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
        />
      </FormField>
      <FormField label={`Nombre ${label}`} required>
        <Input
          required
          maxLength={120}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </FormField>
    </fieldset>
  );
}

function AffiliationItem({ label, name, code }: { label: string; name: string; code: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">
        {name} <span className="font-mono text-xs text-muted-foreground">({code})</span>
      </dd>
    </div>
  );
}
