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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface RequestUser {
  userId: string;
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.employeesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.tenantId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.employeesService.remove(user.tenantId, id);
  }
}
