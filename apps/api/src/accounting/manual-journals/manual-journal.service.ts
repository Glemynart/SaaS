import { Injectable } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

/**
 * Fachada de aplicación para operaciones manuales. No persiste comprobantes
 * ni movimientos: LedgerService conserva el único puerto de escritura.
 */
@Injectable()
export class ManualJournalService {
  constructor(private readonly ledger: LedgerService) {}

  registrar(tenantId: string, userId: string, dto: CreateManualJournalDto) {
    return this.ledger.registrarComprobante({
      tenantId,
      userId,
      tipoComprobanteId: dto.tipoComprobanteId,
      periodoId: dto.periodoId,
      fecha: new Date(dto.fecha),
      concepto: dto.concepto,
      lineas: dto.lineas,
    });
  }

  anular(
    tenantId: string,
    userId: string,
    comprobanteId: string,
    motivo: string,
  ) {
    return this.ledger.anular(tenantId, userId, comprobanteId, motivo);
  }
}
