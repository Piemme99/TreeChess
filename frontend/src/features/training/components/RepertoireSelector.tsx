import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import type { Repertoire } from '../../../types';
import { fadeUp, staggerContainer } from '../../../shared/utils/animations';

interface RepertoireSelectorProps {
  repertoires: Repertoire[];
  onSelect: (repertoire: Repertoire) => void;
}

export function RepertoireSelector({ repertoires, onSelect }: RepertoireSelectorProps) {
  const whiteReps = repertoires.filter((r) => r.color === 'white');
  const blackReps = repertoires.filter((r) => r.color === 'black');

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto"
    >
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold font-display text-text mb-2">Training</h1>
        <p className="text-text-muted text-sm">
          Choose a repertoire to practice. The computer plays your opponent's moves and you must find the correct responses.
        </p>
      </motion.div>

      {repertoires.length === 0 ? (
        <motion.div variants={fadeUp} className="text-center py-16">
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
    </motion.div>
  );
}

function RepertoireGroup({
  title,
  repertoires,
  onSelect,
}: {
  title: string;
  repertoires: Repertoire[];
  onSelect: (repertoire: Repertoire) => void;
}) {
  return (
    <motion.div variants={fadeUp} className="mb-8">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {repertoires.map((rep) => {
          const isEmpty = rep.metadata.totalMoves === 0;
          return (
            <button
              key={rep.id}
              onClick={() => !isEmpty && onSelect(rep)}
              disabled={isEmpty}
              className={`text-left p-4 rounded-2xl border transition-all duration-150 ${
                isEmpty
                  ? 'border-primary/5 bg-bg opacity-50 cursor-not-allowed'
                  : 'border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    rep.color === 'white'
                      ? 'bg-white border border-gray-200 text-gray-800'
                      : 'bg-gray-800 text-white'
                  }`}
                >
                  {rep.color === 'white' ? 'W' : 'B'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text truncate">{rep.name}</div>
                  <div className="text-xs text-text-muted">
                    {isEmpty ? 'No moves' : `${rep.metadata.totalMoves} moves`}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
