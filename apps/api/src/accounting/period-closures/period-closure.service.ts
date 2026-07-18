import { Injectable } from '@nestjs/common';
import { ClosureService } from '../closure/closure.service';

/**
 * Fachada de aplicación para el ciclo de períodos. ClosureService mantiene la
 * única implementación de validación, cierre, reapertura y cierre anual.
 */
@Injectable()
export class PeriodClosureService {
  constructor(private readonly closure: ClosureService) {}

  validar(tenantId: string, periodoId: string) {
    return this.closure.validarCierrePeriodo(tenantId, periodoId);
  }

  cerrar(tenantId: string, userId: string, periodoId: string) {
    return this.closure.cerrarPeriodo(tenantId, periodoId, userId);
  }

  reabrir(tenantId: string, userId: string, periodoId: string, motivo: string) {
    return this.closure.reabrirPeriodo(tenantId, periodoId, userId, motivo);
  }

  cerrarAnio(tenantId: string, userId: string, anio: number) {
    return this.closure.cerrarAnioFiscal(tenantId, anio, userId);
  }
}
