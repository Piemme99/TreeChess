import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { useGames } from '../analyse-tab/hooks/useGames';
import { Loading } from '../../shared/components/UI';
import { EmptyRepertoireState } from './components/EmptyRepertoireState';
import { RepertoireOverview } from './components/RepertoireOverview';
import { RecentGames } from './components/RecentGames';
import { QuickActions } from './components/QuickActions';

export function Dashboard() {
  const { repertoires, whiteRepertoires, blackRepertoires, loading: repLoading } = useRepertoires();
  const { games, loading: gamesLoading } = useGames();

  if (repLoading && repertoires.length === 0) {
    return <Loading size="lg" text="Loading..." />;
  }

  if (repertoires.length === 0) {
    return (
      <div className="dashboard-overview">
        <EmptyRepertoireState onRefresh={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <RepertoireOverview
        whiteRepertoires={whiteRepertoires}
        blackRepertoires={blackRepertoires}
      />
      <RecentGames games={games} loading={gamesLoading} />
      <QuickActions />
    </div>
  );
}
