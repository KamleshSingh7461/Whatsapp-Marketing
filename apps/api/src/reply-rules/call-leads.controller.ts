import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CallLeadsService } from './call-leads.service';

// Marketing Manager, Operations Admin (which includes the Super Admin). Support Agents have no access.
@Controller('call-leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MARKETER)
export class CallLeadsController {
  constructor(private readonly callLeads: CallLeadsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.callLeads.overview(days);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.callLeads.history(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.callLeads.update(id, body, user);
  }
}
