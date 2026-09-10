import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WhatsappIntegrationService } from './whatsapp-integration.service';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappIntegrationController {
  constructor(private integration: WhatsappIntegrationService) {}

  @Post('connect')
  @Roles(Role.ADMIN)
  connect(@Body() dto: ConnectWhatsappDto) {
    return this.integration.connect(dto);
  }

  @Get('status')
  @Roles(Role.ADMIN, Role.AGENT, Role.MARKETER, Role.VIEWER)
  status() {
    return this.integration.getStatus();
  }

  @Post('send-template')
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  sendTemplate(@Body() body: { to: string; templateName: string; language?: string; components?: any[] }) {
    return this.integration.sendTemplateMessage(body);
  }

  @Post('send-text')
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  sendText(@Body() body: { to: string; text: string }) {
    return this.integration.sendTextMessage(body);
  }
}
