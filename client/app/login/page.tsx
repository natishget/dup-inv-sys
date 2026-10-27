'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { IsometricCubeLogo, SunIcon, MoonIcon, AlertCircleIcon } from '@/components/icons';

export default function LoginPage() {
  const { user, login, isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials or connection error';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 bg-white dark:bg-[#070708] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 relative">
      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {resolvedTheme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="w-full max-w-[360px] flex flex-col items-center">
        {/* Cube Logo */}
        <div className="mb-6 text-zinc-900 dark:text-zinc-100">
          <IsometricCubeLogo className="w-10 h-10" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold tracking-tight text-center text-zinc-900 dark:text-zinc-100">
          Log in to your account
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-1.5 mb-6">
          Enter your email and password below to log in
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-800 bg-[#f4f7fd] dark:bg-[#0c0d10] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                Password
              </label>
              <button
                type="button"
                onClick={() =>
                  alert(
                    'Password reset requests are handled by your system administrator. Contact admin to reset your credentials.',
                  )
                }
                className="text-xs text-zinc-900 dark:text-zinc-300 hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-800 bg-[#f4f7fd] dark:bg-[#0c0d10] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-black dark:text-white focus:ring-black dark:focus:ring-white dark:bg-[#0c0d10]"
            />
            <label
              htmlFor="remember"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
            >
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white dark:text-black bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm mt-2"
          >
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {/* Footer Text */}
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-5">
          Account access is managed by your system administrator.
        </p>
      </div>
    </div>
  );
}
