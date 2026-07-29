import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentResolutionPreviewDto } from './dto/document-resolution-preview.dto';
import { DocumentResolutionService } from './document-resolution.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('document-resolution')
export class DocumentResolutionController {
  constructor(private readonly service: DocumentResolutionService) {}

  @Post('preview')
  preview(@Body() dto: DocumentResolutionPreviewDto) {
    return this.service.preview(dto);
  }

  @Post('confirm')
  confirm(@Body() dto: DocumentResolutionPreviewDto) {
    return this.service.confirm(dto);
  }
}
