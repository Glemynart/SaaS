'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLotes, useCreateLote } from '@/features/lotes/hooks/use-lotes';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import { useDocumentTemplates } from '@/features/document-templates/hooks/use-document-templates';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import { LotesTable } from '@/features/lotes/components/lotes-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import type {
  GetLotesParams,
  CreateLotePayload,
  LoteEstado,
} from '@/features/lotes/services/lotes-api';

const ESTADO_OPTIONS: { value: LoteEstado; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'COMPLETADO', label: 'Completado' },
  { value: 'COMPLETADO_CON_ERRORES', label: 'Con errores' },
  { value: 'FALLIDO', label: 'Fallido' },
];

const TIPO_OPTIONS = [
  { value: 'TERMINO_FIJO', label: 'Término Fijo' },
  { value: 'TERMINO_INDEFINIDO', label: 'Término Indefinido' },
  { value: 'OBRA_LABOR', label: 'Obra o Labor' },
  { value: 'APRENDIZAJE', label: 'Aprendizaje' },
  { value: 'PRESTACION_SERVICIOS', label: 'Prestación Servicios' },
];

const INITIAL_FORM = {
  nombre: '',
  templateId: '',
  empleadoIds: [] as string[],
  sedeId: '',
  tipoContrato: '',
  fechaInicio: '',
  fechaFin: '',
};

const selectClass =
  'flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export default function LotesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<GetLotesParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const { data, isLoading } = useLotes(filters);
  const { data: empData } = useEmployees({ limit: 200 });
  const { data: tplData } = useDocumentTemplates({ tipo: 'CONTRACT', limit: 100 });
  const { data: sedes } = useSedes({ activo: true });
  const createMutation = useCreateLote();

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setFilters((p) => ({ ...p, search: v || undefined, page: 1 }));
  }, []);

  const handleEstado = useCallback((v: string) => {
    setFilters((p) => ({
      ...p,
      estado: (v || undefined) as GetLotesParams['estado'],
      page: 1,
    }));
  }, []);

  const update = (f: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...f }));

  const toggleEmployee = (id: string) => {
    setForm((prev) => ({
      ...prev,
      empleadoIds: prev.empleadoIds.includes(id)
        ? prev.empleadoIds.filter((e) => e !== id)
        : [...prev.empleadoIds, id],
    }));
  };

  const handleCreate = () => {
    const payload: CreateLotePayload = {
      nombre: form.nombre,
      templateId: form.templateId,
      empleadoIds: form.empleadoIds,
      ...(form.sedeId ? { sedeId: form.sedeId } : {}),
      ...(form.tipoContrato ? { tipoContrato: form.tipoContrato } : {}),
      ...(form.fechaInicio ? { fechaInicio: form.fechaInicio } : {}),
      ...(form.fechaFin ? { fechaFin: form.fechaFin } : {}),
    };
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        setOpen(false);
        setForm(INITIAL_FORM);
        router.push(`/contratos/lotes/${data.id}`);
      },
    });
  };

  const employees = empData?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
            Lotes de contratos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creación y procesamiento masivo de contratos laborales.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Nuevo lote
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={filters.estado ?? ''}
          onChange={(e) => handleEstado(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Todos los estados</option>
          {ESTADO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <LotesTable lotes={data?.data ?? []} isLoading={isLoading} />

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.meta.page} de {data.meta.totalPages} ({data.meta.total} lotes)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page <= 1}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <SideSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo lote"
        description="Crear un lote para generación masiva de contratos."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex h-full flex-col"
        >
          {createMutation.error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {createMutation.error.message}
            </div>
          )}
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Nombre del lote</Label>
              <Input
                value={form.nombre}
                onChange={(e) => update({ nombre: e.target.value })}
                placeholder="Ej: Contratos enero 2026"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Plantilla de contrato</Label>
              <select
                value={form.templateId}
                onChange={(e) => update({ templateId: e.target.value })}
                className={selectClass}
              >
                <option value="">Seleccionar plantilla...</option>
                {(tplData?.data ?? [])
                  .filter((t) => t.activo)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de contrato</Label>
                <select
                  value={form.tipoContrato}
                  onChange={(e) => update({ tipoContrato: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Sin especificar</option>
                  {TIPO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sede</Label>
                <select
                  value={form.sedeId}
                  onChange={(e) => update({ sedeId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Sin sede</option>
                  {(sedes ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => update({ fechaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={form.fechaFin}
                  onChange={(e) => update({ fechaFin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Empleados ({form.empleadoIds.length} seleccionados)</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-white">
                {employees.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No hay empleados disponibles.</p>
                ) : (
                  employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={form.empleadoIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="size-4 rounded border-border"
                      />
                      <span>
                        {emp.primerNombre} {emp.primerApellido}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{emp.cedula}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                createMutation.isPending ||
                !form.nombre ||
                !form.templateId ||
                form.empleadoIds.length === 0
              }
            >
              {createMutation.isPending ? 'Creando...' : 'Crear lote'}
            </Button>
          </div>
        </form>
      </SideSheet>
    </div>
  );
}
