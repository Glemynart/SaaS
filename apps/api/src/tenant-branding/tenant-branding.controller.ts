import {
  Controller,
  Get,
  Patch,
  Body,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantBrandingService } from './tenant-branding.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

function extractFile(file: MulterFile) {
  return { originalname: file.originalname, buffer: file.buffer };
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('tenant-branding')
export class TenantBrandingController {
  constructor(private readonly service: TenantBrandingService) {}

  @Get()
  getBranding(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getBranding(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Patch()
  updateBranding(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTenantBrandingDto,
  ) {
    return this.service.updateBranding(user.tenantId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('upload-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes PNG, JPG, WebP o SVG',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    const f = extractFile(file);
    return this.service.uploadLogo(user.tenantId, f.originalname, f.buffer);
  }

  @Roles(UserRole.ADMIN)
  @Post('upload-firma')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes PNG, JPG, WebP o SVG',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadFirma(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    const f = extractFile(file);
    return this.service.uploadFirma(user.tenantId, f.originalname, f.buffer);
  }
}
