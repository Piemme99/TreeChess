import { ReactNode, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { Button } from './Button';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const modal = cva(
  'bg-bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col w-full animate-fade-in',
  {
    variants: {
      size: {
        sm: 'max-w-[400px]',
        md: 'max-w-[600px]',
        lg: 'max-w-[800px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    // Make the rest of the app inert (blocks AT, pointer, and focus) while the
    // modal is open. The modal itself is portaled to <body>, so it stays
    // interactive.
    const appRoot = document.getElementById('root');
    appRoot?.setAttribute('inert', '');

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
      appRoot?.removeAttribute('inert');
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={modal({ size })}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
          <h2 id={titleId} className="text-xl font-semibold font-display">{title}</h2>
          <motion.button
            className="bg-transparent border-none text-2xl text-text-muted cursor-pointer p-1 leading-none hover:text-text"
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
            aria-label="Close"
          >
            &times;
          </motion.button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-primary/10">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  confirmDisabled?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
  confirmDisabled = false
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div>{message}</div>
    </Modal>
  );
}
