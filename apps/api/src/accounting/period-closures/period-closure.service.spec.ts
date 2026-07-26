import { ClosureService } from '../closure/closure.service';
import { PeriodClosureService } from './period-closure.service';

describe('PeriodClosureService', () => {
  const closure = {
    validarCierrePeriodo: jest.fn(),
    cerrarPeriodo: jest.fn(),
    reabrirPeriodo: jest.fn(),
    cerrarAnioFiscal: jest.fn(),
  };
  const service = new PeriodClosureService(
    closure as unknown as ClosureService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delega las cuatro operaciones exclusivamente a ClosureService', async () => {
    closure.validarCierrePeriodo.mockResolvedValue({
      procede: true,
      bloqueos: [],
    });
    closure.cerrarPeriodo.mockResolvedValue({
      cerrado: true,
      yaEstabaCerrado: false,
    });
    closure.reabrirPeriodo.mockResolvedValue({
      reabierto: true,
      yaEstabaAbierto: false,
    });
    closure.cerrarAnioFiscal.mockResolvedValue({
      posteado: true,
      yaEstabaPosteado: false,
      diciembreCerrado: true,
    });

    await expect(service.validar('tenant-a', 'periodo-a')).resolves.toEqual({
      procede: true,
      bloqueos: [],
    });
    await expect(
      service.cerrar('tenant-a', 'user-a', 'periodo-a'),
    ).resolves.toEqual({
      cerrado: true,
      yaEstabaCerrado: false,
    });
    await expect(
      service.reabrir(
        'tenant-a',
        'user-a',
        'periodo-a',
        'Corrección autorizada',
      ),
    ).resolves.toEqual({ reabierto: true, yaEstabaAbierto: false });
    await expect(
      service.cerrarAnio('tenant-a', 'user-a', 2026),
    ).resolves.toEqual({
      posteado: true,
      yaEstabaPosteado: false,
      diciembreCerrado: true,
    });

    expect(closure.validarCierrePeriodo).toHaveBeenCalledWith(
      'tenant-a',
      'periodo-a',
    );
    expect(closure.cerrarPeriodo).toHaveBeenCalledWith(
      'tenant-a',
      'periodo-a',
      'user-a',
    );
    expect(closure.reabrirPeriodo).toHaveBeenCalledWith(
      'tenant-a',
      'periodo-a',
      'user-a',
      'Corrección autorizada',
    );
    expect(closure.cerrarAnioFiscal).toHaveBeenCalledWith(
      'tenant-a',
      2026,
      'user-a',
    );
  });

  it('conserva sin alterar los bloqueos y resultados del dominio', async () => {
    const resultado = {
      reabierto: false,
      yaEstabaAbierto: false,
      bloqueos: ['NO_ES_ULTIMO_PERIODO_CERRADO'],
    };
    closure.reabrirPeriodo.mockResolvedValue(resultado);

    await expect(
      service.reabrir('tenant-a', 'user-a', 'periodo-a', 'Motivo'),
    ).resolves.toBe(resultado);
  });
});
