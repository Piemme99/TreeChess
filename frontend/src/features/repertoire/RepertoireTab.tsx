import { useNavigate } from 'react-router-dom';
import { useRepertoires } from './shared/hooks/useRepertoires';
import { RepertoireCard } from './shared/components/RepertoireCard';
import { Loading } from '../../shared/components/UI';

export function RepertoireTab() {
  const navigate = useNavigate();
  const { whiteRepertoire, blackRepertoire, loading } = useRepertoires();

  if (loading && !whiteRepertoire && !blackRepertoire) {
    return (
      <div className="repertoire-tab">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="repertoire-tab">
      <div className="repertoire-cards">
        <RepertoireCard
          color="white"
          totalMoves={whiteRepertoire?.metadata.totalMoves || 0}
          totalNodes={whiteRepertoire?.metadata.totalNodes || 0}
          deepestDepth={whiteRepertoire?.metadata.deepestDepth || 0}
          onEdit={() => navigate('/repertoire/white/edit')}
        />
        <RepertoireCard
          color="black"
          totalMoves={blackRepertoire?.metadata.totalMoves || 0}
          totalNodes={blackRepertoire?.metadata.totalNodes || 0}
          deepestDepth={blackRepertoire?.metadata.deepestDepth || 0}
          onEdit={() => navigate('/repertoire/black/edit')}
        />
      </div>
    </div>
  );
}