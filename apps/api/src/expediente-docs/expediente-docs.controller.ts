import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { buildContentDispositionHeader } from '../common/content-disposition';
import { ExpedienteDocsService } from './expediente-docs.service';
import { MAX_MANUAL_DOCUMENT_SIZE } from './manual-document-validation';
import { UploadExpedienteDocDto } from './dto/upload-expediente-doc.dto';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class ExpedienteDocsController {
  constructor(private readonly service: ExpedienteDocsService) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('employees/:id/expediente')
  findByEmployee(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.findByEmployee(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('expediente-docs/:id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('expediente-docs/:id/history')
  findHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.findHistory(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('expediente-docs/:id/download')
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.download(user.tenantId, user.userId, id);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      buildContentDispositionHeader('attachment', doc.nombre),
    );
    res.send(doc.body);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('employees/:id/expediente')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MANUAL_DOCUMENT_SIZE },
    }),
  )
  uploadManual(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') employeeId: string,
    @Body() dto: UploadExpedienteDocDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo.');

    return this.service.uploadManual(
      user.tenantId,
      user.userId,
      user.email,
      employeeId,
      dto.categoria,
      file,
      dto.familiaId,
    );
  }

  @Roles(UserRole.ADMIN)
  @Delete('expediente-docs/:id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
