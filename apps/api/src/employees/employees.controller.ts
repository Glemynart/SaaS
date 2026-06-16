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
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() createDto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user.tenantId, createDto);
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
    @Body() updateDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.tenantId, id, updateDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.employeesService.remove(user.tenantId, id);
  }
}
