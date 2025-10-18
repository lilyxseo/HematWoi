import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6',
        className
      )}
      {...props}
    />
  );
};
