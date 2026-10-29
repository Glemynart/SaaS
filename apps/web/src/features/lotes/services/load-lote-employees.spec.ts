import {
  employeesApi,
  type Employee,
  type PaginatedResponse,
} from '@/features/employees/services/employees-api';
import { loadLoteEmployees } from './load-lote-employees';

jest.mock('@/features/employees/services/employees-api', () => ({
  employeesApi: { getAll: jest.fn() },
}));

const getAll = employeesApi.getAll as jest.MockedFunction<typeof employeesApi.getAll>;

function page(
  ids: string[],
  total: number,
  pageNumber: number,
  totalPages: number,
): PaginatedResponse<Employee> {
  return {
    data: ids.map((id) => ({ id }) as Employee),
    meta: { total, page: pageNumber, limit: 200, totalPages },
  };
}

describe('loadLoteEmployees', () => {
  beforeEach(() => getAll.mockReset());

  it('loads every page, including employees beyond the first 200', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `employee-${i}`);
    getAll.mockResolvedValueOnce(page(ids.slice(0, 200), 201, 1, 2));
    getAll.mockResolvedValueOnce(page(ids.slice(200), 201, 2, 2));

    const result = await loadLoteEmployees();
    expect(result.map((employee) => employee.id)).toEqual(ids);
    expect(getAll).toHaveBeenNthCalledWith(2, { page: 2, limit: 200 });
  });

  it('does not return a partial selection when a page fails', async () => {
    getAll.mockResolvedValueOnce(page(['first'], 2, 1, 2));
    getAll.mockRejectedValueOnce(new Error('No disponible'));
    await expect(loadLoteEmployees()).rejects.toThrow('No disponible');
  });

  it('rejects pagination changes while loading employees', async () => {
    getAll.mockResolvedValueOnce(page(['first'], 2, 1, 2));
    getAll.mockResolvedValueOnce(page(['second'], 3, 2, 2));
    await expect(loadLoteEmployees()).rejects.toThrow('La lista de empleados cambió.');
  });

  it('rejects duplicate employee IDs across pages', async () => {
    getAll.mockResolvedValueOnce(page(['first'], 2, 1, 2));
    getAll.mockResolvedValueOnce(page(['first'], 2, 2, 2));
    await expect(loadLoteEmployees()).rejects.toThrow('lista completa');
  });
});
