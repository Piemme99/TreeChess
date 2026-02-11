import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, User, GitBranch, Layers, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../shared/utils/animations';
import { Button, ColorDot } from '../../shared/components/UI';
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
  const { metadata, color, name, authorName } = repertoire;

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      whileHover={{ scale: 1.02, boxShadow: '0 12px 24px -8px rgba(230,126,34,0.15)' }}
      className="bg-bg-card rounded-2xl border border-primary/10 p-5 flex flex-col transition-colors duration-150 hover:border-primary/30"
    >
      {/* Header: Color + Name */}
      <div className="flex items-center gap-2.5 mb-3">
        <ColorDot color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text truncate" title={name}>
            {name}
          </h3>
          {authorName && (
            <div className="flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-muted">{authorName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-stretch gap-3 mb-4">
        <div className="flex-1 bg-bg rounded-xl px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <GitBranch className="w-3 h-3 text-text-muted" />
          </div>
          <p className="text-lg font-semibold font-display text-text leading-tight">{metadata.totalMoves}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">moves</p>
        </div>
        <div className="flex-1 bg-bg rounded-xl px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Layers className="w-3 h-3 text-text-muted" />
          </div>
          <p className="text-lg font-semibold font-display text-text leading-tight">{metadata.totalNodes}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">positions</p>
        </div>
        <div className="flex-1 bg-bg rounded-xl px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <ArrowDown className="w-3 h-3 text-text-muted" />
          </div>
          <p className="text-lg font-semibold font-display text-text leading-tight">{metadata.deepestDepth}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">depth</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/explore/repertoire/${repertoire.id}`)}
          className="flex-1 justify-center"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onImport(repertoire.id)}
          disabled={importing}
          className="flex-1 justify-center"
        >
          <Download className="w-3.5 h-3.5" />
          {importing ? 'Importing...' : 'Import'}
        </Button>
      </div>
    </motion.div>
  );
});
