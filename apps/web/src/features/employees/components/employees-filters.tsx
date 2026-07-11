'use client';

import { useState, useEffect } from 'react';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
    <FilterBar
      className="mb-6"
      search={
        <Input
          type="search"
          placeholder="Buscar por nombre, documento o correo…"
          aria-label="Buscar empleados"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      }
    >
      <Select
        aria-label="Filtrar por estado"
        onChange={(e) => onStatusChange(e.target.value)}
        className="sm:w-44"
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVO">Activos</option>
        <option value="INACTIVO">Inactivos</option>
        <option value="SUSPENDIDO">Suspendidos</option>
        <option value="RETIRADO">Retirados</option>
      </Select>
    </FilterBar>
  );
}
