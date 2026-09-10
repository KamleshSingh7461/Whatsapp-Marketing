import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (user) return user;
    // Allow development fallback if no auth header is supplied in dev mode
    if (process.env.NODE_ENV !== 'production') {
      return { sub: 'usr_dev', role: 'ADMIN', email: 'superadmin@fgsn.com' };
    }
    return super.handleRequest(err, user, info, context);
  }
}
