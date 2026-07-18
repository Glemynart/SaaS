import { Injectable } from '@nestjs/common';
import { ReportingService } from '../reporting/reporting.service';
import {
  AuxiliarCentroCostoQueryDto,
  AuxiliarTerceroQueryDto,
  BalancePruebaQueryDto,
  LibroDiarioQueryDto,
  LibroMayorQueryDto,
} from './dto/ledger-report-query.dto';

/**
 * Fachada de consultas contables. ReportingService conserva todos los
 * filtros, agregaciones, ordenamientos y cálculos de saldos.
 */
@Injectable()
export class LedgerReportService {
  constructor(private readonly reporting: ReportingService) {}

  libroDiario(tenantId: string, query: LibroDiarioQueryDto) {
    return this.reporting.obtenerLibroDiario(tenantId, {
      fechaInicio: this.fecha(query.fechaInicio),
      fechaFin: this.fecha(query.fechaFin),
      tipoComprobanteId: query.tipoComprobanteId,
      incluirBorradores: query.incluirBorradores,
      page: query.page,
      limit: query.limit,
    });
  }

  libroMayor(tenantId: string, query: LibroMayorQueryDto) {
    return this.reporting.obtenerLibroMayor(tenantId, {
      cuentaId: query.cuentaId,
      fechaInicio: this.fecha(query.fechaInicio),
      fechaFin: this.fecha(query.fechaFin),
      page: query.page,
      limit: query.limit,
    });
  }

  balancePrueba(tenantId: string, query: BalancePruebaQueryDto) {
    return this.reporting.obtenerBalancePrueba(tenantId, {
      fechaInicio: this.fecha(query.fechaInicio),
      fechaFin: this.fecha(query.fechaFin),
      cuentaDesde: query.cuentaDesde,
      cuentaHasta: query.cuentaHasta,
      nivel: query.nivel,
    });
  }

  auxiliarTercero(tenantId: string, query: AuxiliarTerceroQueryDto) {
    return this.reporting.obtenerAuxiliarTercero(tenantId, {
      cuentaId: query.cuentaId,
      terceroId: query.terceroId,
      fechaInicio: this.fecha(query.fechaInicio),
      fechaFin: this.fecha(query.fechaFin),
      page: query.page,
      limit: query.limit,
    });
  }

  auxiliarCentroCosto(tenantId: string, query: AuxiliarCentroCostoQueryDto) {
    return this.reporting.obtenerAuxiliarCentroCosto(tenantId, {
      cuentaId: query.cuentaId,
      centroCostoId: query.centroCostoId,
      fechaInicio: this.fecha(query.fechaInicio),
      fechaFin: this.fecha(query.fechaFin),
      page: query.page,
      limit: query.limit,
    });
  }

  private fecha(value?: string): Date | undefined {
    return value ? new Date(value) : undefined;
  }
}
