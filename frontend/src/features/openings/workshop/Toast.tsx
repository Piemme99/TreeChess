import { AnimatePresence, motion } from 'framer-motion';
import { COLOURS, SPRING } from './theme';
import type { ToastMessage } from './useToast';

export function Toast({ toast, onClose }: { toast: (ToastMessage & { stamp: number }) | null; onClose: () => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-50 flex justify-center px-3 lg:right-auto lg:bottom-6 lg:left-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.stamp}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={SPRING}
            className="pointer-events-auto flex max-w-[34rem] items-center gap-4 rounded-2xl py-2.5 pl-4 pr-2 text-[14px] font-semibold"
            style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.55)' }}
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo!();
                  onClose();
                }}
                className="rounded-xl px-3 py-1.5 font-bold focus-visible:outline-2"
                style={{ background: COLOURS.cream, color: COLOURS.leaf }}
              >
                Undo
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={onClose} className="rounded-xl px-2 py-1.5 opacity-70 hover:opacity-100">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
