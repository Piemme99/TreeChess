interface ColorDotProps {
  color: 'white' | 'black';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-8 h-8',
} as const;

export function ColorDot({ color, size = 'md', className = '' }: ColorDotProps) {
  const isWhite = color === 'white';
  return (
    <span
      className={`inline-block rounded-full border ${
        isWhite
          ? 'bg-white border-gray-400'
          : 'bg-gray-800 border-gray-800'
      } ${sizeClasses[size]} ${className}`}
      aria-label={isWhite ? 'White' : 'Black'}
    />
  );
}
