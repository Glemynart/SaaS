import { employeesApi, type Employee } from '@/features/employees/services/employees-api';

export async function loadLoteEmployees(): Promise<Employee[]> {
  const limit = 200;
  const first = await employeesApi.getAll({ page: 1, limit });
  const employees = [...first.data];

  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const next = await employeesApi.getAll({ page, limit });
    if (next.meta.total !== first.meta.total || next.meta.totalPages !== first.meta.totalPages) {
      throw new Error('La lista de empleados cambió. Vuelve a cargarla antes de seleccionar.');
    }
    employees.push(...next.data);
  }

  if (
    employees.length !== first.meta.total ||
    new Set(employees.map((employee) => employee.id)).size !== employees.length
  ) {
    throw new Error('No se pudo cargar la lista completa de empleados.');
  }
  return employees;
}
