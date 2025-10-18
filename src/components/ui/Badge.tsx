import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700'
};

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) => {
  const { variant = 'default', ...rest } = props as { variant?: BadgeVariant };
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', variantStyles[variant], className)}
      {...rest}
    />
  );
};
