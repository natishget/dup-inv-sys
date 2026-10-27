'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeUser, AuthResponse, RefreshResponse } from '@/types/auth';
import { api, setAccessToken, refreshAccessToken, setOnAuthFailure } from '@/lib/api';

interface AuthContextType {
  user: SafeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<SafeUser>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; phone?: string }) => Promise<SafeUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ message: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    let ignore = false;

    setOnAuthFailure(() => {
      if (!ignore) {
        setUser(null);
        setIsLoading(false);
      }
    });

    async function restore() {
      try {
        const token = await refreshAccessToken();
        if (!ignore) {
          if (token) {
            const me = await api.get<SafeUser>('/auth/me');
            if (!ignore) {
              setUser(me);
            }
          } else {
            setUser(null);
            setAccessToken(null);
          }
        }
      } catch {
        if (!ignore) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    restore();

    return () => {
      ignore = true;
      setOnAuthFailure(null);
    };
  }, []);

  const login = async (email: string, password: string): Promise<SafeUser> => {
    setIsLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password }, { retryOn401: false });
      setAccessToken(res.accessToken);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {}, { retryOn401: false });
    } catch {
      // Ignore logout errors and clear state
    } finally {
      setAccessToken(null);
      setUser(null);
      router.replace('/login');
    }
  };

  const updateProfile = async (data: { name?: string; email?: string; phone?: string }): Promise<SafeUser> => {
    const updated = await api.patch<SafeUser>('/auth/profile', data);
    setUser(updated);
    return updated;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    // Password change clears refresh tokens, user will re-authenticate if session ends
    return res;
  };

  const refreshUser = async () => {
    try {
      const me = await api.get<SafeUser>('/auth/me');
      setUser(me);
    } catch {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateProfile,
        changePassword,
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
