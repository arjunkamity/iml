import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'adminModule';

/** The admin Module Access code a route needs (e.g. 'asm'). Super Admins pass
 * everywhere; anyone else needs that module granted. Enforced by ModuleGuard. */
export const RequireModule = (code: string) => SetMetadata(MODULE_KEY, code);
