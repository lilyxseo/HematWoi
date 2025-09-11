import { PropsWithChildren } from 'react';
import clsx from 'clsx';

export default function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx('bg-white dark:bg-gray-800 rounded-2xl shadow p-4', className)}>{children}</div>;
}
