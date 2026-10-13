export type JwtKind = 'admin' | 'student' | 'school' | 'panel';

export interface JwtPayload {
  sub: number;
  kind: JwtKind;
  role?: string;
}
