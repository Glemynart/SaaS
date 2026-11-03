'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, Upload, Download, Loader2, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SideSheet } from '@/components/ui/side-sheet';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { EmployeesTable } from '@/features/employees/components/employees-table';
import { EmployeesFilters } from '@/features/employees/components/employees-filters';
import { EmployeeForm } from '@/features/employees/components/employee-form';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useImportEmployees,
} from '@/features/employees/hooks/use-employees';
import {
  type Employee,
  type CreateSocialSecurityAffiliation,
  employeesApi,
  ImportError,
} from '@/features/employees/services/employees-api';
import { type EmployeeFormData } from '@/features/employees/schemas/employee-schemas';
import { getUserFacingError } from '@/lib/error-message';

function toInitialPilaAffiliation(
  values: NonNullable<EmployeeFormData['afiliacionPilaInicial']>,
): CreateSocialSecurityAffiliation {
  const declaration = (value?: string) => (value === 'SI' ? true : value === 'NO' ? false : null);

  return {
    tipoCotizanteCodigo: '01',
    subtipoCotizanteCodigo: '00',
    epsCodigo: values.epsCodigo?.trim() ?? '',
    epsNombre: values.epsNombre?.trim() ?? '',
    fondoPensionCodigo: values.fondoPensionCodigo?.trim() ?? '',
    fondoPensionNombre: values.fondoPensionNombre?.trim() ?? '',
    arlCodigo: values.arlCodigo?.trim() ?? '',
    arlNombre: values.arlNombre?.trim() ?? '',
    arlClaseRiesgo: values.arlClaseRiesgo ?? '',
    cajaCompensacionCodigo: values.cajaCompensacionCodigo?.trim() ?? '',
    cajaCompensacionNombre: values.cajaCompensacionNombre?.trim() ?? '',
    cajaCompensacionDepartamentoCodigo: values.cajaCompensacionDepartamentoCodigo ?? '',
    extranjeroNoObligadoPension: declaration(values.extranjeroNoObligadoPension),
    colombianoEnElExterior: declaration(values.colombianoEnElExterior),
    vigenteDesde: values.vigenteDesde ?? '',
    vigenteHasta: values.vigenteHasta || null,
  };
}

