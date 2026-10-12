import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CallLeadsService } from './call-leads.service';

// Support Agents work the call sheets (view, update status and remarks; every change is logged with who made it).
// Team activity, the managers' overview of everyone's updates, stays with Marketing Manager and Operations Admin
// (which includes the Super Admin).
@Controller('call-leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
export class CallLeadsController {
  constructor(private readonly callLeads: CallLeadsService) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.MARKETER)
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
