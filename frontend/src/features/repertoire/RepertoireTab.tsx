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
      <div className="repertoire-selectors">
        <RepertoireSelector color="white" repertoires={whiteRepertoires} />
        <RepertoireSelector color="black" repertoires={blackRepertoires} />
      </div>

      <section className="repertoire-youtube-section">
        <h3>Import repertoire from YouTube</h3>
        <p className="repertoire-youtube-hint">
          Extract opening lines from a chess video to create a new repertoire.
        </p>
        <YouTubeImport youtubeImportState={youtubeImportState} />
      </section>
    </div>
  );
}
