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
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly service: DocumentTemplatesService) {}

  @Post('seed')
  seedDefault(@CurrentUser() user: RequestUser) {
    return this.service.seedDefaultTemplates(user.tenantId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDocumentTemplateDto,
  ) {
    return this.service.create(user.tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: DocumentTemplateQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DuplicateDocumentTemplateDto,
  ) {
    return this.service.duplicate(user.tenantId, id, dto);
  }

  @Patch(':id/toggle')
  toggleActive(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.toggleActive(user.tenantId, id);
  }
}
