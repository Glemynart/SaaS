import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MAX_MANUAL_DOCUMENT_SIZE } from '../../expediente-docs/manual-document-validation';
import {
  CancelEmployeeDisbursementDto,
  CreateEmployeeDisbursementDto,
  EmployeeDisbursementSourceType,
  ReverseEmployeeDisbursementDto,
  ListEmployeeDisbursementObligationsDto,
  ListPendingEmployeeDisbursementsDto,
} from './employee-disbursement.dto';
import { EmployeeDisbursementService } from './employee-disbursement.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('payroll/disbursements')
export class EmployeeDisbursementController {
  constructor(private readonly service: EmployeeDisbursementService) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('obligations')
  listObligations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListEmployeeDisbursementObligationsDto,
  ) {
    return this.service.listObligations(user.tenantId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('pending-verification')
  listPendingVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListPendingEmployeeDisbursementsDto,
  ) {
    return this.service.listPendingVerification(user.tenantId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmployeeDisbursementDto,
  ) {
    return this.service.create(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get()
  getSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('sourceType') sourceType: EmployeeDisbursementSourceType,
    @Query('sourceId') sourceId: string,
  ) {
    if (!Object.values(EmployeeDisbursementSourceType).includes(sourceType)) {
      throw new BadRequestException('El tipo de obligación no es válido.');
    }
    if (!sourceId || sourceId.length > 64) {
      throw new BadRequestException(
        'El identificador de obligación no es válido.',
      );
    }
    return this.service.getSummary(user.tenantId, sourceType, sourceId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/support')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MANUAL_DOCUMENT_SIZE, files: 1 },
    }),
  )
  attachSupport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file)
      throw new BadRequestException('Adjunte el soporte del desembolso.');
    return this.service.attachSupport(user.tenantId, user.userId, id, file);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/verify')
  verify(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.verify(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CancelEmployeeDisbursementDto,
  ) {
    return this.service.cancel(user.tenantId, user.userId, id, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reversals')
  reverse(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReverseEmployeeDisbursementDto,
  ) {
    return this.service.reverse(user.tenantId, user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get(':id/support')
  async downloadSupport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.service.downloadSupport(
      user.tenantId,
      user.userId,
      id,
    );
    const extension =
      file.mimeType === 'application/pdf'
        ? 'pdf'
        : file.mimeType === 'image/jpeg'
          ? 'jpg'
          : file.mimeType === 'image/png'
            ? 'png'
            : 'webp';
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="support.${extension}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.body);
  }
}
