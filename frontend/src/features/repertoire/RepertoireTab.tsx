import { useState } from 'react';
import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireSelector } from './shared/components/RepertoireSelector';
import { StudyImportModal } from './shared/components/StudyImportModal';
import { Loading } from '../../shared/components/UI';

export function RepertoireTab() {
  const { whiteRepertoires, blackRepertoires, loading, repertoires, refresh } = useRepertoires();
  const [showStudyModal, setShowStudyModal] = useState(false);

  if (loading && repertoires.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 gap-8">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-8 gap-8">
      <div className="flex gap-8 p-6 max-md:flex-col">
        <RepertoireSelector color="white" repertoires={whiteRepertoires} />
        <RepertoireSelector color="black" repertoires={blackRepertoires} />
      </div>
      <button
        className="flex items-center gap-4 w-full max-w-[600px] py-6 px-8 border border-dashed border-border rounded-lg cursor-pointer transition-all duration-150 font-sans text-left hover:border-primary hover:border-solid hover:bg-bg-card hover:shadow-md"
        onClick={() => {
          setShowStudyModal(true);
          window.open('https://lichess.org/study', '_blank');
        }}
      >
        <span className="text-[1.75rem] leading-none shrink-0">&#128218;</span>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[0.9375rem]">Import a Lichess Study</span>
          <span className="text-[0.8125rem] text-text-muted">Import chapters from a Lichess study as repertoires</span>
        </div>
      </button>
      <StudyImportModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
