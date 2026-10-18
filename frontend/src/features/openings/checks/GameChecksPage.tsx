import { MotionConfig } from 'framer-motion';
import { useMemo, useState } from 'react';
import { asksDecision, checkGame } from '../domain/gameCheck';
import type { AddedMove } from '../domain/addition';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import { gamesUntil } from '../domain/replay';
import type { PointedPreparation } from '../line/Preparation';
import { playedGamesFixture } from '../fixtures/playedGames';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { replayLine } from '../position/replay';
import { ReplayBar } from '../replay/ReplayBar';
import { REPLAY_FIRST_DAY } from '../replay/replaySetup';
import { useRepertoires } from '../replay/useRepertoires';
import { useReplayDay } from '../replay/useReplayDay';
import { PageHeader } from '../workshop/PageHeader';
import { COLOURS, FONT_FAMILY, REPERTOIRE } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { checkedPath, type CheckedGame } from './checkedGame';
import { AdditionPanel } from './AdditionPanel';
import { GameCard } from './GameCard';
import { useIgnoredChecks } from './useIgnoredChecks';

export function GameChecksPage() {
  useWorkshopFont();
  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const { ignored, ignore, clear } = useIgnoredChecks();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [pointed, setPointed] = useState<PointedPreparation | null>(null);
  const { repertoires, add, clear: forgetAdditions } = useRepertoires(playedGamesFixture);
  const lived = useMemo(() => {
    const games = playedGamesFixture
      .map((game, id) => ({ id, game }))
      .filter(({ game }) => game.playedAt > REPLAY_FIRST_DAY && game.playedAt <= replay.day)
      .sort((a, b) => a.game.playedAt.localeCompare(b.game.playedAt))
      .map(({ id, game }) => ({ id, game, check: checkGame(repertoires[game.side], game) }));
    const asks = asksDecision(games);
    return games.map((checked, index): CheckedGame => ({ ...checked, asks: asks[index] }));
  }, [repertoires, replay.day]);
  const today = lived.filter(({ game }) => game.playedAt === replay.day);
  // Toute partie sortie du répertoire se tranche le jour même ; seules celles qui demandent une décision attendent ensuite.
  const isOpen = (checked: CheckedGame) => checked.check.kind !== 'followed' && !ignored.has(checked.id);
  const isPending = (checked: CheckedGame) => checked.asks && isOpen(checked);
  // Les parties du jour portent leur propre décision : la liste suivante ne reprend que les jours passés.
  const earlier = lived.filter((checked) => checked.game.playedAt < replay.day && isPending(checked)).reverse();
  const selected = lived.find((checked) => checked.id === selectedId) ?? today[0] ?? null;
  const adding = lived.find((checked) => checked.id === addingId);
  const habits = useMemo(
    () => (adding ? gamesUntil(playedGamesFixture, replay.day).filter((game) => game.side === adding.game.side) : []),
    [adding, replay.day],
  );

  const startAdding = (checked: CheckedGame) => {
    setSelectedId(checked.id);
    setAddingId(checked.id);
  };
  const stopAdding = () => {
    setAddingId(null);
    setPointed(null);
  };
  const accept = (moves: AddedMove[]) => {
    if (adding) add({ side: adding.game.side, addedAt: replay.day, moves });
    stopAdding();
  };

  const reset = replay.reset && (() => {
    replay.reset!();
    clear();
    forgetAdditions();
    setSelectedId(null);
    stopAdding();
  });
  const next = replay.next && (() => {
    replay.next!();
    setSelectedId(null);
    stopAdding();
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-28" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <span className="ml-auto">
            <ReplayBar replay={{ ...replay, next, reset }} />
          </span>
        </PageHeader>
        <main className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
          <CheckBoard checked={selected} repertoires={repertoires} pointed={adding ? pointed : null} />
          <div className="flex min-w-0 flex-col gap-10">
            {adding && adding.check.kind !== 'followed' && (
              <AdditionPanel
                key={adding.id}
                checked={{ ...adding, check: adding.check }}
                games={habits}
                onPoint={setPointed}
                onAccept={accept}
                onCancel={stopAdding}
              />
            )}
            <section aria-labelledby="day-title" className="flex flex-col gap-3">
              <h2 id="day-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
                Games of the day
              </h2>
              {today.length ? (
                <ul className="flex flex-col gap-2">
                  {today.map((checked) => (
                    <GameCard
                      key={checked.id}
                      checked={checked}
                      selected={checked === selected}
                      onSelect={() => setSelectedId(checked.id)}
                      onIgnore={isOpen(checked) ? () => ignore(checked.id) : undefined}
                      onAdd={isOpen(checked) ? () => startAdding(checked) : undefined}
                      ignored={ignored.has(checked.id)}
                    />
                  ))}
                </ul>
              ) : (
                <p style={{ color: COLOURS.leafSoft }}>No game yet: your repertoire was just created. Press “Next day”.</p>
              )}
            </section>
            <section aria-labelledby="decide-title" className="flex flex-col gap-3">
              <h2 id="decide-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
                Still to decide <span className="text-[15px] font-semibold" style={{ color: COLOURS.leafSoft }}>{earlier.length}</span>
              </h2>
              {earlier.length ? (
                <ul className="flex flex-col gap-2">
                  {earlier.map((checked) => (
                    <GameCard
                      key={checked.id}
                      checked={checked}
                      selected={checked === selected}
                      onSelect={() => setSelectedId(checked.id)}
                      onIgnore={() => ignore(checked.id)}
                      onAdd={() => startAdding(checked)}
                      showDate
                    />
                  ))}
                </ul>
              ) : (
                <p style={{ color: COLOURS.leafSoft }}>Nothing left from the previous days.</p>
              )}
            </section>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

interface CheckBoardProps {
  checked: CheckedGame | null;
  repertoires: Record<CheckedGame['game']['side'], Repertoire>;
  pointed: PointedPreparation | null;
}

function CheckBoard({ checked, repertoires, pointed }: CheckBoardProps) {
  const checkPath = useMemo(() => (checked ? checkedPath(checked) : []), [checked]);
  const path = pointed ? pointed.path : checkPath;
  const arrows = useMemo((): BoardArrow[] => {
    if (pointed) return [{ san: pointed.move.san, tone: 'winning', colour: REPERTOIRE, share: 0.5, emphasis: true }];
    if (!checked || checked.check.kind === 'followed') return [];
    const fen = replayLine(checkPath).fens[checkPath.length];
    const planned = repertoireMovesAt(repertoires[checked.game.side], fen).map(
      (move): BoardArrow => ({ san: move.san, tone: 'winning', colour: REPERTOIRE, share: 0.5, emphasis: true }),
    );
    return [...planned, { san: checked.check.played, tone: 'losing', colour: COLOURS.terracotta, share: 0.5, emphasis: true }];
  }, [checked, checkPath, pointed, repertoires]);

  return (
    <aside aria-label="Position" className="sticky top-6 flex flex-col gap-3 self-start">
      <ArrowBoard path={path} flipped={checked?.game.side === 'b'} arrows={arrows} />
      {!pointed && checked && checked.check.kind !== 'followed' && (
        <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>red</span> played ·{' '}
          <span className="font-bold" style={{ color: REPERTOIRE }}>green</span> your repertoire
        </p>
      )}
    </aside>
  );
}
