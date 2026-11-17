import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useNoIndex, useV2Path } from './routes';
import { COLOURS, raised, REPERTOIRE, SPRING, tile } from './theme';

/** Une tâche partie de Home (docs/flow/target.html) : son nom, où l'on en est, et ✕ pour y revenir. */
export function TaskBar({ title, progress }: { title: string; progress?: string }) {
  const pathOf = useV2Path();
  useNoIndex();
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 px-3 sm:px-8" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
      <Link to={pathOf('home')} aria-label="Close, back to Home" className="grid size-10 place-items-center rounded-full text-[20px] font-bold focus-visible:outline-2 focus-visible:outline-offset-[-4px]">
        ✕
      </Link>
      <span className="min-w-0 truncate text-[17px] font-extrabold tracking-[-0.01em]">{title}</span>
      {progress && <span className="ml-auto whitespace-nowrap pr-1 text-[14px] font-semibold opacity-80 tabular-nums">{progress}</span>}
    </header>
  );
}

/** La fin d'une tâche : ce qui a été fait, puis la suite ou le retour à Home. */
export function TaskDone({ title, children, next }: { title: string; children?: ReactNode; next?: { label: string; onClick: () => void } }) {
  const pathOf = useV2Path();
  return (
    <motion.section
      aria-label="Done"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="mx-auto mt-6 flex w-full max-w-[30rem] flex-col items-center gap-3 rounded-3xl px-5 py-7 text-center"
      style={raised(false)}
    >
      <span aria-hidden="true" className="text-[40px] font-bold leading-none" style={{ color: REPERTOIRE }}>
        ✓
      </span>
      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
      {children && (
        <div className="flex flex-col gap-1 text-[15px]" style={{ color: COLOURS.leafSoft }}>
          {children}
        </div>
      )}
      <div className="mt-2 flex w-full flex-col gap-2">
        {next && (
          <motion.button type="button" onClick={next.onClick} whileTap={{ scale: 0.97 }} transition={SPRING} className="min-h-12 rounded-full px-5 text-[15px] font-bold focus-visible:outline-2" style={raised(true)}>
            {next.label}
          </motion.button>
        )}
        <Link
          to={pathOf('home')}
          className="grid min-h-12 place-items-center rounded-full px-5 text-[15px] font-bold focus-visible:outline-2"
          style={next ? { ...tile(COLOURS.sand), color: COLOURS.leaf } : raised(true)}
        >
          Back to Home
        </Link>
      </div>
    </motion.section>
  );
}
