import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MODULE_KEY } from '../decorators/require-module.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

// The sidebar already hides modules an admin has no access to, but until now
// nothing stopped them calling the API directly. Routes opt in with
// @RequireModule(code); the grant is read from the database on every call so
// revoking a module takes effect immediately, not at token expiry.
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const code = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!code) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user || user.kind !== 'admin') throw new ForbiddenException('Admin access required');
    if (user.role === 'Super Admin' || user.role === 'SUPER_ADMIN') return true;
    // a route may name several codes ("sc,rl"): holding any one of them is enough
    const grant = await this.prisma.adminModule.findFirst({
      where: { adminId: user.sub, moduleCode: { in: code.split(',').map((c) => c.trim()) } },
      select: { adminId: true },
    });
    if (!grant) throw new ForbiddenException('You do not have access to this module.');
    return true;
  }
}
