import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async getAllCampaigns() {
    return this.campaignsService.getAllCampaigns();
  }

  @Post()
  async createCampaign(@Body() body: { name: string; templateName: string; targetTags?: string[]; totalRecipients?: number; stats?: any; status?: any }) {
    return this.campaignsService.createCampaign(body);
  }

  @Patch(':id')
  async updateCampaign(@Param('id') id: string, @Body() body: { status?: any; stats?: any }) {
    return this.campaignsService.updateCampaign(id, body);
  }
}
