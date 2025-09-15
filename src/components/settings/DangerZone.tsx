import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function DangerZone({ children }: Props) {
  return <div className="mt-2 border-t border-red-300 pt-2 space-y-2">{children}</div>;
}