export default function EmpleadosPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported?: number;
    message?: string;
    errors?: { fila: number; campo: string; mensaje: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading, isError, error, refetch } = useEmployees({
    page,
    limit: 20,
    search,
    estado,
  });
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const importMutation = useImportEmployees();

  const hasFilters = search !== '' || estado !== '';

  // Cambiar un filtro regresa a la primera página (la colección cambia).
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setEstado(value);
    setPage(1);
  }, []);

  const handleOpenCreate = () => {
    setSelectedEmployee(undefined);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsSheetOpen(true);
  };

  const handleSubmit = (formData: EmployeeFormData) => {
    const { registrarAfiliacionPilaInicial, afiliacionPilaInicial, ...employeeFields } = formData;
    const cleaned = { ...employeeFields, sedeId: formData.sedeId || null };
    if (selectedEmployee) {
      updateMutation.mutate(
        { id: selectedEmployee.id, data: cleaned },
        {
          onSuccess: () => {
            setIsSheetOpen(false);
            toast.success('Cambios guardados.');
          },
          onError: (error) =>
            toast.error(
              getUserFacingError(error, 'No se pudieron guardar los cambios. Inténtalo de nuevo.'),
            ),
        },
      );
    } else {
      createMutation.mutate(
        {
          ...cleaned,
          ...(registrarAfiliacionPilaInicial && afiliacionPilaInicial
            ? { afiliacionPilaInicial: toInitialPilaAffiliation(afiliacionPilaInicial) }
            : {}),
        },
        {
          onSuccess: () => {
            setIsSheetOpen(false);
            toast.success('Empleado creado.');
          },
          onError: (error) =>
            toast.error(
              getUserFacingError(error, 'No se pudo crear el empleado. Inténtalo de nuevo.'),
            ),
        },
      );
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Empleado desactivado.'),
      onError: (error) =>
        toast.error(
          getUserFacingError(error, 'No se pudo desactivar el empleado. Inténtalo de nuevo.'),
        ),
    });
  };

  const handleOpenImport = () => {
    setImportResult(null);
    setSelectedFile(null);
    setImportOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = useCallback(() => {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setImportResult({ imported: data.imported, message: data.message });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: (error) => {
        if (error instanceof ImportError) {
          setImportResult({ errors: error.errors, message: error.message });
        } else {
          setImportResult({
            message: getUserFacingError(
              error,
              'No pudimos importar los empleados. Corrige los errores y vuelve a intentarlo.',
            ),
          });
        }
      },
    });
  }, [selectedFile, importMutation]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      await employeesApi.downloadTemplate();
    } catch (error) {
      toast.error(
        getUserFacingError(error, 'No se pudo descargar la plantilla. Inténtalo de nuevo.'),
      );
    }
  }, []);

  return (
    <PageHeader
      title="Empleados"
      description="Gestiona la información personal y laboral de tu equipo."
      width="wide"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleOpenImport}>
            <Upload className="size-4" aria-hidden="true" />
            Importar
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo empleado
          </Button>
        </>
      }
    >
      <EmployeesFilters onSearchChange={handleSearchChange} onStatusChange={handleStatusChange} />

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los empleados."
          description={getUserFacingError(error, 'Revisa tu conexión e inténtalo de nuevo.')}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          <EmployeesTable
            employees={data?.data || []}
            isLoading={isLoading}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            empty={
              hasFilters ? (
                <EmptyState
                  title="Sin resultados para esta búsqueda."
                  description="Ajusta la búsqueda o el filtro de estado para ver más empleados."
                />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Aún no hay empleados registrados."
                  description="Crea el primero o importa tu planta desde Excel."
                  action={
                    <Button size="sm" onClick={handleOpenCreate}>
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo empleado
                    </Button>
                  }
                />
              )
            }
          />

          {data?.meta && (
            <Pagination
              className="mt-4"
              page={page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              itemLabel="empleados"
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <SideSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={selectedEmployee ? 'Editar empleado' : 'Nuevo empleado'}
        description={
          selectedEmployee
            ? 'Modifica los datos laborales o personales del empleado.'
            : 'Ingresa la información para registrar un nuevo trabajador.'
        }
      >
        <EmployeeForm
          initialData={selectedEmployee}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>

      <SideSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar empleados"
        description="Carga masiva de empleados desde un archivo Excel."
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-5">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full">
              <Download className="size-4" aria-hidden="true" />
              Descargar plantilla Excel
            </Button>
            <p className="text-xs text-muted-foreground">
              Asigna una sede activa a cada empleado en la columna sede; el nombre debe coincidir
              con una sede de tu organización.
            </p>
            <p className="text-xs text-muted-foreground">
              La afiliación PILA inicial es opcional por empleado: deja vacío todo el bloque o
              completa sus datos y vigencia. Las declaraciones aplicables dependen del tipo de
              documento; los códigos de administradoras no se validan contra catálogos oficiales.
            </p>

            <div className="rounded-(--radius-card) border border-dashed border-border bg-canvas p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedFile ? selectedFile.name : 'Selecciona un archivo .xlsx'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3"
              >
                Seleccionar archivo
              </Button>
            </div>

            {importResult?.errors && importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Errores de validación</p>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-destructive/25 bg-destructive/8 px-2 py-1 text-xs"
                        >
                          <span className="font-medium">Fila {err.fila}</span>
                          {err.campo !== '*' && (
                            <span className="text-muted-foreground"> — {err.campo}</span>
                          )}
                          <p className="mt-0.5">{err.mensaje}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Alert>
            )}

            {importResult?.imported !== undefined && importResult.imported >= 0 && (
              <Alert variant="success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  <p className="text-sm">{importResult.message}</p>
                </div>
              </Alert>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setImportOpen(false)} className="flex-1">
              {importResult?.imported !== undefined ? 'Cerrar' : 'Cancelar'}
            </Button>
            {importResult?.imported === undefined && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importMutation.isPending}
                className="flex-1"
              >
                {importMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                Importar
              </Button>
            )}
          </div>
        </div>
      </SideSheet>
    </PageHeader>
  );
}
