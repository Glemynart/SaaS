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
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { GeneratedDocumentsService } from './generated-documents.service';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { GeneratedDocumentQueryDto } from './dto/generated-document-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

interface RequestUser {
  userId: string;
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('generated-documents')
export class GeneratedDocumentsController {
  constructor(private readonly service: GeneratedDocumentsService) {}

  @Post('generate')
  generate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateGeneratedDocumentDto,
  ) {
    return this.service.generate(user.tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: GeneratedDocumentQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post(':id/generate-pdf')
  async generatePdf(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.generatePdf(user.tenantId, user.userId, id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.findOne(user.tenantId, id);
    if (!doc.pdfUrl) {
      throw new NotFoundException('PDF no generado aún');
    }

    const filePath = path.join(
      process.cwd(),
      '..',
      '..',
      doc.pdfUrl.replace(/^\//, ''),
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo PDF no encontrado');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${doc.nombre}.pdf"`,
    );
    fs.createReadStream(filePath).pipe(res);
  }
}
