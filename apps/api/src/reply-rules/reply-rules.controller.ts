import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReplyRulesService } from './reply-rules.service';

// Same people who can open the Automations page.
@Controller('reply-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MARKETER)
export class ReplyRulesController {
  constructor(private readonly rules: ReplyRulesService) {}

  @Get()
  list() {
    return this.rules.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.rules.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.rules.update(id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.rules.remove(id);
  }

  @Get(':id/leads')
  leads(@Param('id') id: string, @Query('from') from?: string) {
    return this.rules.leads(id, from);
  }
}
