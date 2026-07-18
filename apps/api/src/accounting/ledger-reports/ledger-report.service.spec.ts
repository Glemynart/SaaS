import { ReportingService } from '../reporting/reporting.service';
import { LedgerReportService } from './ledger-report.service';

describe('LedgerReportService', () => {
  const reporting = {
    obtenerLibroDiario: jest.fn(),
    obtenerLibroMayor: jest.fn(),
    obtenerBalancePrueba: jest.fn(),
    obtenerAuxiliarTercero: jest.fn(),
    obtenerAuxiliarCentroCosto: jest.fn(),
  };
  const service = new LedgerReportService(
    reporting as unknown as ReportingService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delega Libro Diario con filtros y paginación existentes', () => {
    service.libroDiario('tenant-a', {
      fechaInicio: '2026-01-01T00:00:00.000Z',
      fechaFin: '2026-01-31T00:00:00.000Z',
      tipoComprobanteId: 'tipo-cc',
      incluirBorradores: false,
      page: 2,
      limit: 25,
    });

    expect(reporting.obtenerLibroDiario).toHaveBeenCalledWith('tenant-a', {
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
      tipoComprobanteId: 'tipo-cc',
      incluirBorradores: false,
      page: 2,
      limit: 25,
    });
  });

  it('delega Libro Mayor, Balance y auxiliares sin calcular resultados', () => {
    service.libroMayor('tenant-a', {
      cuentaId: 'cuenta-a',
      page: 3,
      limit: 10,
    });
    service.balancePrueba('tenant-a', {
      cuentaDesde: '1',
      cuentaHasta: '399999',
      nivel: 4,
    });
    service.auxiliarTercero('tenant-a', {
      cuentaId: 'cuenta-a',
      terceroId: 'tercero-a',
      page: 1,
      limit: 20,
    });
    service.auxiliarCentroCosto('tenant-a', {
      cuentaId: 'cuenta-a',
      centroCostoId: 'centro-a',
      page: 2,
      limit: 5,
    });

    expect(reporting.obtenerLibroMayor).toHaveBeenCalledWith('tenant-a', {
      cuentaId: 'cuenta-a',
      fechaInicio: undefined,
      fechaFin: undefined,
      page: 3,
      limit: 10,
    });
    expect(reporting.obtenerBalancePrueba).toHaveBeenCalledWith('tenant-a', {
      fechaInicio: undefined,
      fechaFin: undefined,
      cuentaDesde: '1',
      cuentaHasta: '399999',
      nivel: 4,
    });
    expect(reporting.obtenerAuxiliarTercero).toHaveBeenCalledWith('tenant-a', {
      cuentaId: 'cuenta-a',
      terceroId: 'tercero-a',
      fechaInicio: undefined,
      fechaFin: undefined,
      page: 1,
      limit: 20,
    });
    expect(reporting.obtenerAuxiliarCentroCosto).toHaveBeenCalledWith(
      'tenant-a',
      {
        cuentaId: 'cuenta-a',
        centroCostoId: 'centro-a',
        fechaInicio: undefined,
        fechaFin: undefined,
        page: 2,
        limit: 5,
      },
    );
  });
});
