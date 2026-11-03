import {
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EmployeeImportService } from './employee-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PilaWorkLocationImportService } from './pila-work-location-import.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('employees/import')
export class EmployeeImportController {
  constructor(
    private readonly importService: EmployeeImportService,
    private readonly workLocationImportService: PilaWorkLocationImportService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('template')
  downloadTemplate(@Res() res: Response) {
    const buffer = this.importService.generateTemplate();
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': 'attachment; filename="plantilla_empleados.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Get('pila-affiliations/template')
  downloadPilaAffiliationsTemplate(@Res() res: Response) {
    const buffer = this.importService.generatePilaAffiliationsTemplate();
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition':
        'attachment; filename="plantilla_afiliaciones_pila.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles(UserRole.ADMIN)
  @Get('pila-work-locations/template')
  downloadPilaWorkLocationsTemplate(@Res() res: Response) {
    const buffer = this.workLocationImportService.generateTemplate();
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition':
        'attachment; filename="plantilla_ubicaciones_laborales_pila.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === XLSX_MIME ||
          file.originalname.endsWith('.xlsx')
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Solo se permiten archivos .xlsx.'),
            false,
          );
        }
      },
    }),
  )
  async importEmployees(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo .xlsx.');
    }
    return this.importService.importFromBuffer(
      user.tenantId,
      user.userId,
      file.buffer,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post('pila-affiliations')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === XLSX_MIME ||
          file.originalname.toLowerCase().endsWith('.xlsx')
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Solo se permiten archivos .xlsx.'),
            false,
          );
        }
      },
    }),
  )
  async importPilaAffiliations(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo .xlsx.');
    }
    return this.importService.importPilaAffiliationsFromBuffer(
      user.tenantId,
      user.userId,
      file.buffer,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post('pila-work-locations')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === XLSX_MIME ||
          file.originalname.toLowerCase().endsWith('.xlsx')
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Solo se permiten archivos .xlsx.'),
            false,
          );
        }
      },
    }),
  )
  async importPilaWorkLocations(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('confirmacionAportante') confirmacionAportante: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo .xlsx.');
    }
    return this.workLocationImportService.importFromBuffer(
      user.tenantId,
      user.userId,
      file.buffer,
      confirmacionAportante,
    );
  }
}
