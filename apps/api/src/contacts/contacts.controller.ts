import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { sendJson } from '../common/http/send-json';
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
  async getAllContacts(@Query('since') since: string | undefined, @Req() req: any, @Res() res: any) {
    // With ?since= the answer carries a version, and is just { unchanged: true } when nothing changed since then.
    const data = since !== undefined ? await this.contactsService.getContactsSince(since) : await this.contactsService.getAllContacts();
    return sendJson(req, res, data);
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

  // Edit from the Contacts page: name, cohort, opt-in, and tags added/removed (batch tags and the phone number stay as
  // they are). Same people who can import and add contacts.
  @Patch(':id')
  @Roles(Role.ADMIN, Role.MARKETER)
  async updateContact(
    @Param('id') id: string,
    @Body() body: { displayName?: string; optedIn?: boolean; rfmSegment?: string; addTags?: unknown[]; removeTags?: unknown[] },
  ) {
    return this.contactsService.updateContact(id, body || {});
  }

  @Post('auto-categorize')
  @Roles(Role.ADMIN, Role.MARKETER)
  async autoCategorizeContacts() {
    return this.contactsService.autoCategorizeContacts();
  }
}
