import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepertoireStore } from '../../stores/repertoireStore';
import { repertoireApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, Loading } from '../UI';
import type { Color } from '../../types';

interface RepertoireCardProps {
  color: Color;
  totalMoves: number;
  totalNodes: number;
  deepestDepth: number;
  onEdit: () => void;
}

function RepertoireCard({ color, totalMoves, totalNodes, deepestDepth, onEdit }: RepertoireCardProps) {
  const isWhite = color === 'white';

  return (
    <div className={`repertoire-card ${isWhite ? 'repertoire-card-white' : 'repertoire-card-black'}`}>
      <div className="repertoire-card-icon">
        {isWhite ? '♔' : '♚'}
      </div>
      <h3 className="repertoire-card-title">
        {isWhite ? 'White' : 'Black'} Repertoire
      </h3>
      <div className="repertoire-card-stats">
        <div className="stat">
          <span className="stat-value">{totalNodes}</span>
          <span className="stat-label">positions</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMoves}</span>
          <span className="stat-label">moves</span>
        </div>
        <div className="stat">
          <span className="stat-value">{deepestDepth}</span>
          <span className="stat-label">depth</span>
        </div>
      </div>
      <Button variant="primary" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

export function RepertoireTab() {
  const navigate = useNavigate();
  const {
    whiteRepertoire,
    blackRepertoire,
    loading,
    setRepertoire,
    setLoading,
    setError
  } = useRepertoireStore();

  useEffect(() => {
    const loadRepertoires = async () => {
      if (whiteRepertoire && blackRepertoire) return;

      setLoading(true);
      try {
        const [white, black] = await Promise.all([
          repertoireApi.get('white'),
          repertoireApi.get('black')
        ]);
        setRepertoire('white', white);
        setRepertoire('black', black);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load repertoires';
        setError({ message });
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadRepertoires();
  }, [whiteRepertoire, blackRepertoire, setRepertoire, setLoading, setError]);

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
