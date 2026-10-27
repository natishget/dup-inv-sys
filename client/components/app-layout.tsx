'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AuthGuard } from '@/components/auth-guard';
import {
  StockManagementBrandLogo,
  LayoutGridIcon,
  PackageIcon,
  UsersIcon,
  WarehouseIcon,
  PurchasesIcon,
  ShoppingCartIcon,
  BarChart3Icon,
  SidebarTriggerIcon,
  ChevronsUpDownIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  LogOutIcon,
  XIcon,
} from '@/components/icons';

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string;
  allowedRoles?: ('ADMIN' | 'SALES' | 'AUDITOR')[];
}

function AppLayoutContent({
  children,
  breadcrumb = 'Dashboard',
}: {
  children: React.ReactNode;
  breadcrumb?: string;
}) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Initialize desktop collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setIsMobileOpen((prev) => !prev);
        } else {
          setIsCollapsed((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('sidebar_collapsed', String(next));
            } catch {}
            return next;
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (!user) return null;

  // Compute initials (e.g., Natnael Getachew -> NG)
  const initials =
    user.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OP';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutGridIcon },
    { name: 'Products', href: '/products', icon: PackageIcon },
    ...(user.role === 'ADMIN'
      ? [{ name: 'Users', href: '/users', icon: UsersIcon }]
      : []),
    { name: 'Warehouses', href: '/warehouses', icon: WarehouseIcon },
    { name: 'Purchases', href: '/purchases', icon: PurchasesIcon },
    { name: 'Sales', href: '/sales', icon: ShoppingCartIcon },
    { name: 'COGS', href: '/cogs', icon: BarChart3Icon },
  ];

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-[#070708] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col justify-between bg-white dark:bg-[#0a0a0c] border-r border-zinc-200 dark:border-zinc-800/80 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header & Close Button */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-100 dark:border-zinc-900/60">
            <div className="flex items-center gap-2.5">
              <StockManagementBrandLogo className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                Stock Management
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav List */}
          <div className="px-3 py-4">
            <div className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Platform
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Bottom User Profile Section */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-900/80 relative">
          <button
            onClick={() => setIsMobileUserMenuOpen(!isMobileUserMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-zinc-400 truncate font-mono">
                  {user.role}
                </div>
              </div>
            </div>
            <ChevronsUpDownIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          {/* Popup Menu */}
          {isMobileUserMenuOpen && (
            <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  {user.email}
                </div>
              </div>

              <Link
                href="/settings"
                onClick={() => {
                  setIsMobileUserMenuOpen(false);
                  setIsMobileOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Profile settings</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                  setIsMobileUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
              >
                {resolvedTheme === 'dark' ? (
                  <>
                    <SunIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Switch to Light Mode</span>
                  </>
                ) : (
                  <>
                    <MoonIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Switch to Dark Mode</span>
                  </>
                )}
              </button>

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

              <button
                type="button"
                onClick={() => {
                  setIsMobileUserMenuOpen(false);
                  setIsMobileOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Desktop Left Sidebar (Collapsible) */}
      <aside
        className={`hidden md:flex flex-col justify-between border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0c] z-20 shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed
            ? 'w-0 opacity-0 -translate-x-full border-r-0 pointer-events-none'
            : 'w-60 opacity-100 translate-x-0'
        }`}
      >
        <div className="w-60 h-full flex flex-col justify-between shrink-0">
          <div>
            {/* Brand Header */}
            <div className="h-14 flex items-center gap-2.5 px-4 border-b border-zinc-100 dark:border-zinc-900/60">
              <StockManagementBrandLogo className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                Stock Management
              </span>
            </div>

            {/* Nav List */}
            <div className="px-3 py-4">
              <div className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Platform
              </div>
              <nav className="space-y-0.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom User Profile Section */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-900/80 relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {user.role}
                  </div>
                </div>
              </div>
              <ChevronsUpDownIcon className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* Popup Menu */}
            {isUserMenuOpen && (
              <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">
                    {user.email}
                  </div>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile settings</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  {resolvedTheme === 'dark' ? (
                    <>
                      <SunIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Switch to Light Mode</span>
                    </>
                  ) : (
                    <>
                      <MoonIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Switch to Dark Mode</span>
                    </>
                  )}
                </button>

                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                >
                  <LogOutIcon className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-medium min-w-0">
            {/* Sidebar Collapse / Expand Toggle Button */}
            <button
              type="button"
              id="sidebar-toggle-btn"
              onClick={handleToggleSidebar}
              className="p-2 -ml-1 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              title={
                isCollapsed
                  ? 'Open side navigation bar (⌘B)'
                  : 'Collapse side navigation bar (⌘B)'
              }
              aria-label={
                isCollapsed ? 'Open side navigation' : 'Collapse side navigation'
              }
            >
              <SidebarTriggerIcon className="w-4 h-4" />
            </button>

            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>

            <span className="font-semibold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 truncate">
              {breadcrumb}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {resolvedTheme === 'dark' ? (
                <SunIcon className="w-4 h-4 text-amber-400" />
              ) : (
                <MoonIcon className="w-4 h-4 text-zinc-600" />
              )}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppLayout({
  children,
  breadcrumb = 'Dashboard',
  allowedRoles,
}: AppLayoutProps) {
  return (
    <AuthGuard allowedRoles={allowedRoles}>
      <AppLayoutContent breadcrumb={breadcrumb}>
        {children}
      </AppLayoutContent>
    </AuthGuard>
  );
}
