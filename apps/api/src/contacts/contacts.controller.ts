import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getAllContacts() {
    return this.contactsService.getAllContacts();
  }

  @Post()
  async saveContact(@Body() body: { phone: string; displayName?: string; tags?: string[]; optedIn?: boolean }) {
    return this.contactsService.saveContact(body);
  }

  @Post('bulk')
  async bulkSaveContacts(@Body() body: { contacts: Array<{ phone: string; displayName?: string; tags?: string[] }> }) {
    return this.contactsService.bulkSaveContacts(body.contacts || []);
  }

  @Post('auto-categorize')
  async autoCategorizeContacts() {
    return this.contactsService.autoCategorizeContacts();
  }
}
