import { MotionConfig } from 'framer-motion';
import { useMemo, useState } from 'react';
import { checkGame } from '../domain/gameCheck';
import { repertoireMovesAt } from '../domain/repertoire';
import { playedGamesFixture } from '../fixtures/playedGames';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { replayLine } from '../position/replay';
import { ReplayBar } from '../replay/ReplayBar';
import { REPLAY_FIRST_DAY, REPLAY_START, repertoiresOf } from '../replay/replaySetup';
import { useReplayDay } from '../replay/useReplayDay';
import { PageHeader } from '../workshop/PageHeader';
import { COLOURS, FONT_FAMILY, REPERTOIRE } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { checkedPath, needsDecision, type CheckedGame } from './checkedGame';
import { GameCard } from './GameCard';
import { useIgnoredChecks } from './useIgnoredChecks';

export function GameChecksPage() {
  useWorkshopFont();
  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const { ignored, ignore, clear } = useIgnoredChecks();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const repertoires = useMemo(() => repertoiresOf(playedGamesFixture, REPLAY_START), []);
  const lived = useMemo(
    () =>
      playedGamesFixture
        .map((game, id) => ({ id, game }))
        .filter(({ game }) => game.playedAt > REPLAY_FIRST_DAY && game.playedAt <= replay.day)
        .map(({ id, game }): CheckedGame => ({ id, game, check: checkGame(repertoires[game.side], game) })),
    [repertoires, replay.day],
  );
  const today = lived.filter(({ game }) => game.playedAt === replay.day);
  const isPending = (checked: CheckedGame) => needsDecision(checked) && !ignored.has(checked.id);
  // Les parties du jour portent leur propre décision : la liste suivante ne reprend que les jours passés.
  const earlier = lived.filter((checked) => checked.game.playedAt < replay.day && isPending(checked)).reverse();
  const selected = lived.find((checked) => checked.id === selectedId) ?? today[0] ?? null;

  const reset = replay.reset && (() => {
    replay.reset!();
    clear();
    setSelectedId(null);
  });
  const next = replay.next && (() => {
    replay.next!();
    setSelectedId(null);
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
          <CheckBoard checked={selected} repertoires={repertoires} />
          <div className="flex min-w-0 flex-col gap-10">
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
                      onIgnore={isPending(checked) ? () => ignore(checked.id) : undefined}
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

function CheckBoard({ checked, repertoires }: { checked: CheckedGame | null; repertoires: ReturnType<typeof repertoiresOf> }) {
  const path = useMemo(() => (checked ? checkedPath(checked) : []), [checked]);
  const arrows = useMemo((): BoardArrow[] => {
    if (!checked || checked.check.kind === 'followed') return [];
    const fen = replayLine(path).fens[path.length];
    const planned = repertoireMovesAt(repertoires[checked.game.side], fen).map(
      (move): BoardArrow => ({ san: move.san, tone: 'winning', colour: REPERTOIRE, share: 0.5, emphasis: true }),
    );
    return [...planned, { san: checked.check.played, tone: 'losing', colour: COLOURS.terracotta, share: 0.5, emphasis: true }];
  }, [checked, path, repertoires]);

  return (
    <aside aria-label="Position" className="sticky top-6 flex flex-col gap-3 self-start">
      <ArrowBoard path={path} flipped={checked?.game.side === 'b'} arrows={arrows} />
      {checked && checked.check.kind !== 'followed' && (
        <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>red</span> played ·{' '}
          <span className="font-bold" style={{ color: REPERTOIRE }}>green</span> your repertoire
        </p>
      )}
    </aside>
  );
}
