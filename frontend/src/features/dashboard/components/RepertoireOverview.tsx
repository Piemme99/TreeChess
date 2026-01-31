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
    <div className={`bg-bg-card rounded-lg p-6 shadow-sm ${isWhite ? 'border-t-4 border-t-[#f5f5f5]' : 'border-t-4 border-t-[#333]'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{isWhite ? '\u2654' : '\u265A'}</span>
        <h3 className="text-lg font-semibold">{isWhite ? 'White' : 'Black'}</h3>
      </div>
      {repertoires.length === 0 ? (
        <p className="text-text-muted italic p-4 text-center">No repertoires yet</p>
      ) : (
        <ul className="list-none flex flex-col gap-1 mb-4">
          {repertoires.map((rep) => (
            <li key={rep.id} className="flex justify-between items-center py-2 px-4 bg-bg rounded-md">
              <span className="font-medium">{rep.name}</span>
              <span className="text-[0.8125rem] text-text-muted">
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
        className="w-full text-center"
      >
        Edit
      </Button>
    </div>
  );
}

export function RepertoireOverview({ whiteRepertoires, blackRepertoires }: RepertoireOverviewProps) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-muted mb-4">Your Repertoires</h2>
      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <RepertoireColorCard color="white" repertoires={whiteRepertoires} />
        <RepertoireColorCard color="black" repertoires={blackRepertoires} />
      </div>
    </section>
  );
}
