'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AppLayout } from '@/components/app-layout';
import {
  SunIcon,
  MoonIcon,
  LaptopIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from '@/components/icons';

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'appearance'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  // Delete Account Warning State
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    setIsSavingProfile(true);

    try {
      await updateProfile({ name, email });
      setProfileSuccess('Profile information updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccess(null);
    setPassError(null);

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }

    setIsChangingPass(true);

    try {
      const res = await changePassword(currentPassword, newPassword);
      setPassSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password. Verify your current password.';
      setPassError(msg);
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleDeleteAccountClick = () => {
    // Triggers self-deletion barrier protection specified in documentation
    setDeleteWarning('Action Blocked: You cannot delete your own account from this page as required by platform governance rules.');
  };

  return (
    <AppLayout breadcrumb="Profile settings">
      <div className="max-w-4xl">
        {/* Page Heading matching Screenshot 4 */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your profile and account settings
          </p>
        </div>

        {/* 2-Column Layout matching Screenshot 4 */}
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Left Sub-nav */}
          <nav className="w-full sm:w-44 flex flex-row sm:flex-col gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
              }`}
            >
              Appearance
            </button>
          </nav>

          {/* Right Content Panel */}
          <div className="flex-1 max-w-xl">
            {/* Tab 1: Profile matching Screenshot 4 */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                {/* Profile Information Section */}
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Profile information
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
                    Update your name and email address
                  </p>

                  {profileSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{profileSuccess}</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{profileError}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0d10] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0d10] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-4 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isSavingProfile ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Delete Account Section matching Screenshot 4 */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/80">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Delete account
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-4">
                    Delete your account and all of its resources
                  </p>

                  {deleteWarning && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <span>{deleteWarning}</span>
                    </div>
                  )}

                  {/* Warning Box */}
                  <div className="p-5 rounded-xl bg-red-50/50 dark:bg-[#1a0a0c] border border-red-200 dark:border-[#3b1216] space-y-3">
                    <div className="text-xs font-bold text-red-900 dark:text-white">
                      Warning
                    </div>
                    <p className="text-xs text-red-800 dark:text-zinc-300">
                      Please proceed with caution, this cannot be undone.
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={handleDeleteAccountClick}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                      >
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Password */}
            {activeTab === 'password' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Update password
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
                    Ensure your account is using a long, random password to stay secure.
                  </p>

                  {passSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{passSuccess}</span>
                    </div>
                  )}

                  {passError && (
                    <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{passError}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
                        Current password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0d10] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
                        New password (Min 8 characters)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0d10] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-200 mb-1.5">
                        Confirm password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0d10] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={isChangingPass}
                        className="px-4 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isChangingPass ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Tab 3: Appearance */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Appearance
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
                    Customize the appearance of the app. Automatically switches between day and night themes.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Light Option */}
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'border-black dark:border-white ring-2 ring-black dark:ring-white bg-zinc-50 dark:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <SunIcon className="w-5 h-5 mx-auto mb-2 text-zinc-800 dark:text-zinc-200" />
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                        Light
                      </div>
                    </button>

                    {/* Dark Option */}
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'border-black dark:border-white ring-2 ring-black dark:ring-white bg-zinc-50 dark:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <MoonIcon className="w-5 h-5 mx-auto mb-2 text-zinc-800 dark:text-zinc-200" />
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                        Dark
                      </div>
                    </button>

                    {/* System Option */}
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                        theme === 'system'
                          ? 'border-black dark:border-white ring-2 ring-black dark:ring-white bg-zinc-50 dark:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <LaptopIcon className="w-5 h-5 mx-auto mb-2 text-zinc-800 dark:text-zinc-200" />
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                        System
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
