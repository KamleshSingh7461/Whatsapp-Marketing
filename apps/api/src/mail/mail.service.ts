import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendInviteEmailDto {
  to: string;
  inviterName: string;
  role: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`SMTP Mail Transporter configured for host: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP credentials not fully configured in .env. Falling back to simulated email delivery.');
    }
  }

  async sendInviteEmail(dto: SendInviteEmailDto): Promise<{ sent: boolean; message: string; inviteLink: string }> {
    const appUrl = process.env.APP_URL || 'https://erp.fgsnlive.com';
    const inviteLink = `${appUrl}/#invite?token=${dto.token}`;
    const fromAddress = process.env.SMTP_FROM || 'FGSN Enterprise ERP <noreply@fgsnlive.com>';

    const roleName = dto.role === 'ADMIN' 
      ? 'Operations Administrator' 
      : dto.role === 'MARKETER' 
      ? 'Growth & Marketing Lead' 
      : dto.role === 'AGENT' 
      ? 'Customer Support Agent' 
      : 'Workspace Viewer';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FGSN Workspace Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: #059669; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
              Freedom Global Sports Network
            </h1>
            <p style="color: #d1fae5; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
              WhatsApp Enterprise ERP & Operations Desk
            </p>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px 28px;">
            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0;">
              You've been invited to join FGSN Enterprise ERP
            </h2>
            
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
              <strong>${dto.inviterName}</strong> has invited you to join the official <strong>FGSN WhatsApp ERP</strong> workspace with the <strong>${roleName}</strong> role.
            </p>

            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 26px; border: 1px solid #cbd5e1;">
              <div style="font-size: 12px; color: #64748B; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Assigned Role</div>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${roleName} (${dto.role})</div>
              <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Recipient: ${dto.to}</div>
            </div>

            <!-- Call to Action Button -->
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${inviteLink}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                Accept Invitation & Set Password
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 10px 0;">
              If the button above does not work, copy and paste this link into your web browser:
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 11px; color: #334155; margin-bottom: 20px;">
              ${inviteLink}
            </div>

            <p style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin: 0;">
              This invitation link is valid for 7 days. If you did not expect this invitation, you can safely ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b;">
            © ${new Date().getFullYear()} Freedom Global Sports Network (FGSN). All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: dto.to,
          subject: `Invitation to join FGSN WhatsApp ERP - ${roleName}`,
          html: htmlContent,
        });
        this.logger.log(`Invitation email successfully sent to ${dto.to}`);
        return {
          sent: true,
          message: `Invitation email sent directly to ${dto.to}`,
          inviteLink,
        };
      } catch (err: any) {
        this.logger.error(`Failed to send email to ${dto.to}: ${err.message}`);
        return {
          sent: false,
          message: `Could not send via SMTP (${err.message}). Invitation link generated.`,
          inviteLink,
        };
      }
    } else {
      this.logger.log(`[SIMULATED EMAIL] To: ${dto.to} | Link: ${inviteLink}`);
      return {
        sent: true,
        message: `Invitation created for ${dto.to}. (SMTP not configured in .env, link available below)`,
        inviteLink,
      };
    }
  }
}
