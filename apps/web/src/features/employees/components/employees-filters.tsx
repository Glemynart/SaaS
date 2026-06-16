import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface EmployeesFiltersProps {
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
}

export function EmployeesFilters({ onSearchChange, onStatusChange }: EmployeesFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange]);

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="w-full sm:max-w-sm">
        <Input
          type="search"
          placeholder="Buscar por nombre, documento o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white"
        />
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <select
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:w-[180px]"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
          <option value="SUSPENDIDO">Suspendidos</option>
          <option value="RETIRADO">Retirados</option>
        </select>
      </div>
    </div>
  );
}
