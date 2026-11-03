'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AppLayout } from '@/components/app-layout';
import { api } from '@/lib/api';
import { CostingMethod } from '@/types/cogs';
import {
  SystemCostingMethodResponse,
  UpdateCostingMethodResponse,
} from '@/types/settings';
import {
  SunIcon,
  MoonIcon,
  LaptopIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldAlertIcon,
  XIcon,
  RefreshCwIcon,
} from '@/components/icons';

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'password' | 'appearance' | 'system'
  >('profile');

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

  // ─── System Settings State (Costing Method) ──────────────────────────────────
  const [costingSettings, setCostingSettings] =
    useState<SystemCostingMethodResponse | null>(null);
  const [selectedCostingMethod, setSelectedCostingMethod] =
    useState<CostingMethod | null>(null);
  const [isLoadingCostingSettings, setIsLoadingCostingSettings] = useState(false);
  const [isSavingCostingMethod, setIsSavingCostingMethod] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [systemSuccessMessage, setSystemSuccessMessage] = useState<string | null>(
    null,
  );
  const [systemErrorMessage, setSystemErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Support direct deep link via query string (?tab=system)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'system' && user?.role === 'ADMIN') {
        setActiveTab('system');
      }
    }
  }, [user]);

  // Fetch costing method settings when system tab is accessed
  const fetchCostingSettings = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setIsLoadingCostingSettings(true);
    setSystemErrorMessage(null);
    try {
      const data =
        await api.get<SystemCostingMethodResponse>('/settings/costing-method');
      setCostingSettings(data);
      setSelectedCostingMethod(data.activeMethod);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to retrieve active costing method.';
      setSystemErrorMessage(msg);
    } finally {
      setIsLoadingCostingSettings(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'system' && !costingSettings) {
      fetchCostingSettings();
    }
  }, [activeTab, costingSettings, fetchCostingSettings]);

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
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to change password. Verify your current password.';
      setPassError(msg);
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleDeleteAccountClick = () => {
    // Triggers self-deletion barrier protection specified in documentation
    setDeleteWarning(
      'Action Blocked: You cannot delete your own account from this page as required by platform governance rules.',
    );
  };

  // Submit Costing Method Change
  const handleApplyCostingMethod = async () => {
    if (!selectedCostingMethod) return;
    setIsSavingCostingMethod(true);
    setSystemSuccessMessage(null);
    setSystemErrorMessage(null);

    try {
      const res = await api.patch<UpdateCostingMethodResponse>(
        '/settings/costing-method',
        {
          costingMethod: selectedCostingMethod,
        },
      );

      setSystemSuccessMessage(res.message);
      setIsConfirmModalOpen(false);
      // Refresh current settings
      await fetchCostingSettings();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update active costing method.';
      setSystemErrorMessage(msg);
      setIsConfirmModalOpen(false);
    } finally {
      setIsSavingCostingMethod(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AppLayout breadcrumb={activeTab === 'system' ? 'System settings' : 'Profile settings'}>
      <div className="max-w-4xl">
        {/* Page Heading */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal profile, credentials, and platform configurations
          </p>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Left Sub-nav */}
          <nav className="w-full sm:w-48 flex flex-row sm:flex-col gap-1 shrink-0">
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

            {/* System Settings Tab (Restricted strictly to Administrators) */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('system')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                  activeTab === 'system'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                }`}
              >
                <span>System Settings</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Admin
                </span>
              </button>
            )}
          </nav>

          {/* Right Content Panel */}
          <div className="flex-1 max-w-xl">
            {/* Tab 1: Profile */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Profile information
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
                    Update your name and email address
                  </p>

                  {profileSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{profileSuccess}</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
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

                {/* Delete Account Danger Zone */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/80">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Delete account
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-4">
                    Permanently delete your account and all associated resources
                  </p>

                  {deleteWarning && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{deleteWarning}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteAccountClick}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Password */}
            {activeTab === 'password' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Update password
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
                    Ensure your account is using a long, random password to stay secure
                  </p>

                  {passSuccess && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircleIcon className="w-4 h-4 shrink-0" />
                      <span>{passSuccess}</span>
                    </div>
                  )}

                  {passError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
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
                        New password
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

            {/* Tab 4: System Settings (Active Costing Method Switcher) */}
            {activeTab === 'system' && isAdmin && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Corporate Inventory Costing Method
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Defines how outbound sales orders realize Cost of Goods Sold (COGS) and deplete inventory layers
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={fetchCostingSettings}
                      disabled={isLoadingCostingSettings}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <RefreshCwIcon
                        className={`w-3.5 h-3.5 ${
                          isLoadingCostingSettings ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Feedback Notifications */}
                  {systemSuccessMessage && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{systemSuccessMessage}</span>
                    </div>
                  )}

                  {systemErrorMessage && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                      <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{systemErrorMessage}</span>
                    </div>
                  )}

                  {/* Accounting Integrity Banner */}
                  <div className="mt-4 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-3">
                    <ShieldAlertIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold block">Accounting Integrity Rule</span>
                      <p className="text-[11px] leading-relaxed text-blue-600 dark:text-blue-300/90">
                        In accordance with financial compliance standards, historical recorded sales and past COGS entries remain permanently frozen in <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 font-mono text-[10px]">cogs_entries</code>. Switching the active method takes effect immediately on all subsequent checkout transactions.
                      </p>
                    </div>
                  </div>

                  {/* Costing Methods Selection Grid */}
                  <div className="mt-6 space-y-3">
                    {isLoadingCostingSettings && !costingSettings ? (
                      <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                        <span>Loading system configuration...</span>
                      </div>
                    ) : (
                      costingSettings?.availableMethods.map((method) => {
                        const isCurrentActive =
                          costingSettings.activeMethod === method.name;
                        const isSelected = selectedCostingMethod === method.name;

                        return (
                          <div
                            key={method.name}
                            onClick={() => setSelectedCostingMethod(method.name)}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                              isSelected
                                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#0c0d10]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  name="costingMethod"
                                  checked={isSelected}
                                  onChange={() => setSelectedCostingMethod(method.name)}
                                  className="mt-1 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">
                                      {method.displayName}
                                    </h3>
                                    {isCurrentActive && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        Active Standard
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                                    {method.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px]">
                              <span className="text-zinc-600 dark:text-zinc-400">
                                <strong className="text-zinc-700 dark:text-zinc-300">Compliance: </strong>
                                {method.standardsCompliance}
                              </span>
                              <span className="text-amber-700 dark:text-amber-300/90 font-medium">
                                {method.inflationBehavior}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {selectedCostingMethod &&
                      selectedCostingMethod !== costingSettings?.activeMethod ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Pending switch: {costingSettings?.activeMethod} → {selectedCostingMethod}
                        </span>
                      ) : (
                        <span>Currently matching active corporate policy</span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        !selectedCostingMethod ||
                        selectedCostingMethod === costingSettings?.activeMethod ||
                        isSavingCostingMethod
                      }
                      onClick={() => setIsConfirmModalOpen(true)}
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply Costing Method
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {isConfirmModalOpen && selectedCostingMethod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <ShieldAlertIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Confirm Costing Method Switch
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Accounting policy modification
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Transition badges */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-center gap-3 text-xs">
                <div className="text-center">
                  <span className="block text-[10px] text-zinc-400 uppercase">Previous</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {costingSettings?.activeMethod}
                  </span>
                </div>
                <span className="text-zinc-400 font-bold">→</span>
                <div className="text-center">
                  <span className="block text-[10px] text-amber-500 uppercase">New Active</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {selectedCostingMethod}
                  </span>
                </div>
              </div>

              {/* Warning Content */}
              <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2 leading-relaxed">
                <p>
                  You are about to switch the active corporate valuation algorithm. Please acknowledge the following financial consequences:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <li>
                    <strong>Past historical records remain frozen:</strong> Past recorded customer sales, recognized COGS snapshots, and historical reports will not be retroactively modified.
                  </li>
                  <li>
                    <strong>Future checkout realization:</strong> All new customer sales fulfilled from this point forward will calculate and lock COGS under <strong>{selectedCostingMethod}</strong>.
                  </li>
                  <li>
                    <strong>Auditing trail:</strong> This change will be permanently attributed to your administrator account in the audit log.
                  </li>
                </ul>
              </div>

              {/* Dialog Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={isSavingCostingMethod}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCostingMethod}
                  disabled={isSavingCostingMethod}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSavingCostingMethod ? (
                    <>
                      <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <span>Confirm & Apply Change</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
