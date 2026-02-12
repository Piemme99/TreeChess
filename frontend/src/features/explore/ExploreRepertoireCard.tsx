import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, User, GitBranch, Layers, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../shared/utils/animations';
import { Button, ColorDot } from '../../shared/components/UI';
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
  const { metadata, color, name, description, authorName } = repertoire;
  const orientation = color === 'white' ? 'white' : 'black';

  const previewFEN = useMemo(
    () => getMainlineFEN(repertoire.treeData),
    [repertoire.treeData]
  );

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      whileHover={{ scale: 1.02, boxShadow: '0 12px 24px -8px rgba(230,126,34,0.15)' }}
      className="bg-bg-card rounded-xl border border-primary/10 flex flex-col transition-colors duration-150 hover:border-primary/30 overflow-hidden"
    >
      {/* Mini board preview */}
      <div
        className="p-3 pb-0 cursor-pointer"
        onClick={() => navigate(`/explore/repertoire/${repertoire.id}`)}
      >
        <div className="w-full aspect-square rounded-lg overflow-hidden">
          <StaticBoard fen={previewFEN} orientation={orientation} />
        </div>
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
