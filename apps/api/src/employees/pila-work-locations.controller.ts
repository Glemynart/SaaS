import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Authenticated } from '../auth/authorization/authorization-policy';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClosePilaWorkLocationDto } from './dto/close-pila-work-location.dto';
import { CreatePilaWorkLocationDto } from './dto/create-pila-work-location.dto';
import { PilaWorkLocationsService } from './pila-work-locations.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('employees/:id/ubicaciones-laborales-pila')
export class PilaWorkLocationsController {
  constructor(private readonly locations: PilaWorkLocationsService) {}

  @Authenticated()
  @Get()
  list(@Param('id') employeeId: string) {
    return this.locations.list(employeeId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') employeeId: string,
    @Body() dto: CreatePilaWorkLocationDto,
  ) {
    return this.locations.create(user.userId, employeeId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch(':locationId')
  close(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') employeeId: string,
    @Param('locationId') locationId: string,
    @Body() dto: ClosePilaWorkLocationDto,
  ) {
    return this.locations.close(user.userId, employeeId, locationId, dto);
  }
}
