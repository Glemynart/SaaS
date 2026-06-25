import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TiposComprobanteService } from './tipos-comprobante.service';
import { TipoComprobanteQueryDto } from './dto/tipo-comprobante-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';

// Catálogo global de solo lectura (ver TiposComprobanteService).
@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('accounting/tipos-comprobante')
export class TiposComprobanteController {
  constructor(private readonly service: TiposComprobanteService) {}

  @Get()
  findAll(@Query() query: TipoComprobanteQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
