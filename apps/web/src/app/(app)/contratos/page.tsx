'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useContracts, useCreateContract } from '@/features/contracts/hooks/use-contracts';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import { ContractsTable } from '@/features/contracts/components/contracts-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import type {
  GetContractsParams,
  CreateContractPayload,
} from '@/features/contracts/services/contracts-api';

const ESTADO_LABELS: Record<string, string> = {
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  TERMINADO: 'Terminado',
  RENOVADO: 'Renovado',
};

export default function ContratosPage() {
  const [filters, setFilters] = useState<GetContractsParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateContractPayload>({
    employeeId: '',
    tipo: 'TERMINO_FIJO',
    cargo: '',
    salario: 0,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: '',
    sedeId: '',
    plantillaId: '',
  });

  const { data, isLoading } = useContracts(filters);
  const { data: empData } = useEmployees({ limit: 200 });
  const { data: sedes } = useSedes({ activo: true });
  const createMutation = useCreateContract();

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setFilters((p) => ({ ...p, search: v || undefined, page: 1 }));
  }, []);
  const handleEstado = useCallback((v: string) => {
    setFilters((p) => ({
      ...p,
      estado: (v || undefined) as GetContractsParams['estado'],
      page: 1,
    }));
  }, []);

  const handleCreate = () => {
    const payload = {
      ...form,
      sedeId: form.sedeId || undefined,
      plantillaId: form.plantillaId || undefined,
      fechaFin: form.fechaFin || undefined,
    };
    createMutation.mutate(payload as CreateContractPayload, {
      onSuccess: () => {
        setOpen(false);
        setForm({
          employeeId: '',
          tipo: 'TERMINO_FIJO',
          cargo: '',
          salario: 0,
          fechaInicio: new Date().toISOString().split('T')[0],
          fechaFin: '',
          sedeId: '',
          plantillaId: '',
        });
      },
    });
  };

  const update = (f: Partial<typeof form>) =>
    setForm((prev) => {
      const next = { ...prev, ...f };
      if (f.employeeId) {
        const emp = empData?.data?.find((e) => e.id === f.employeeId);
        if (emp) next.cargo = emp.cargo;
      }
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">Contratos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de contratos laborales con snapshots de cargo y salario.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Nuevo contrato
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Input
          placeholder="Buscar por empleado o cargo..."
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
          {Object.entries(ESTADO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <ContractsTable contracts={data?.data ?? []} isLoading={isLoading} />

      <SideSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo contrato"
        description="Crear un contrato laboral con snapshot de cargo y salario."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex h-full flex-col"
        >
          <div className="flex-1 space-y-4">
            <div className="space-y-1.5">
              <Label>Empleado</Label>
              <select
                value={form.employeeId}
                onChange={(e) => update({ employeeId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Seleccionar empleado...</option>
                {(empData?.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.primerNombre} {e.primerApellido} — {e.cedula}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  value={form.tipo}
                  onChange={(e) => update({ tipo: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="TERMINO_FIJO">Término Fijo</option>
                  <option value="TERMINO_INDEFINIDO">Término Indefinido</option>
                  <option value="OBRA_LABOR">Obra o Labor</option>
                  <option value="APRENDIZAJE">Aprendizaje</option>
                  <option value="PRESTACION_SERVICIOS">Prestación Servicios</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Salario</Label>
                <Input
                  type="number"
                  value={form.salario}
                  onChange={(e) => update({ salario: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={(e) => update({ cargo: e.target.value })} />
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
              <Label>Sede</Label>
              <select
                value={form.sedeId}
                onChange={(e) => update({ sedeId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear contrato'}
            </Button>
          </div>
        </form>
      </SideSheet>
    </div>
  );
}
