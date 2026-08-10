import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { RoleCode, JwtPayload, RequestWithUser } from './auth.types';

/** Mark a route as not requiring authentication. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict a route to one or more roles. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user (or one of its fields) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? req.user?.[data] : req.user;
  },
);
