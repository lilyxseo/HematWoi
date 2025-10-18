import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
