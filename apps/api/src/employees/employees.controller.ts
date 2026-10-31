import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';
import { CreateSocialSecurityAffiliationDto } from './dto/create-social-security-affiliation.dto';
import { CloseSocialSecurityAffiliationDto } from './dto/close-social-security-affiliation.dto';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly socialSecurityAffiliations: SocialSecurityAffiliationsService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user.userId, dto);
  }

  @Get()
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Get(':id/afiliaciones-seguridad-social')
  listSocialSecurityAffiliations(@Param('id') id: string) {
    return this.socialSecurityAffiliations.list(id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/afiliaciones-seguridad-social')
  createSocialSecurityAffiliation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateSocialSecurityAffiliationDto,
  ) {
    return this.socialSecurityAffiliations.create(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch(':id/afiliaciones-seguridad-social/:affiliationId')
  closeSocialSecurityAffiliation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('affiliationId') affiliationId: string,
    @Body() dto: CloseSocialSecurityAffiliationDto,
  ) {
    return this.socialSecurityAffiliations.close(
      user.userId,
      id,
      affiliationId,
      dto,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.employeesService.remove(user.userId, id);
  }
}
