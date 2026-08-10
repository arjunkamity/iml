export type JwtKind = 'admin' | 'student';

export interface JwtPayload {
  sub: number;
  kind: JwtKind;
  role?: string;
}
