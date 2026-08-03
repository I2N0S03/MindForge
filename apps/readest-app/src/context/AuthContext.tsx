'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';

/**
 * No-op stub. This fork has no account system (Supabase auth was removed
 * along with the rest of the Readest Cloud backend), so `user`/`token` are
 * permanently null and `login`/`logout`/`refresh` are no-ops. Kept so any
 * remaining `useAuth()` call site — every one of them already treats
 * "signed out" as a normal, fully-supported state — doesn't need a
 * separate code path.
 */
interface AuthContextType {
  token: string | null;
  user: null;
  login: () => void;
  logout: () => void;
  refresh: () => void;
}

const noop = () => {};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo<AuthContextType>(
    () => ({ token: null, user: null, login: noop, logout: noop, refresh: noop }),
    [],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
