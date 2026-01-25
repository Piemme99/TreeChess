type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
}

export function Loading({ size = 'md', text }: LoadingProps) {
  return (
    <div className={`loading loading-${size}`}>
      <div className="loading-spinner" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
}

interface LoadingOverlayProps {
  text?: string;
}

export function LoadingOverlay({ text = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <Loading size="lg" text={text} />
    </div>
  );
}
