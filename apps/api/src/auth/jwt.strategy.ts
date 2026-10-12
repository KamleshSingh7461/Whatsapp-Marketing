import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Every request re-checks the account, so removing someone takes effect at once (not when their 8-hour login token
   * runs out), and a changed role applies straight away. The role always comes from the database, never the token.
   */
  async validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException('Please sign in again');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, role: true } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your access to this workspace has been removed');
    }
    return { userId: payload.sub, role: user.role };
  }
}
