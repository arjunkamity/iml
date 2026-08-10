export type RoleCode = 'ADMIN' | 'COORDINATOR' | 'STUDENT';

export interface JwtPayload {
  sub: number;          // UserId
  role: RoleCode;
  schoolId: number | null;
  name: string;
}

export interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: JwtPayload;
}
