import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import type { Repertoire } from '../../../types';
import { colorToShort } from '../../../types';
import { generateTrainingLines } from '../utils/treeTraversal';
import { fadeUp } from '../../../shared/utils/animations';

interface RepertoireSelectorProps {
  repertoires: Repertoire[];
  onSelect: (repertoire: Repertoire, lineCount: number) => void;
}

const LINE_COUNT_OPTIONS = [3, 5, 10] as const;

export function RepertoireSelector({ repertoires, onSelect }: RepertoireSelectorProps) {
  const whiteReps = repertoires.filter((r) => r.color === 'white');
  const blackReps = repertoires.filter((r) => r.color === 'black');

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold font-display text-text mb-2">Training</h1>
        <p className="text-text-muted text-sm">
          Choose a repertoire to practice. The computer plays your opponent's moves and you must find the correct responses.
        </p>
      </motion.div>

      {repertoires.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="text-center py-16">
          <BookOpen className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-muted">No repertoires yet. Create one first!</p>
        </motion.div>
      ) : (
        <>
          {whiteReps.length > 0 && (
            <RepertoireGroup
              title="White Repertoires"
              repertoires={whiteReps}
              onSelect={onSelect}
            />
          )}
          {blackReps.length > 0 && (
            <RepertoireGroup
              title="Black Repertoires"
              repertoires={blackReps}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </div>
  );
}

function RepertoireGroup({
  title,
  repertoires,
  onSelect,
}: {
  title: string;
  repertoires: Repertoire[];
  onSelect: (repertoire: Repertoire, lineCount: number) => void;
}) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="mb-8">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {repertoires.map((rep) => (
          <RepertoireCard key={rep.id} repertoire={rep} onSelect={onSelect} />
        ))}
      </div>
    </motion.div>
  );
}

function RepertoireCard({
  repertoire,
  onSelect,
}: {
  repertoire: Repertoire;
  onSelect: (repertoire: Repertoire, lineCount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = repertoire.metadata.totalMoves === 0;

  const totalLines = useMemo(() => {
    if (!expanded) return 0;
    const userColor = colorToShort(repertoire.color);
    return generateTrainingLines(repertoire.treeData, userColor).length;
  }, [expanded, repertoire]);

  return (
    <div
      className={`rounded-2xl border transition-all duration-150 ${
        isEmpty
          ? 'border-primary/5 bg-bg opacity-50'
          : expanded
            ? 'border-primary/30 bg-bg-card shadow-md shadow-primary/5'
            : 'border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
      }`}
    >
      <button
        onClick={() => !isEmpty && setExpanded(!expanded)}
        disabled={isEmpty}
        className={`w-full text-left p-4 ${
          isEmpty ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              repertoire.color === 'white'
                ? 'bg-white border border-gray-200 text-gray-800'
                : 'bg-gray-800 text-white'
            }`}
          >
            {repertoire.color === 'white' ? 'W' : 'B'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-text truncate">{repertoire.name}</div>
            <div className="text-xs text-text-muted">
              {isEmpty ? 'No moves' : `${repertoire.metadata.totalMoves} moves`}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs text-text-muted mb-2.5">
            How many lines?
            {totalLines > 0 && (
              <span className="text-text-muted/60"> ({totalLines} available)</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {LINE_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => onSelect(repertoire, count)}
                disabled={totalLines === 0}
                className="px-4 py-1.5 rounded-xl text-sm border border-primary/10 bg-bg text-text font-medium hover:border-primary/30 hover:shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {count} lines
              </button>
            ))}
            <button
              onClick={() => onSelect(repertoire, totalLines)}
              disabled={totalLines === 0}
              className="px-4 py-1.5 rounded-xl text-sm border border-primary/10 bg-bg text-text font-medium hover:border-primary/30 hover:shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              All{totalLines > 0 ? ` (${totalLines})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
