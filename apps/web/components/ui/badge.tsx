import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        accent: 'bg-accent/10 text-accent',
        success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        danger: 'bg-destructive/10 text-destructive',
        neutral: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Maps an appointment status to a badge colour and readable label. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    PENDING:     { variant: 'warning', label: 'Pending' },
    CONFIRMED:   { variant: 'default', label: 'Confirmed' },
    IN_PROGRESS: { variant: 'accent',  label: 'In progress' },
    COMPLETED:   { variant: 'success', label: 'Completed' },
    CANCELLED:   { variant: 'neutral', label: 'Cancelled' },
    NO_SHOW:     { variant: 'danger',  label: 'No show' },
    ACTIVE:      { variant: 'success', label: 'Active' },
  };

  const config = map[status] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export { badgeVariants };
