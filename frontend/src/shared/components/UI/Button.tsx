import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva } from 'class-variance-authority';

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium border-none rounded-xl cursor-pointer transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-primary to-primary-hover text-white shadow-md shadow-primary/20 hover:not-disabled:shadow-lg hover:not-disabled:shadow-primary/30',
        secondary: 'bg-bg-card text-primary border border-primary/30 hover:not-disabled:bg-primary-light hover:not-disabled:border-primary',
        danger: 'bg-danger text-white hover:not-disabled:bg-danger-hover',
        ghost: 'bg-transparent text-text-muted hover:not-disabled:bg-primary-light/50 hover:not-disabled:text-text',
      },
      size: {
        sm: 'px-2 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-7 py-3.5 text-lg',
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

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
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
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={isDisabled ? undefined : {
        scale: 1.04,
        ...(variant === 'primary' ? { boxShadow: '0 20px 40px -12px rgba(230, 126, 34, 0.3)' } : {}),
      }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      className={`${button({ variant, size })} ${loading ? 'relative' : ''} ${className}`.trim()}
      disabled={isDisabled}
      {...props as Omit<HTMLMotionProps<"button">, "ref">}
    >
      {loading && (
        <span className="absolute w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      )}
      <span className={loading ? 'invisible' : ''}>{children}</span>
    </motion.button>
  );
}
