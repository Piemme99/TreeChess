import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireManager } from './shared/components/RepertoireManager';
import { StudyImportModal } from './shared/components/StudyImportModal';
import { Loading, ColorDot } from '../../shared/components/UI';
import { fadeUp } from '../../shared/utils/animations';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import type { Color, Repertoire, Category } from '../../types';

export function RepertoireTab() {
  usePageTitle('Repertoires');
  const { whiteRepertoires, blackRepertoires, whiteCategories, blackCategories, loading, repertoires, categories, refresh } = useRepertoires();
  const [showStudyModal, setShowStudyModal] = useState(false);

  if (loading && repertoires.length === 0 && categories.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto w-full flex flex-col items-center py-8 gap-8">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  // White and Black are shown at the same hierarchy level (no extra click for
  // Black) — each colour gets its own section with a self-contained selector.
  const sections: { color: Color; label: string; reps: Repertoire[]; cats: Category[] }[] = [
    { color: 'white', label: 'White', reps: whiteRepertoires, cats: whiteCategories },
    { color: 'black', label: 'Black', reps: blackRepertoires, cats: blackCategories },
  ];

  return (
    <div className="max-w-[960px] mx-auto w-full flex flex-col py-8 px-4 gap-6">
      <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={0} className="text-2xl font-bold text-text font-display">Repertoires</motion.h1>

      {sections.map((section, i) => (
        <motion.section
          key={section.color}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={i + 1}
          className={i > 0 ? 'pt-2 border-t border-primary/10' : undefined}
        >
          <div className="flex items-center gap-2 mb-4">
            <ColorDot color={section.color} size="md" />
            <h2 className="text-lg font-semibold text-text font-display">{section.label}</h2>
            <span className="text-xs bg-primary-light text-text-muted px-2 py-0.5 rounded-full">
              {section.reps.length}
            </span>
          </div>
          <RepertoireManager
            color={section.color}
            repertoires={section.reps}
            categories={section.cats}
            onImportStudy={() => setShowStudyModal(true)}
          />
        </motion.section>
      ))}

      <StudyImportModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
