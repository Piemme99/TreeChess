import { useRepertoires } from './shared/hooks/useRepertoires';
import { useYouTubeImport } from './shared/hooks/useYouTubeImport';
import { RepertoireSelector } from './shared/components/RepertoireSelector';
import { YouTubeImport } from './shared/components/YouTubeImport';
import { Loading } from '../../shared/components/UI';

export function RepertoireTab() {
  const { whiteRepertoires, blackRepertoires, loading, repertoires } = useRepertoires();
  const youtubeImportState = useYouTubeImport();

  if (loading && repertoires.length === 0) {
    return (
      <div className="repertoire-tab">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="repertoire-tab">
      <div className="repertoire-tab-actions">
        <div className="quick-action-card" role="region">
          <span className="quick-action-icon">&#127909;</span>
          <span className="quick-action-label">Import from YouTube</span>
          <span className="quick-action-desc">Extract opening lines from a chess video</span>
          <div className="quick-action-content">
            <YouTubeImport youtubeImportState={youtubeImportState} />
          </div>
        </div>
      </div>

      <div className="repertoire-selectors">
        <RepertoireSelector color="white" repertoires={whiteRepertoires} />
        <RepertoireSelector color="black" repertoires={blackRepertoires} />
      </div>
    </div>
  );
}
