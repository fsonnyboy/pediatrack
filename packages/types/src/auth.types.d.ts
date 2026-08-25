export type UserRole = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'PARENT';
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    specialty?: string | null;
    licenseNumber?: string | null;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    accessToken: string;
    expiresIn: number;
    user: AuthUser;
}
export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
