import { Authenticated } from '../../auth/authorization/authorization-policy';
import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { PlatformS2sRequest } from '../guards/platform-s2s.guard';
import { PlatformS2sGuard } from '../guards/platform-s2s.guard';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformTenantResponseDto } from './dto/platform-tenant-response.dto';

@Authenticated()
@UseGuards(PlatformS2sGuard)
@Controller('platform/admin/v1/tenants')
export class PlatformTenantsController {
  private readonly logger = new Logger(PlatformTenantsController.name);

  constructor(private readonly tenants: PlatformTenantsService) {}

  @Get(':tenantId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Req() request: PlatformS2sRequest,
  ): Promise<PlatformTenantResponseDto> {
    const correlationId = request.platformS2s?.correlationId ?? null;

    try {
      const tenant = await this.tenants.findOne(tenantId);
      this.logCall({ correlationId, tenantId, result: 'SUCCESS' });
      return tenant;
    } catch (error) {
      this.logCall({
        correlationId,
        tenantId,
        result: error instanceof NotFoundException ? 'NOT_FOUND' : 'ERROR',
      });
      throw error;
    }
  }

  private logCall(params: {
    correlationId: string | null;
    tenantId: string;
    result: 'SUCCESS' | 'NOT_FOUND' | 'ERROR';
  }): void {
    this.logger.log(
      JSON.stringify({
        event: 'PLATFORM_S2S_TENANT_READ',
        correlationId: params.correlationId,
        tenantId: params.tenantId,
        result: params.result,
      }),
    );
  }
}
