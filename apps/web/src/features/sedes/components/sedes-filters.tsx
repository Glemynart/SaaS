'use client';

import { useState, useEffect } from 'react';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface SedesFiltersProps {
  onSearchChange: (search: string) => void;
  /** '' (todas) | 'true' | 'false' — se traduce a `activo` en la página. */
  onStatusChange: (status: string) => void;
}

export function SedesFilters({ onSearchChange, onStatusChange }: SedesFiltersProps) {
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
          placeholder="Buscar por nombre…"
          aria-label="Buscar sedes"
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
        <option value="true">Activas</option>
        <option value="false">Inactivas</option>
      </Select>
    </FilterBar>
  );
}
