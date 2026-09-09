import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WhatsappIntegrationService } from './whatsapp-integration.service';
import { CompleteEmbeddedSignupDto } from './dto/complete-embedded-signup.dto';

@Controller('companies/:companyId/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class WhatsappIntegrationController {
  constructor(private integration: WhatsappIntegrationService) {}

  @Post('connect')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  connect(@Param('companyId') companyId: string, @Body() dto: CompleteEmbeddedSignupDto) {
    return this.integration.completeSignup(companyId, dto);
  }
}
