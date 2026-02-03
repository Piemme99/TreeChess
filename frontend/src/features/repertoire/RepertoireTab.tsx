import { useState } from 'react';
import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireSelector } from './shared/components/RepertoireSelector';
import { StudyImportModal } from './shared/components/StudyImportModal';
import { Loading } from '../../shared/components/UI';
import type { Color } from '../../types';

export function RepertoireTab() {
  const { whiteRepertoires, blackRepertoires, whiteCategories, blackCategories, loading, repertoires, categories, refresh } = useRepertoires();
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Color>('white');

  if (loading && repertoires.length === 0 && categories.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto w-full flex flex-col items-center py-8 gap-8">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto w-full flex flex-col py-8 px-4 gap-6">
      {/* Header with title and import button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Repertoires</h1>
        <button
          className="flex items-center gap-2 py-2 px-4 bg-bg-card border border-border rounded-lg cursor-pointer transition-all duration-150 font-sans text-sm hover:border-primary hover:bg-bg-card hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={() => {
            setShowStudyModal(true);
            window.open('https://lichess.org/study', '_blank');
          }}
        >
          <span className="text-lg leading-none">&#128218;</span>
          <span className="font-medium">Import Study</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={`flex items-center gap-2 px-6 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'white'
              ? 'border-primary text-text'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
          onClick={() => setActiveTab('white')}
        >
          <span className="text-xl">{'\u2654'}</span>
          <span>White</span>
          <span className="text-xs bg-bg px-2 py-0.5 rounded-full text-text-muted">
            {whiteRepertoires.length}
          </span>
        </button>
        <button
          className={`flex items-center gap-2 px-6 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'black'
              ? 'border-primary text-text'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
          onClick={() => setActiveTab('black')}
        >
          <span className="text-xl">{'\u265A'}</span>
          <span>Black</span>
          <span className="text-xs bg-bg px-2 py-0.5 rounded-full text-text-muted">
            {blackRepertoires.length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === 'white' ? (
          <RepertoireSelector color="white" repertoires={whiteRepertoires} categories={whiteCategories} />
        ) : (
          <RepertoireSelector color="black" repertoires={blackRepertoires} categories={blackCategories} />
        )}
      </div>

      <StudyImportModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
