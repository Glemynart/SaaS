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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Roles(UserRole.ADMIN, UserRole.OPERADOR)
@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly service: DocumentTemplatesService) {}

  @Roles(UserRole.ADMIN)
  @Post('seed')
  seedDefault() {
    return this.service.seedDefaultTemplates();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateDocumentTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: DocumentTemplateQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.service.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateDocumentTemplateDto,
  ) {
    return this.service.duplicate(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }
}
