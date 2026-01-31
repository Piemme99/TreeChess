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
      <div className="repertoire-tab">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="repertoire-tab">
      <div className="repertoire-selectors">
        <RepertoireSelector color="white" repertoires={whiteRepertoires} />
        <RepertoireSelector color="black" repertoires={blackRepertoires} />
      </div>
      <button className="import-study-btn" onClick={() => setShowStudyModal(true)}>
        <span className="import-study-btn-icon">&#128218;</span>
        <div className="import-study-btn-text">
          <span className="import-study-btn-label">Import a Lichess Study</span>
          <span className="import-study-btn-desc">Import chapters from a Lichess study as repertoires</span>
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
