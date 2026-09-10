import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { WhatsappIntegrationModule } from './whatsapp-integration/whatsapp-integration.module';
import { TemplatesModule } from './templates/templates.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    WhatsappIntegrationModule,
    TemplatesModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
