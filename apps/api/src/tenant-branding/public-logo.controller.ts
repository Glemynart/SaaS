import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Unauthenticated } from '../auth/authorization/authorization-policy';
import { TenantBrandingService } from './tenant-branding.service';

/** Mantiene la URL pública histórica de logos mediante StorageService. */
@Controller('uploads/logos')
export class PublicLogoController {
  constructor(private readonly service: TenantBrandingService) {}

  @Get(':filename')
  @Unauthenticated()
  async getLogo(@Param('filename') filename: string, @Res() res: Response) {
    const logo = await this.service.getLogo(filename);
    res.setHeader('Content-Type', logo.contentType);
    res.send(logo.body);
  }
}
