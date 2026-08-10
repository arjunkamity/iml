import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class StudentGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return !!req.user && req.user.kind === 'student';
  }
}
