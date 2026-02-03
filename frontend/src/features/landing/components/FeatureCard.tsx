import { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-bg-card rounded-xl p-6 border border-border transition-all duration-200 hover:border-primary/30 hover:shadow-lg">
      <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      <p className="text-text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}
