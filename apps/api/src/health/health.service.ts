import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type DependencyStatus = 'up' | 'down' | 'degraded';

export interface LivenessResponse {
  status: 'ok';
  service: 'api';
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    database: { status: DependencyStatus };
    storage: { status: DependencyStatus };
    email: { status: DependencyStatus; required: boolean };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  getLiveness(): LivenessResponse {
    return { status: 'ok', service: 'api' };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
    ]);
    const emailRequired =
      this.config.get<boolean>('email.requireReal') === true;
    const email = {
      ...this.email.getReadiness(),
      required: emailRequired,
    };

    const ready =
      database.status === 'up' &&
      storage.status === 'up' &&
      (!emailRequired || email.status === 'up');

    return {
      status: ready ? 'ready' : 'not_ready',
      checks: { database, storage, email },
    };
  }

  private async checkDatabase(): Promise<{ status: DependencyStatus }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch {
      this.logger.warn('Readiness check failed for database');
      return { status: 'down' };
    }
  }

  private async checkStorage(): Promise<{ status: DependencyStatus }> {
    try {
      await this.storage.checkReadiness();
      return { status: 'up' };
    } catch {
      this.logger.warn('Readiness check failed for storage');
      return { status: 'down' };
    }
  }
}
