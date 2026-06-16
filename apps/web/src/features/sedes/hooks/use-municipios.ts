import { useQuery } from '@tanstack/react-query';
import { type MunicipioRef } from '../services/sedes-api';

async function fetchMunicipios(search?: string): Promise<MunicipioRef[]> {
  const searchParams = new URLSearchParams();
  if (search) searchParams.set('search', search);

  const qs = searchParams.toString();
  const response = await fetch(`/api/dane/municipios${qs ? `?${qs}` : ''}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  const body = (await response.json().catch(() => ({}))) as MunicipioRef[] | { message?: string };

  if (!response.ok) {
    const message = Array.isArray(body) ? undefined : body.message;
    throw new Error(message ?? 'No se pudo completar la solicitud.');
  }

  return body as MunicipioRef[];
}

export const municipioKeys = {
  all: ['municipios'] as const,
  list: (search?: string) => [...municipioKeys.all, 'list', search ?? ''] as const,
};

export function useMunicipios(search?: string) {
  return useQuery({
    queryKey: municipioKeys.list(search),
    queryFn: () => fetchMunicipios(search),
  });
}
