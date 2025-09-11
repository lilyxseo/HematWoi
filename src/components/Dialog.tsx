import * as DialogPrimitive from '@radix-ui/react-dialog';
import { PropsWithChildren } from 'react';
import clsx from 'clsx';

export function Dialog({ children }: PropsWithChildren) {
  return <DialogPrimitive.Root>{children}</DialogPrimitive.Root>;
}

export function DialogTrigger({ children }: PropsWithChildren) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>;
}

export function DialogContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  const classes = clsx(
    'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bg-white dark:bg-gray-800 p-6 rounded-2xl shadow',
    className
  );
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40" />
      <DialogPrimitive.Content className={classes}>{children}</DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
