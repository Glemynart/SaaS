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
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

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

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('tenant-branding')
export class TenantBrandingController {
  constructor(private readonly service: TenantBrandingService) {}

  @Get()
  getBranding(@CurrentUser() user: RequestUser) {
    return this.service.getBranding(user.tenantId);
  }

  @Patch()
  updateBranding(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTenantBrandingDto,
  ) {
    return this.service.updateBranding(user.tenantId, dto);
  }

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
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    const f = extractFile(file);
    return this.service.uploadLogo(user.tenantId, f.originalname, f.buffer);
  }

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
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    const f = extractFile(file);
    return this.service.uploadFirma(user.tenantId, f.originalname, f.buffer);
  }
}
