import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface FeatureScreenshotProps {
  src: string;
  alt: string;
}

export function FeatureScreenshot({ src, alt }: FeatureScreenshotProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-primary-light shadow-sm h-full min-h-[380px] flex flex-col items-center justify-center gap-3 text-text-muted">
        <ImageOff size={32} className="text-primary/30" />
        <span className="text-sm">Screenshot coming soon</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-primary-light shadow-sm overflow-hidden h-full">
      <img
        src={src}
        alt={alt}
        className="w-full h-auto"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
}
