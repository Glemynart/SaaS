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
import { DocumentTemplatesService } from './document-templates.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { DocumentTemplateQueryDto } from './dto/document-template-query.dto';
import { DuplicateDocumentTemplateDto } from './dto/duplicate-document-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Roles(UserRole.ADMIN, UserRole.OPERADOR)
@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly service: DocumentTemplatesService) {}

  @Roles(UserRole.ADMIN)
  @Post('seed')
  seedDefault(@CurrentUser() user: CurrentUserPayload) {
    return this.service.seedDefaultTemplates(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDocumentTemplateDto,
  ) {
    return this.service.create(user.tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DocumentTemplateQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: DuplicateDocumentTemplateDto,
  ) {
    return this.service.duplicate(user.tenantId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggleActive(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.toggleActive(user.tenantId, id);
  }
}
