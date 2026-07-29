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
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDocumentProfileConfigurationDto } from './dto/create-document-profile-configuration.dto';
import { UpdateDocumentProfileConfigurationDto } from './dto/update-document-profile-configuration.dto';
import { DocumentProfileConfigurationsService } from './document-profile-configurations.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('document-profile-configurations')
export class DocumentProfileConfigurationsController {
  constructor(private readonly service: DocumentProfileConfigurationsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDocumentProfileConfigurationDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentProfileConfigurationDto,
  ) {
    return this.service.update(user.userId, id, dto);
  }
}
