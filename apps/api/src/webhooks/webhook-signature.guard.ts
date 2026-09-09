import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body,
 * per §02 of the plan: this MUST run against raw bytes, before any JSON
 * parsing, and MUST use a timing-safe comparison.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
    const rawBody: Buffer | undefined = request.rawBody;

    if (!signatureHeader || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const appSecret = this.config.getOrThrow<string>('META_APP_SECRET');
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace('sha256=', '');

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');

    const valid =
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);

    if (!valid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return true;
  }
}
