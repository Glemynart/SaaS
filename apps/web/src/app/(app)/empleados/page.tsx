'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import { Alert } from '@/components/ui/alert';
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
  employeesApi,
  ImportError,
} from '@/features/employees/services/employees-api';
import { type EmployeeFormData } from '@/features/employees/schemas/employee-schemas';

export default function EmpleadosPage() {
  const [page] = useState(1);
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

  const { data, isLoading } = useEmployees({ page, limit: 20, search, estado });
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const importMutation = useImportEmployees();

  const handleOpenCreate = () => {
    setSelectedEmployee(undefined);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsSheetOpen(true);
  };

  const handleSubmit = (formData: EmployeeFormData) => {
    const cleaned = { ...formData, sedeId: formData.sedeId || null };
    if (selectedEmployee) {
      updateMutation.mutate(
        { id: selectedEmployee.id, data: cleaned },
        { onSuccess: () => setIsSheetOpen(false) },
      );
    } else {
      createMutation.mutate(cleaned, {
        onSuccess: () => setIsSheetOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
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
            message: error instanceof Error ? error.message : 'Error al importar.',
          });
        }
      },
    });
  }, [selectedFile, importMutation]);

  const handleDownloadTemplate = useCallback(() => {
    employeesApi.downloadTemplate().catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500">
            Gestiona la nómina, contratos e información laboral.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenImport} className="gap-1.5">
            <Upload className="h-4 w-4" />
            Importar empleados
          </Button>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </Button>
        </div>
      </div>

      <EmployeesFilters onSearchChange={setSearch} onStatusChange={setEstado} />

      <div className="flex-1">
        <EmployeesTable
          employees={data?.data || []}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      </div>

      <SideSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={selectedEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 w-full"
            >
              <Download className="h-4 w-4" />
              Descargar plantilla Excel
            </Button>

            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/40" />
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
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">Errores de validación</p>
                    <div className="mt-2 max-h-56 overflow-y-auto space-y-2">
                      {importResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="rounded border border-destructive/20 bg-destructive/5 px-2 py-1 text-xs"
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
                  <CheckCircle2 className="h-4 w-4 text-success" />
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
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar
              </Button>
            )}
          </div>
        </div>
      </SideSheet>
    </div>
  );
}
