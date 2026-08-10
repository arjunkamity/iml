import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: JwtPayload }>();
    const header = req.headers['authorization'] ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
