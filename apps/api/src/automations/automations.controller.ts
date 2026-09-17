import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('automations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  async getAllFlows() {
    return this.automationsService.getAllFlows();
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MARKETER)
  async updateFlowStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'PAUSED' }) {
    return this.automationsService.updateFlowStatus(id, body.status);
  }
}
