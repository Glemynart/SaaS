import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  AuxiliarCentroCostoQueryDto,
  AuxiliarTerceroQueryDto,
  BalancePruebaQueryDto,
  LibroDiarioQueryDto,
  LibroMayorQueryDto,
} from './dto/ledger-report-query.dto';
import { LedgerReportService } from './ledger-report.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/reportes')
export class LedgerReportController {
  constructor(private readonly reports: LedgerReportService) {}

  @Get('libro-diario')
  libroDiario(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LibroDiarioQueryDto,
  ) {
    return this.reports.libroDiario(user.tenantId, query);
  }

  @Get('libro-mayor')
  libroMayor(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LibroMayorQueryDto,
  ) {
    return this.reports.libroMayor(user.tenantId, query);
  }

  @Get('balance-prueba')
  balancePrueba(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: BalancePruebaQueryDto,
  ) {
    return this.reports.balancePrueba(user.tenantId, query);
  }

  @Get('auxiliares/tercero')
  auxiliarTercero(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AuxiliarTerceroQueryDto,
  ) {
    return this.reports.auxiliarTercero(user.tenantId, query);
  }

  @Get('auxiliares/centro-costo')
  auxiliarCentroCosto(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AuxiliarCentroCostoQueryDto,
  ) {
    return this.reports.auxiliarCentroCosto(user.tenantId, query);
  }
}
