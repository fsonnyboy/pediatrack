import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
}

const TONES = {
  default: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
};

export function StatCard({ label, value, icon: Icon, hint, tone = 'default' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-2 text-3xl font-extrabold leading-none">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2.5', TONES[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
