'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Calendar, LayoutDashboard, Pill, Settings, Syringe, Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore, permissions } from '@/lib/auth-store';

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/patients',      label: 'Patients',     icon: Users },
  { href: '/appointments',  label: 'Appointments', icon: Calendar },
  { href: '/vaccinations',  label: 'Vaccinations', icon: Syringe },
  { href: '/prescriptions', label: 'Prescriptions', icon: Pill },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-base font-extrabold leading-none tracking-tight">PediTrack</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Clinic Portal
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}

        {permissions.canManageStaff(user?.role) && (
          <>
            <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Admin
            </div>
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden />
              Settings
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
