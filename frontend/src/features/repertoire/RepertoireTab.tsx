import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireSelector } from './shared/components/RepertoireSelector';
import { StudyImportModal } from './shared/components/StudyImportModal';
import { Loading, ColorDot } from '../../shared/components/UI';
import { fadeUp } from '../../shared/utils/animations';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import type { Color } from '../../types';

export function RepertoireTab() {
  usePageTitle('Repertoires');
  const { whiteRepertoires, blackRepertoires, whiteCategories, blackCategories, loading, repertoires, categories, refresh } = useRepertoires();
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Color>('white');

  if (loading && repertoires.length === 0 && categories.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto w-full flex flex-col items-center py-8 gap-8">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto w-full flex flex-col py-8 px-4 gap-6">
      <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={0} className="text-2xl font-bold text-text font-display">Repertoires</motion.h1>

      {/* Tabs */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="flex border-b border-primary/10">
        <button
          className={`flex items-center gap-2 px-6 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'white'
              ? 'border-primary text-text'
              : 'border-transparent text-text-muted hover:text-text hover:border-primary/20'
          }`}
          onClick={() => setActiveTab('white')}
        >
          <ColorDot color="white" size="md" />
          <span>White</span>
          <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full text-text-muted">
            {whiteRepertoires.length}
          </span>
        </button>
        <button
          className={`flex items-center gap-2 px-6 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'black'
              ? 'border-primary text-text'
              : 'border-transparent text-text-muted hover:text-text hover:border-primary/20'
          }`}
          onClick={() => setActiveTab('black')}
        >
          <ColorDot color="black" size="md" />
          <span>Black</span>
          <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full text-text-muted">
            {blackRepertoires.length}
          </span>
        </button>
      </motion.div>

      {/* Tab content */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="mt-2">
        {activeTab === 'white' ? (
          <RepertoireSelector color="white" repertoires={whiteRepertoires} categories={whiteCategories} onImportStudy={() => {
            setShowStudyModal(true);
          }} />
        ) : (
          <RepertoireSelector color="black" repertoires={blackRepertoires} categories={blackCategories} onImportStudy={() => {
            setShowStudyModal(true);
          }} />
        )}
      </motion.div>

      <StudyImportModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
