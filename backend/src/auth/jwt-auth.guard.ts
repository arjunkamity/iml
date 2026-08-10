import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from './decorators';
import type { JwtPayload, RequestWithUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      req.user = this.jwt.verify<JwtPayload>(auth.slice(7), {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
