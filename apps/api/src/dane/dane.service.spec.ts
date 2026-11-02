import { DIVIPOLA_MGN_2025_MUNICIPALITIES } from './divipola-mgn-2025';
import { DaneService } from './dane.service';

describe('DaneService', () => {
  const createMany = jest.fn();
  const findMany = jest.fn();
  let service: DaneService;

  beforeEach(() => {
    jest.clearAllMocks();
    createMany.mockResolvedValue({ count: 1104 });
    findMany.mockResolvedValue([]);
    service = new DaneService({
      municipioDane: { createMany, findMany },
    } as never);
  });

  it('seeds the versioned DIVIPOLA municipality catalog idempotently', async () => {
    await service.onModuleInit();

    expect(createMany).toHaveBeenCalledWith({
      data: DIVIPOLA_MGN_2025_MUNICIPALITIES.map(
        ({ codigo, nombre, departamento }) => ({
          codigo,
          nombre,
          departamento,
        }),
      ),
      skipDuplicates: true,
    });
    expect(DIVIPOLA_MGN_2025_MUNICIPALITIES).toHaveLength(1104);
    expect(
      new Set(DIVIPOLA_MGN_2025_MUNICIPALITIES.map(({ codigo }) => codigo))
        .size,
    ).toBe(1104);
    expect(
      DIVIPOLA_MGN_2025_MUNICIPALITIES.every(
        ({ codigo, departamentoCodigo }) =>
          codigo.slice(0, 2) === departamentoCodigo,
      ),
    ).toBe(true);
  });

  it('does not include non-municipalized areas in the standard municipality catalog', () => {
    const codes = DIVIPOLA_MGN_2025_MUNICIPALITIES.map(({ codigo }) => codigo);
    const nonMunicipalizedAreaCodes = [
      '91263',
      '91405',
      '91407',
      '91430',
      '91460',
      '91530',
      '91536',
      '91669',
      '91798',
      '94883',
      '94884',
      '94885',
      '94886',
      '94887',
      '94888',
      '97511',
      '97777',
      '97889',
    ];

    expect(codes).toContain('91001');
    expect(codes).toContain('88001');
    expect(codes).not.toEqual(
      expect.arrayContaining(nonMunicipalizedAreaCodes),
    );
  });

  it('returns municipalities filtered by the requested search value', async () => {
    await service.findAllMunicipios('Medellín');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nombre: { contains: 'Medellín', mode: 'insensitive' } },
          { departamento: { contains: 'Medellín', mode: 'insensitive' } },
        ],
      },
      orderBy: { nombre: 'asc' },
    });
  });
});
