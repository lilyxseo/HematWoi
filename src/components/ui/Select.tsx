import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full appearance-none rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';
