'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import { SafeUser, UserRole, PaginatedUsersResponse } from '@/types/auth';
import { api } from '@/lib/api';
import {
  UsersIcon,
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  EditIcon,
  RefreshCwIcon,
  KeyIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from '@/components/icons';

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<SafeUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'SALES' as UserRole,
    isActive: true,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '10');
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (roleFilter !== 'ALL') params.set('role', roleFilter);

        const res = await api.get<PaginatedUsersResponse>(`/users?${params.toString()}`);
        if (!ignore) {
          setUsers(res.data);
          setTotalUsers(res.meta.total);
          setTotalPages(res.meta.totalPages);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch user accounts';
          setErrorMessage(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [page, searchQuery, roleFilter, refreshTrigger]);

  const refreshList = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await api.post('/users', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
      });
      setSuccessMessage(`New operator ${formData.name} provisioned with default password: System@Pass`);
      setIsCreateModalOpen(false);
      setFormData({ name: '', email: '', phone: '', role: 'SALES', isActive: true });
      refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      setErrorMessage(msg);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMessage(null);
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        isActive: formData.isActive,
      });
      setSuccessMessage(`Operator ${formData.name} updated successfully.`);
      setIsEditModalOpen(false);
      setEditingUser(null);
      refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      setErrorMessage(msg);
    }
  };

  const handleDeleteUser = async (userToDelete: SafeUser) => {
    // Client-side barrier pre-warning matching documentation
    if (userToDelete.id === currentUser?.id) {
      setErrorMessage('You cannot delete your own account from this page.');
      return;
    }

    if (!confirm(`Are you sure you want to delete or deactivate ${userToDelete.name}?`)) {
      return;
    }

    setErrorMessage(null);
    try {
      const res = await api.delete<{ message: string }>(`/users/${userToDelete.id}`);
      setSuccessMessage(res.message);
      refreshList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete user';
      setErrorMessage(msg);
    }
  };

  const handleResetPassword = async (userToReset: SafeUser) => {
    if (!confirm(`Reset password for ${userToReset.name} to standard default "System@Pass"?`)) {
      return;
    }

    setErrorMessage(null);
    try {
      const res = await api.post<{ message: string }>(`/users/${userToReset.id}/reset-password`);
      setSuccessMessage(res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      setErrorMessage(msg);
    }
  };

  const openEditModal = (u: SafeUser) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
    });
    setIsEditModalOpen(true);
  };

  const roleBadgeStyles: Record<UserRole, string> = {
    ADMIN: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    SALES: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    AUDITOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  };

  return (
    <AppLayout breadcrumb="Users" allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UsersIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                User Administration & RBAC
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Provision new operator accounts, assign security roles, and enforce safety barriers.
            </p>
          </div>

          <button
            onClick={() => {
              setFormData({ name: '', email: '', phone: '', role: 'SALES', isActive: true });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-sm font-semibold shadow-sm transition-all cursor-pointer self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Provision Operator</span>
          </button>
        </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircleIcon className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-sm">
              <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
              <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
                ✕
              </button>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              {['ALL', 'ADMIN', 'SALES', 'AUDITOR'].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRoleFilter(r);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Operator</th>
                    <th className="py-4 px-6">Contact Phone</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Created Date</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCwIcon className="w-4 h-4 animate-spin text-zinc-500" />
                          <span>Loading operators...</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400">
                        No operators found matching query.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                {u.name}
                                {isSelf && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                                    You
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{u.email}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                            {u.phone}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${roleBadgeStyles[u.role]}`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {u.isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                Deactivated
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(u)}
                                title="Edit operator"
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <EditIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResetPassword(u)}
                                title="Reset to default password (System@Pass)"
                                className="p-1.5 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <KeyIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title={isSelf ? 'Cannot delete your own account' : 'Delete or deactivate'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isSelf
                                    ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                                    : 'text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10'
                                }`}
                              >
                                <Trash2Icon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <div>
                  Showing {users.length} of {totalUsers} total operators
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* Modal: Create Operator */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Provision New Operator</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <div className="font-semibold mb-0.5 text-zinc-900 dark:text-white">Default Credential Provisioning:</div>
                The account will be initialized with temporary password <code className="font-mono bg-white dark:bg-black px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-900 dark:text-white">System@Pass</code>.
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Operator Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dawit Gebre"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="operator@company.com"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+251911000000"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  >
                    <option value="SALES">SALES - Operational Trading (Purchases & Sales)</option>
                    <option value="AUDITOR">AUDITOR - Read-Only Audits & COGS</option>
                    <option value="ADMIN">ADMIN - Full Governance & Configuration</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium cursor-pointer text-sm shadow-xs"
                  >
                    Provision Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Operator */}
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Edit Operator Profile</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Operator Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 disabled:opacity-50"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="SALES">SALES</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                  {editingUser.id === currentUser?.id && (
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Protected: You cannot alter your own admin role.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black"
                  />
                  <label htmlFor="isActive" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Account Status Active
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium cursor-pointer text-sm shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
