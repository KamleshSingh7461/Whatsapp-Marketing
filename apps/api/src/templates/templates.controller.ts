import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MARKETER)
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT, Role.VIEWER)
  findAll() {
    return this.templates.findAll();
  }
}
