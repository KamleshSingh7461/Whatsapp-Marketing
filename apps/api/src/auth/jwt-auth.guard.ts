import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Lets a request through only with a valid login token of an ACTIVE account (see JwtStrategy). Anything else gets 401,
 * and the web app then shows the login screen. There is deliberately no fallback user: treating a failed login as an
 * admin would let anyone use the API without signing in.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any, _context: ExecutionContext) {
    if (err) throw err instanceof UnauthorizedException ? err : new UnauthorizedException('Please sign in again');
    if (!user) throw new UnauthorizedException('Please sign in again');
    return user;
  }
}
