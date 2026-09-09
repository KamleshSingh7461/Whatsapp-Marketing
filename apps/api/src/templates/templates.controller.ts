import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Controller('companies/:companyId/templates')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.MARKETER)
  create(@Param('companyId') companyId: string, @Body() dto: CreateTemplateDto) {
    return this.templates.create(companyId, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.MARKETER, Role.AGENT, Role.VIEWER)
  findAll(@Param('companyId') companyId: string) {
    return this.templates.findAllForCompany(companyId);
  }
}
