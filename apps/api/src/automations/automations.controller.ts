import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  async getAllFlows() {
    return this.automationsService.getAllFlows();
  }

  @Patch(':id/status')
  async updateFlowStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'PAUSED' }) {
    return this.automationsService.updateFlowStatus(id, body.status);
  }
}
