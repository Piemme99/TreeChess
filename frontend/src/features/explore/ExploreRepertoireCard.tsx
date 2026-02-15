import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, User, GitBranch, Layers, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../shared/utils/animations';
import { Button, ColorDot, LichessLogo } from '../../shared/components/UI';
import { StaticBoard } from '../../shared/components/Board';
import { getMainlineFEN } from '../../shared/utils/chess';
import type { Repertoire } from '../../types';

interface ExploreRepertoireCardProps {
  repertoire: Repertoire;
  onImport: (id: string) => void;
  importing?: boolean;
  index?: number;
}

export const ExploreRepertoireCard = memo(function ExploreRepertoireCard({
  repertoire,
  onImport,
  importing,
  index = 0
}: ExploreRepertoireCardProps) {
  const navigate = useNavigate();
  const { metadata, color, name, description, authorName, origin } = repertoire;
  const orientation = color === 'white' ? 'white' : 'black';
  const isFromLichess = origin?.type === 'lichess';

  const previewFEN = useMemo(
    () => getMainlineFEN(repertoire.treeData),
    [repertoire.treeData]
  );

  const lichessTooltip = isFromLichess
    ? `Imported from Lichess${origin.creator ? ` by ${origin.creator}` : ''}`
    : undefined;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ scale: 1.02, boxShadow: '0 12px 24px -8px rgba(230,126,34,0.15)' }}
      className="bg-bg-card rounded-xl border border-primary/10 flex flex-col transition-colors duration-150 hover:border-primary/30 overflow-hidden"
    >
      {/* Mini board preview */}
      <div
        className="relative p-3 pb-0 cursor-pointer"
        onClick={() => navigate(`/explore/repertoire/${repertoire.id}`)}
      >
        <div className="w-full aspect-square rounded-lg overflow-hidden">
          <StaticBoard fen={previewFEN} orientation={orientation} />
        </div>
        {isFromLichess && (
          <a
            href={origin.url}
            target="_blank"
            rel="noopener noreferrer"
            title={lichessTooltip}
            className="absolute top-4 right-4 w-6 h-6 bg-white/90 rounded-md flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <LichessLogo size={16} className="text-[#4a4a4a]" />
          </a>
        )}
      </div>

      <div className="p-3 pt-2.5 flex flex-col flex-1">
        {/* Header: Color + Name */}
        <div className="flex items-center gap-2 mb-1">
          <ColorDot color={color} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-text truncate" title={name}>
              {name}
            </h3>
            {authorName && (
              <div className="flex items-center gap-1">
                <User className="w-2.5 h-2.5 text-text-muted" />
                <span className="text-[10px] text-text-muted truncate">{authorName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Lichess origin line */}
        {isFromLichess && origin.creator && (
          <a
            href={origin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mb-1 no-underline group"
            title={lichessTooltip}
          >
            <LichessLogo size={10} className="text-text-muted group-hover:text-[#629924] transition-colors shrink-0" />
            <span className="text-[10px] text-text-muted group-hover:text-[#629924] transition-colors truncate">
              {origin.creator}
            </span>
          </a>
        )}

        {/* Description */}
        {description ? (
          <p className="text-[10px] text-text-muted line-clamp-2 mb-2 leading-relaxed">{description}</p>
        ) : (
          <div className="mb-1" />
        )}

        {/* Stats row */}
        <div className="flex items-stretch gap-1.5 mb-3">
          <div className="flex-1 bg-bg rounded-lg px-1.5 py-1.5 text-center">
            <GitBranch className="w-2.5 h-2.5 text-text-muted mx-auto mb-0.5" />
            <p className="text-sm font-semibold font-display text-text leading-tight">{metadata.totalMoves}</p>
            <p className="text-[8px] text-text-muted uppercase tracking-wide">moves</p>
          </div>
          <div className="flex-1 bg-bg rounded-lg px-1.5 py-1.5 text-center">
            <Layers className="w-2.5 h-2.5 text-text-muted mx-auto mb-0.5" />
            <p className="text-sm font-semibold font-display text-text leading-tight">{metadata.totalNodes}</p>
            <p className="text-[8px] text-text-muted uppercase tracking-wide">positions</p>
          </div>
          <div className="flex-1 bg-bg rounded-lg px-1.5 py-1.5 text-center">
            <ArrowDown className="w-2.5 h-2.5 text-text-muted mx-auto mb-0.5" />
            <p className="text-sm font-semibold font-display text-text leading-tight">{metadata.deepestDepth}</p>
            <p className="text-[8px] text-text-muted uppercase tracking-wide">depth</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/explore/repertoire/${repertoire.id}`)}
            className="flex-1 justify-center text-[11px]"
          >
            <Eye className="w-3 h-3" />
            View
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onImport(repertoire.id)}
            disabled={importing}
            className="flex-1 justify-center text-[11px]"
          >
            <Download className="w-3 h-3" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
