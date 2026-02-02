import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva } from 'class-variance-authority';

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium border-none rounded-md cursor-pointer transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary-dark focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:not-disabled:bg-primary-hover',
        secondary: 'bg-bg-card text-primary border border-primary/30 hover:not-disabled:bg-primary-light hover:not-disabled:border-primary',
        danger: 'bg-danger text-white hover:not-disabled:bg-danger-hover',
        ghost: 'bg-transparent text-text-muted hover:not-disabled:bg-bg hover:not-disabled:text-text',
      },
      size: {
        sm: 'px-2 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${button({ variant, size })} ${loading ? 'relative' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="absolute w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      )}
      <span className={loading ? 'invisible' : ''}>{children}</span>
    </button>
  );
}
