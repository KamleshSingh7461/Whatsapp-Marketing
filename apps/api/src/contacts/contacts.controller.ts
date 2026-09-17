import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT, Role.VIEWER)
  async getAllContacts() {
    return this.contactsService.getAllContacts();
  }

  @Post()
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  async saveContact(@Body() body: { phone: string; displayName?: string; tags?: string[]; optedIn?: boolean }) {
    return this.contactsService.saveContact(body);
  }

  @Post('bulk')
  @Roles(Role.ADMIN, Role.MARKETER)
  async bulkSaveContacts(@Body() body: { contacts: Array<{ phone: string; displayName?: string; tags?: string[] }> }) {
    return this.contactsService.bulkSaveContacts(body.contacts || []);
  }

  @Post('auto-categorize')
  @Roles(Role.ADMIN, Role.MARKETER)
  async autoCategorizeContacts() {
    return this.contactsService.autoCategorizeContacts();
  }
}
