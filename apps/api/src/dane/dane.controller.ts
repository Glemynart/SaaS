import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DaneService } from './dane.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('dane')
export class DaneController {
  constructor(private readonly daneService: DaneService) {}

  @Get('municipios')
  findAllMunicipios(@Query('search') search?: string) {
    return this.daneService.findAllMunicipios(search);
  }
}
