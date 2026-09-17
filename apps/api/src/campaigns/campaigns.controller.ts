import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  async getAllCampaigns() {
    return this.campaignsService.getAllCampaigns();
  }

  @Post()
  @Roles(Role.ADMIN, Role.MARKETER)
  async createCampaign(@Body() body: { name: string; templateName: string; targetTags?: string[]; totalRecipients?: number; stats?: any; status?: any }) {
    return this.campaignsService.createCampaign(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MARKETER)
  async updateCampaign(@Param('id') id: string, @Body() body: { status?: any; stats?: any }) {
    return this.campaignsService.updateCampaign(id, body);
  }
}
