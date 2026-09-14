'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  globalRole: 'SUPER_ADMIN' | 'USER';
  mustChangePassword?: boolean;
  farmUsers?: Array<{
    id: string;
    farmId: string;
    role: {
      id: string;
      name: string;
    };
    farm?: {
      id: string;
      name: string;
    };
  }>;
}

interface AuthContextType {
  user: AuthUser | null;
  emulatedUser: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setEmulation: (userId: string | null, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [emulatedUser, setEmulatedUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        setEmulatedUser(data.emulatedUser || null);
      } else {
        setUser(null);
        setEmulatedUser(null);
      }
    } catch {
      setUser(null);
      setEmulatedUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const login = async (email: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Error al iniciar sesión');
    }

    setUser(data.user);
    if (data.user?.mustChangePassword) {
      router.push('/change-password');
    } else {
      router.push('/dashboard');
    }
    router.refresh();
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Error al cambiar la contraseña');
    }

    setUser(data.user);
    router.push('/dashboard');
    router.refresh();
  };

  const setEmulation = async (userId: string | null, redirectTo?: string) => {
    try {
      const res = await fetch('/api/auth/emulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar sesión de emulación');
      }
      if (typeof window !== 'undefined') {
        if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          window.location.reload();
        }
      }
    } catch (err: unknown) {
      console.error('Error toggling emulation:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setEmulatedUser(null);
      router.push('/sign-in');
      router.refresh();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        emulatedUser,
        loading,
        login,
        changePassword,
        setEmulation,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
