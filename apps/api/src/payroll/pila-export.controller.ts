import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { buildContentDispositionHeader } from '../common/content-disposition';
import { PilaExportService } from './pila-export.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('payroll/periods/:periodId/pila-exports')
export class PilaExportController {
  constructor(private readonly service: PilaExportService) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('periodId') periodId: string,
  ) {
    return this.service.list(user.tenantId, periodId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('periodId') periodId: string,
  ) {
    return this.service.create(user.tenantId, user.userId, periodId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get(':exportId/:fileType')
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('periodId') periodId: string,
    @Param('exportId') exportId: string,
    @Param('fileType') fileType: string,
    @Res() response: Response,
  ) {
    const file = await this.service.download(
      user.tenantId,
      user.userId,
      periodId,
      exportId,
      fileType,
    );
    response.setHeader('Content-Type', 'text/plain; charset=windows-1252');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      buildContentDispositionHeader('attachment', file.filename),
    );
    response.setHeader('Content-Length', String(file.body.length));
    response.send(file.body);
  }
}
