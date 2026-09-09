import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Blocks a non-super-admin from acting on a company other than their own.
 * Applied on routes that take a :companyId param. This is deliberately a
 * hard 403, not a soft filter — see §11 of the plan: cross-tenant access
 * must be structurally impossible, not just permission-checked in a query.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const routeCompanyId = request.params?.companyId;

    if (!user) return false;
    if (user.role === Role.SUPER_ADMIN) return true;
    if (!routeCompanyId) return true; // route isn't company-scoped
    if (user.companyId !== routeCompanyId) {
      throw new ForbiddenException('Not authorized for this company');
    }
    return true;
  }
}
