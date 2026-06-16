import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedeQueryDto } from './dto/sede-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  userId: string;
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSedeDto) {
    return this.sedesService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: SedeQueryDto) {
    return this.sedesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.sedesService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSedeDto,
  ) {
    return this.sedesService.update(user.tenantId, id, dto);
  }
}
