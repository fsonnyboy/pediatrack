'use client';

import { create } from 'zustand';
import type { AuthUser } from '@peditrack/types';
import { authApi } from './queries';

// SEC-001 fix: setToken / clearToken removed — the JWT is now managed
// entirely by the API as an HttpOnly cookie.  The client never sees or stores
// the raw token; it simply calls /auth/me to check session state on load.

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // The API response no longer includes an accessToken — it is set as
      // an HttpOnly cookie by the server.  We only need the user object here.
      const result = await authApi.login(email, password);
      set({ user: result.user, isLoading: false, isInitialized: true });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      // SEC-002 fix: calling the logout endpoint revokes the server-side
      // token (via TokenBlacklistService) and clears the HttpOnly cookie.
      await authApi.logout();
    } catch {
      /* best-effort — the cookie will expire naturally even if this fails */
    }
    set({ user: null, isInitialized: true });
  },

  /** Restores the session on a page refresh using the stored cookie. */
  loadSession: async () => {
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      set({ user, isLoading: false, isInitialized: true });
    } catch {
      set({ user: null, isLoading: false, isInitialized: true });
    }
  },
}));

/** Which roles may perform each sensitive action. */
export const permissions = {
  canPrescribe: (role?: string) => role === 'DOCTOR' || role === 'ADMIN',
  canRecordVitals: (role?: string) => ['DOCTOR', 'NURSE', 'ADMIN'].includes(role ?? ''),
  canAdministerVaccine: (role?: string) => ['DOCTOR', 'NURSE', 'ADMIN'].includes(role ?? ''),
  canManageStaff: (role?: string) => role === 'ADMIN',
  canArchivePatient: (role?: string) => role === 'ADMIN' || role === 'DOCTOR',
  canViewClinicalNotes: (role?: string) => ['DOCTOR', 'NURSE', 'ADMIN'].includes(role ?? ''),
};
