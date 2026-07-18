import { LedgerService } from '../ledger/ledger.service';
import { ManualJournalService } from './manual-journal.service';

describe('ManualJournalService', () => {
  const ledger = {
    registrarComprobante: jest.fn(),
    anular: jest.fn(),
  };
  const service = new ManualJournalService(ledger as unknown as LedgerService);

  beforeEach(() => jest.clearAllMocks());

  it('registra un comprobante manual exclusivamente por LedgerService', async () => {
    ledger.registrarComprobante.mockResolvedValue({ id: 'comp-001' });

    await expect(
      service.registrar('tenant-a', 'user-a', {
        tipoComprobanteId: 'tipo-cc',
        periodoId: 'periodo-a',
        fecha: '2026-06-30T00:00:00.000Z',
        concepto: 'Ajuste manual',
        lineas: [
          { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
          { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
        ],
      }),
    ).resolves.toEqual({ id: 'comp-001' });

    expect(ledger.registrarComprobante).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'user-a',
      tipoComprobanteId: 'tipo-cc',
      periodoId: 'periodo-a',
      fecha: new Date('2026-06-30T00:00:00.000Z'),
      concepto: 'Ajuste manual',
      lineas: [
        { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
        { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
      ],
    });
  });

  it('propaga los rechazos de invariantes del Ledger sin duplicar reglas', async () => {
    const rechazo = new Error('Partida no balanceada');
    ledger.registrarComprobante.mockRejectedValue(rechazo);

    await expect(
      service.registrar('tenant-a', 'user-a', {
        tipoComprobanteId: 'tipo-cc',
        periodoId: 'periodo-a',
        fecha: '2026-06-30T00:00:00.000Z',
        concepto: 'Inválido',
        lineas: [],
      }),
    ).rejects.toBe(rechazo);
  });

  it('anula exclusivamente por el mecanismo aprobado de LedgerService', async () => {
    ledger.anular.mockResolvedValue({ id: 'reverso-001' });

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Error de digitación'),
    ).resolves.toEqual({ id: 'reverso-001' });

    expect(ledger.anular).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'comp-001',
      'Error de digitación',
    );
  });
});
