import {
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EmployeeImportService } from './employee-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  userId: string;
  tenantId: string;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('employees/import')
export class EmployeeImportController {
  constructor(private readonly importService: EmployeeImportService) {}

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
    @CurrentUser() user: RequestUser,
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
}
