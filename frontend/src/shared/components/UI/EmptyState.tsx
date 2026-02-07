import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center text-center py-12 px-6 bg-bg-card rounded-2xl shadow-sm border border-primary/10"
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-light to-primary/10 flex items-center justify-center mb-4">
        <span className="text-4xl leading-none">{icon}</span>
      </div>
      <h3 className="text-2xl font-semibold font-display mb-2">{title}</h3>
      {description && <p className="text-text-muted mb-6 max-w-[400px]">{description}</p>}
      {children && <div className="flex gap-2 flex-wrap justify-center">{children}</div>}
    </motion.div>
  );
}
