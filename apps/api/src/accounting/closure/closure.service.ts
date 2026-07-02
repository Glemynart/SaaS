import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from '../reporting/reporting.service';

export interface ValidacionCierreResult {
  procede: boolean;
  bloqueos: string[];
}

@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
  ) {}

  async validarCierrePeriodo(
    tenantId: string,
    periodoId: string,
  ): Promise<ValidacionCierreResult> {
    const bloqueos: string[] = [];

    // --- 1. El período existe y está ABIERTO ---
    const periodo = await this.prisma.periodoContable.findFirst({
      where: { id: periodoId, tenantId },
      select: {
        id: true,
        estado: true,
        anio: true,
        mes: true,
        fechaInicio: true,
        fechaFin: true,
      },
    });

    if (!periodo) {
      bloqueos.push('PERIODO_NO_ENCONTRADO');
      return { procede: false, bloqueos };
    }

    if (periodo.estado === 'CERRADO') {
      bloqueos.push('PERIODO_YA_CERRADO');
    }

    if (bloqueos.length > 0) {
      return { procede: false, bloqueos };
    }

    // --- 2. Sin comprobantes en BORRADOR ---
    const borradoresCount = await this.prisma.comprobanteContable.count({
      where: {
        tenantId,
        periodoId,
        estado: 'BORRADOR',
      },
    });

    if (borradoresCount > 0) {
      bloqueos.push('BORRADORES_PENDIENTES');
    }

    // --- 3. Cierre cronológico ---
    const { anio, mes } = periodo;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;

    const anteriorAbierto = await this.prisma.periodoContable.findFirst({
      where: {
        tenantId,
        anio: anioAnterior,
        mes: mesAnterior,
        estado: 'ABIERTO',
      },
      select: { id: true },
    });

    if (anteriorAbierto) {
      bloqueos.push('CIERRE_CRONOLOGICO');
    }

    // --- 4. Cuadre del período — consume C2, no calcula saldos (C3-I10) ---
    const balance = await this.reporting.obtenerBalancePrueba(tenantId, {
      fechaInicio: periodo.fechaInicio,
      fechaFin: periodo.fechaFin,
    });

    const totalDebito = balance.reduce(
      (acc, item) => acc.add(item.totalDebito),
      new Prisma.Decimal(0),
    );
    const totalCredito = balance.reduce(
      (acc, item) => acc.add(item.totalCredito),
      new Prisma.Decimal(0),
    );

    if (!totalDebito.equals(totalCredito)) {
      bloqueos.push('DESCUADRE');
    }

    return {
      procede: bloqueos.length === 0,
      bloqueos,
    };
  }
}
