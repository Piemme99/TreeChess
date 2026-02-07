import { memo } from 'react';

type LoadingSize = 'sm' | 'md' | 'lg';

const spinnerSizes: Record<LoadingSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
}

export const Loading = memo(function Loading({ size = 'md', text }: LoadingProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div
        className={`${spinnerSizes[size]} border-3 border-primary/20 border-t-primary rounded-full animate-spin`}
      />
      {text && <span className="text-text-muted">{text}</span>}
    </div>
  );
});

interface LoadingOverlayProps {
  text?: string;
}

export const LoadingOverlay = memo(function LoadingOverlay({ text = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-white/90 flex items-center justify-center z-[900]">
      <Loading size="lg" text={text} />
    </div>
  );
});
