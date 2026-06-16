'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import { EmployeesTable } from '@/features/employees/components/employees-table';
import { EmployeesFilters } from '@/features/employees/components/employees-filters';
import { EmployeeForm } from '@/features/employees/components/employee-form';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/features/employees/hooks/use-employees';
import { type Employee } from '@/features/employees/services/employees-api';

import { type EmployeeFormData } from '@/features/employees/schemas/employee-schemas';

export default function EmpleadosPage() {
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();

  const { data, isLoading } = useEmployees({ page, limit: 20, search, estado });
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500">
            Gestiona la nómina, contratos e información laboral.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Empleado
        </Button>
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
    </div>
  );
}
