import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully.');
    } catch (error) {
      this.logger.warn(
        `Could not connect to PostgreSQL database at ${process.env.DATABASE_URL}. Ensure PostgreSQL is running and credentials are correct. (Error: ${error instanceof Error ? error.message : String(error)})`
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
