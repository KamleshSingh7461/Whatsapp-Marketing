import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.companies.findAll();
  }

  @Get(':companyId')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.AGENT, Role.MARKETER, Role.VIEWER)
  findOne(@Param('companyId') companyId: string) {
    return this.companies.findOne(companyId);
  }
}
