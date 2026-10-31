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
import { ClosePilaWorkAssignmentDto } from './dto/close-pila-work-assignment.dto';
import { CreatePilaWorkAssignmentDto } from './dto/create-pila-work-assignment.dto';
import { CreatePilaWorkCenterDto } from './dto/create-pila-work-center.dto';
import { PatchPilaWorkCenterDto } from './dto/patch-pila-work-center.dto';
import { PilaWorkCentersService } from './pila-work-centers.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class PilaWorkCentersController {
  constructor(private readonly pilaWorkCenters: PilaWorkCentersService) {}

  @Authenticated()
  @Get('pila-centros-trabajo')
  listCenters() {
    return this.pilaWorkCenters.listCenters();
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('pila-centros-trabajo')
  createCenter(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePilaWorkCenterDto,
  ) {
    return this.pilaWorkCenters.createCenter(user.userId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch('pila-centros-trabajo/:id')
  setCenterStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: PatchPilaWorkCenterDto,
  ) {
    return this.pilaWorkCenters.setCenterStatus(user.userId, id, dto);
  }

  @Authenticated()
  @Get('employees/:id/asignaciones-centro-pila')
  listAssignments(@Param('id') id: string) {
    return this.pilaWorkCenters.listAssignments(id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('employees/:id/asignaciones-centro-pila')
  createAssignment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreatePilaWorkAssignmentDto,
  ) {
    return this.pilaWorkCenters.createAssignment(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch('employees/:id/asignaciones-centro-pila/:assignmentId')
  closeAssignment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ClosePilaWorkAssignmentDto,
  ) {
    return this.pilaWorkCenters.closeAssignment(
      user.userId,
      id,
      assignmentId,
      dto,
    );
  }
}
