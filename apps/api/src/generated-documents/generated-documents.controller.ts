import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GeneratedDocumentsService } from './generated-documents.service';
import { GeneratedDocumentAccessService } from './generated-document-access.service';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { GeneratedDocumentQueryDto } from './dto/generated-document-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('generated-documents')
export class GeneratedDocumentsController {
  constructor(
    private readonly service: GeneratedDocumentsService,
    private readonly accessService: GeneratedDocumentAccessService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('generate')
  generate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateGeneratedDocumentDto,
  ) {
    return this.service.generate(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GeneratedDocumentQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/generate-pdf')
  async generatePdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.generatePdf(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get(':id/download')
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.accessService.getDownload(user, id);

    this.sendPdf(res, doc, 'attachment');
  }

  /** Ruta histórica preservada mientras los consumidores migran a /download. */
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.accessService.getDownload(user, id);

    this.sendPdf(res, doc, 'inline');
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.accessService.getMetadata(user, id);
  }

  private sendPdf(
    res: Response,
    doc: { nombre: string; body: Buffer },
    disposition: 'attachment' | 'inline',
  ): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${this.toSafeFilename(doc.nombre)}.pdf"`,
    );
    res.send(doc.body);
  }

  private toSafeFilename(nombre: string): string {
    return nombre.replace(/[\\r\\n"]/g, '_');
  }
}
