import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';
import type { Repertoire } from '../../../types';

interface RepertoireOverviewProps {
  whiteRepertoires: Repertoire[];
  blackRepertoires: Repertoire[];
}

function RepertoireColorCard({ color, repertoires }: { color: 'white' | 'black'; repertoires: Repertoire[] }) {
  const navigate = useNavigate();
  const isWhite = color === 'white';

  return (
    <div className={`repertoire-overview-card ${isWhite ? 'repertoire-overview-white' : 'repertoire-overview-black'}`}>
      <div className="repertoire-overview-card-header">
        <span className="repertoire-overview-icon">{isWhite ? '\u2654' : '\u265A'}</span>
        <h3>{isWhite ? 'White' : 'Black'}</h3>
      </div>
      {repertoires.length === 0 ? (
        <p className="repertoire-overview-empty">No repertoires yet</p>
      ) : (
        <ul className="repertoire-overview-list">
          {repertoires.map((rep) => (
            <li key={rep.id} className="repertoire-overview-item">
              <span className="repertoire-overview-name">{rep.name}</span>
              <span className="repertoire-overview-stats">
                {rep.metadata.totalMoves} moves
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/repertoires')}
        className="repertoire-overview-link"
      >
        Edit
      </Button>
    </div>
  );
}

export function RepertoireOverview({ whiteRepertoires, blackRepertoires }: RepertoireOverviewProps) {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Your Repertoires</h2>
      <div className="repertoire-overview-grid">
        <RepertoireColorCard color="white" repertoires={whiteRepertoires} />
        <RepertoireColorCard color="black" repertoires={blackRepertoires} />
      </div>
    </section>
  );
}
