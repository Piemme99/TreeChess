import { useRef, useState } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

export function TiltCard({ children, className = '' }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(`perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setTransform('')}
      className={`transition-transform duration-300 ease-out ${className}`}
      style={{ transform }}
    >
      {children}
    </div>
  );
}
