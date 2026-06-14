import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      // Run a simple query to ensure the connection is active and responsive
      await this.$queryRaw`SELECT 1`;
      this.logger.log(
        'Prisma Client: Conexión exitosa a la base de datos PostgreSQL.',
      );
    } catch (error) {
      this.logger.error(
        'Prisma Client: Error al conectar con la base de datos.',
        error,
      );
      throw error;
    }
  }

  cleanDb() {
    if (process.env.NODE_ENV === 'production') return;
    // Auxiliary method for future testing cleanups
  }
}
