'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { initials, titleCase } from '@peditrack/utils';

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    router.push('/login');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <div className="lg:hidden">
        <p className="text-base font-extrabold tracking-tight">PediTrack</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-none">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{titleCase(user.role)}</p>
            </div>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
