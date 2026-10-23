import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WhatsappIntegrationService } from './whatsapp-integration.service';
import { ConnectWhatsappDto } from './dto/connect-whatsapp.dto';
import { sendJson } from '../common/http/send-json';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappIntegrationController {
  constructor(private integration: WhatsappIntegrationService) {}

  @Post('connect')
  @Roles(Role.ADMIN)
  connect(@Body() dto: ConnectWhatsappDto) {
    return this.integration.connect(dto);
  }

  @Get('status')
  @Roles(Role.ADMIN, Role.AGENT, Role.MARKETER, Role.VIEWER)
  status() {
    return this.integration.getStatus();
  }

  @Get('ledger')
  @Roles(Role.ADMIN, Role.AGENT, Role.MARKETER, Role.VIEWER)
  async ledger(@Query('since') since: string | undefined, @Req() req: any, @Res() res: any) {
    return sendJson(req, res, await this.integration.getLiveMessagingLedger(since));
  }

  @Get('insights')
  @Roles(Role.ADMIN, Role.MARKETER, Role.VIEWER)
  insights(@Query('days') days?: string) {
    return this.integration.getMetaInsights(days);
  }

  @Post('send-template')
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  sendTemplate(@Body() body: { to: string; templateName: string; language?: string; components?: any[] }) {
    return this.integration.sendTemplateMessage(body);
  }

  @Post('send-text')
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  sendText(@Body() body: { to: string; text: string }) {
    return this.integration.sendTextMessage(body);
  }

  @Post('send-media')
  @Roles(Role.ADMIN, Role.MARKETER, Role.AGENT)
  sendMedia(@Body() body: { to: string; dataUrl: string; fileName?: string; caption?: string }) {
    return this.integration.sendMediaMessage(body);
  }
}

@Controller('whatsapp/media')
export class WhatsappMediaController {
  constructor(private integration: WhatsappIntegrationService) {}

  @Get(':mediaId')
  async getMedia(@Param('mediaId') mediaId: string, @Headers('range') range: string | undefined, @Res() res: any) {
    try {
      const media = await this.integration.getMediaStream(mediaId);
      const total = media.buffer.length;
      res.setHeader('Content-Type', media.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      // Byte ranges let the browser seek audio and video, and read the length of OGG voice notes.
      res.setHeader('Accept-Ranges', 'bytes');
      const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
      if (match && (match[1] || match[2])) {
        let start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
        let end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`);
          return res.end();
        }
        start = Math.max(0, start);
        end = Math.max(start, end);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(end - start + 1));
        return res.end(media.buffer.subarray(start, end + 1));
      }
      res.setHeader('Content-Length', String(total));
      res.end(media.buffer);
    } catch (e: any) {
      res.status(404).send({ error: e.message || 'Media not found' });
    }
  }
}
