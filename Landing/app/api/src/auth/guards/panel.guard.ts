import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

// Only a signed-in panelist. Admin, student and school sessions are refused here, and a panel
// session is refused by their guards (they all check the session kind).
@Injectable()
export class PanelGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return !!req.user && req.user.kind === 'panel';
  }
}
