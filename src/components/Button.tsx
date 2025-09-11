import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export default function Button({ variant = 'primary', className, ...props }: Props) {
  const base = 'px-4 py-2 rounded-2xl font-medium focus:outline-none';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100'
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
