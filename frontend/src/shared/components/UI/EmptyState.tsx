import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6 bg-bg-card rounded-lg shadow-sm">
      <div className="text-5xl mb-4 leading-none">{icon}</div>
      <h3 className="text-2xl font-semibold mb-2">{title}</h3>
      {description && <p className="text-text-muted mb-6 max-w-[400px]">{description}</p>}
      {children && <div className="flex gap-2 flex-wrap justify-center">{children}</div>}
    </div>
  );
}
