import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireSelector } from './shared/components/RepertoireSelector';
import { Loading } from '../../shared/components/UI';

export function RepertoireTab() {
  const { whiteRepertoires, blackRepertoires, loading, repertoires } = useRepertoires();

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
    </div>
  );
}
