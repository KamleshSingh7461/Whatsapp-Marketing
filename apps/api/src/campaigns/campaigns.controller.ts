import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { LaunchCampaignDto } from './dto/launch-campaign.dto';
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

  // Legacy (browser-sent) create/update. Kept so nothing changes until server sending is switched on.
  @Post()
  @Roles(Role.ADMIN, Role.MARKETER)
  async createCampaign(@Body() body: { name: string; templateName: string; targetTags?: string[]; totalRecipients?: number; stats?: any; status?: any }) {
    return this.campaignsService.createCampaign(body);
  }

  // ---- server-side sending. Static routes first so they are never captured by ':id'. ----

  @Get('server-send')
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  serverSend() {
    return this.campaignsService.serverSendEnabled;
  }

  @Post('launch')
  @Roles(Role.ADMIN, Role.MARKETER)
  launch(@Body() dto: LaunchCampaignDto) {
    return this.campaignsService.launch(dto);
  }

  @Get(':id/progress')
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  progress(@Param('id') id: string) {
    return this.campaignsService.getProgress(id);
  }

  @Get(':id/recipients')
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  recipients(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.campaignsService.getRecipients(id, { status, limit: Number(limit), offset: Number(offset) });
  }

  @Post(':id/pause')
  @Roles(Role.ADMIN, Role.MARKETER)
  pause(@Param('id') id: string) {
    return this.campaignsService.pause(id);
  }

  @Post(':id/resume')
  @Roles(Role.ADMIN, Role.MARKETER)
  resume(@Param('id') id: string) {
    return this.campaignsService.resume(id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.MARKETER)
  cancel(@Param('id') id: string) {
    return this.campaignsService.cancel(id);
  }

  @Post(':id/retry-failed')
  @Roles(Role.ADMIN, Role.MARKETER)
  retryFailed(@Param('id') id: string) {
    return this.campaignsService.retryFailed(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MARKETER)
  async updateCampaign(@Param('id') id: string, @Body() body: { status?: any; stats?: any }) {
    return this.campaignsService.updateCampaign(id, body);
  }
}
