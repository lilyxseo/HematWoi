import { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

export default function SettingsGroup({ title, children }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold" id={title.replace(/\s+/g, '-')}>{title}</h2>
      <div className="space-y-2" aria-labelledby={title.replace(/\s+/g, '-')}>{children}</div>
    </section>
  );
}
