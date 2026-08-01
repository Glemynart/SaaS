import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Unauthenticated } from '../auth/authorization/authorization-policy';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @Unauthenticated()
  getHealth() {
    return this.health.getLiveness();
  }

  @Get('readiness')
  @Unauthenticated()
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.getReadiness();
    response.status(
      result.status === 'ready'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return result;
  }
}
