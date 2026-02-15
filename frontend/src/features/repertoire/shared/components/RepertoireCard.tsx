import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../../../shared/utils/animations';
import { LichessLogo } from '../../../../shared/components/UI';
import { StaticBoard } from '../../../../shared/components/Board';
import { getMainlineFEN } from '../../../../shared/utils/chess';
import type { Repertoire } from '../../../../types';

export interface RepertoireCardProps {
  repertoire: Repertoire;
  selected?: boolean;
  editing?: boolean;
  editName?: string;
  loading?: boolean;
  index?: number;
  onOpen: () => void;
  onDelete: () => void;
  onToggleSelection?: () => void;
  onStartEditing?: () => void;
  onEditNameChange?: (name: string) => void;
  onRename?: () => void;
  onCancelEditing?: () => void;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragListeners?: React.DOMAttributes<HTMLElement>;
}

export const RepertoireCard = memo(function RepertoireCard({
  repertoire,
  selected,
  editing,
  editName,
  loading,
  index = 0,
  onOpen,
  onDelete,
  onToggleSelection,
  onStartEditing,
  onEditNameChange,
  onRename,
  onCancelEditing,
  dragAttributes,
  dragListeners
}: RepertoireCardProps) {
  const orientation = repertoire.color === 'white' ? 'white' : 'black';
  const isFromLichess = repertoire.origin?.type === 'lichess';

  const previewFEN = useMemo(
    () => getMainlineFEN(repertoire.treeData),
    [repertoire.treeData]
  );

  const lichessTooltip = isFromLichess
    ? `Imported from Lichess${repertoire.origin?.creator ? ` by ${repertoire.origin.creator}` : ''}`
    : undefined;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ scale: 1.02, boxShadow: '0 12px 24px -8px rgba(230,126,34,0.15)' }}
      className={`bg-bg-card rounded-2xl border transition-colors duration-150 overflow-hidden flex flex-col${
        selected ? ' border-primary border-2' : ' border-primary/10'
      }`}
    >
      {/* Mini board */}
      <div
        className="relative w-full aspect-square cursor-pointer"
        onClick={onOpen}
      >
        <StaticBoard fen={previewFEN} orientation={orientation} />
        {isFromLichess && (
          <a
            href={repertoire.origin?.url}
            target="_blank"
            rel="noopener noreferrer"
            title={lichessTooltip}
            className="absolute top-1.5 right-1.5 w-5 h-5 bg-white/90 rounded flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <LichessLogo size={13} className="text-[#4a4a4a]" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={editName ?? ''}
              onChange={(e) => onEditNameChange?.(e.target.value)}
              placeholder="Repertoire name"
              className="w-full py-1.5 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename?.();
                if (e.key === 'Escape') onCancelEditing?.();
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={onRename}
                disabled={loading}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={onCancelEditing}
                disabled={loading}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg text-text-muted hover:bg-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Name + drag handle row */}
            <div className="flex items-start gap-1.5">
              {dragAttributes && dragListeners && (
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-text-muted hover:text-text mt-0.5"
                  {...dragAttributes}
                  {...dragListeners}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5" cy="4" r="1.5" />
                    <circle cx="11" cy="4" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" />
                    <circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="11" cy="12" r="1.5" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span
                  className="block font-medium text-sm leading-tight truncate cursor-text"
                  onDoubleClick={onStartEditing}
                  title={repertoire.name}
                >
                  {repertoire.name}
                </span>
                <span className="text-[11px] text-text-muted">
                  {repertoire.metadata.totalMoves} moves &middot; depth {repertoire.metadata.deepestDepth}
                </span>
                {isFromLichess && repertoire.origin?.creator && (
                  <a
                    href={repertoire.origin.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 mt-0.5 no-underline group"
                    title={lichessTooltip}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LichessLogo size={9} className="text-text-muted group-hover:text-[#629924] transition-colors shrink-0" />
                    <span className="text-[10px] text-text-muted group-hover:text-[#629924] transition-colors truncate">
                      {repertoire.origin.creator}
                    </span>
                  </a>
                )}
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-1.5 mt-auto">
              {onToggleSelection && (
                <label className="flex items-center shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelection}
                    className="w-3.5 h-3.5 cursor-pointer accent-primary"
                  />
                </label>
              )}
              <button
                onClick={onOpen}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                Open
              </button>
              <button
                onClick={onDelete}
                disabled={loading}
                className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7v5M9.5 7v5M3.5 4l.5 9a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 13l.5-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
});
