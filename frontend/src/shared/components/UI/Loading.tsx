import { memo } from 'react';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
}

export const Loading = memo(function Loading({ size = 'md', text }: LoadingProps) {
  return (
    <div className={`loading loading-${size}`}>
      <div className="loading-spinner" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
});

interface LoadingOverlayProps {
  text?: string;
}

export const LoadingOverlay = memo(function LoadingOverlay({ text = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <Loading size="lg" text={text} />
    </div>
  );
});
