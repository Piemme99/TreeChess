import { MotionConfig } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { AddedMove } from '../domain/addition';
import { judgeMove, type Judgement } from '../domain/judgement';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import { gamesUntil } from '../domain/replay';
import { useEvaluations } from '../line/engine';
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
import { gamesToDecide, isOpen, liveGames } from './decisions';
import { BuildSession } from './BuildSession';
import { originOf } from './useBuilder';
import { GameCard } from './GameCard';
import { useIgnoredChecks } from './useIgnoredChecks';

export function GameChecksPage() {
  useWorkshopFont();
  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const { ignored, ignore, clear } = useIgnoredChecks();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const { repertoires, add, clear: forgetAdditions } = useRepertoires(playedGamesFixture);
  const lived = useMemo(() => liveGames(playedGamesFixture, repertoires, REPLAY_FIRST_DAY, replay.day), [repertoires, replay.day]);
  const today = lived.filter(({ game }) => game.playedAt === replay.day);
  const toDecide = gamesToDecide(lived, ignored, replay.day);
  const settled = today.filter((checked) => !isOpen(checked, ignored));
  const judgementOf = useOpponentJudgements(lived, replay.day);
  const selected = lived.find((checked) => checked.id === selectedId) ?? toDecide[0] ?? today[0] ?? null;
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

  const lists = (
    <>
            <section aria-labelledby="decide-title" className="flex flex-col gap-3">
              <h2 id="decide-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
                To decide <span className="text-[15px] font-semibold" style={{ color: COLOURS.leafSoft }}>{toDecide.length}</span>
              </h2>
              {toDecide.length ? (
                <ul className="flex flex-col gap-2">
                  {toDecide.map((checked) => (
                    <GameCard
                      key={checked.id}
                      checked={checked}
                      selected={checked === selected}
                      onSelect={() => setSelectedId(checked.id)}
                      onIgnore={() => ignore(checked.id)}
                      onAdd={() => startAdding(checked)}
                      showDate={checked.game.playedAt !== replay.day}
                      judgement={judgementOf(checked)}
                    />
                  ))}
                </ul>
              ) : (
                <p style={{ color: COLOURS.leafSoft }}>
                  {replay.index ? 'Nothing to decide.' : 'No game yet: your repertoire was just created. Press “Next day”.'}
                </p>
              )}
            </section>
            {settled.length > 0 && (
              <section aria-labelledby="day-title" className="flex flex-col gap-3">
                <h2 id="day-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
                  Rest of the day
                </h2>
                <ul className="flex flex-col gap-2">
                  {settled.map((checked) => (
                    <GameCard
                      key={checked.id}
                      checked={checked}
                      selected={checked === selected}
                      onSelect={() => setSelectedId(checked.id)}
                      ignored={ignored.has(checked.id)}
                      judgement={judgementOf(checked)}
                    />
                  ))}
                </ul>
              </section>
            )}
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-28" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <span className="ml-auto">
            <ReplayBar replay={{ ...replay, next, reset }} />
          </span>
        </PageHeader>
        {adding && adding.check.kind !== 'followed' ? (
          <BuildSession
            key={adding.id}
            origin={originOf({ ...adding, check: adding.check })}
            games={habits}
            repertoire={repertoires[adding.game.side]}
            onAccept={accept}
            onCancel={stopAdding}
          >
            {lists}
          </BuildSession>
        ) : (
          <main className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
            <CheckBoard checked={selected} repertoires={repertoires} judgement={selected ? judgementOf(selected) : undefined} />
            <div className="flex min-w-0 flex-col gap-10">{lists}</div>
          </main>
        )}
      </div>
    </MotionConfig>
  );
}

interface CheckBoardProps {
  checked: CheckedGame | null;
  repertoires: Record<CheckedGame['game']['side'], Repertoire>;
  judgement: Judgement | null | undefined;
}

function CheckBoard({ checked, repertoires, judgement }: CheckBoardProps) {
  const checkPath = useMemo(() => (checked ? checkedPath(checked) : []), [checked]);
  const path = checkPath;
  const arrows = useMemo((): BoardArrow[] => {
    if (!checked || checked.check.kind === 'followed') return [];
    if (checked.check.kind === 'uncovered') {
      const costly = judgement === 'mistake' || judgement === 'blunder';
      return [{ san: checked.check.played, kind: costly ? 'costly' : 'neutral', share: 0.5, emphasis: true }];
    }
    const fen = replayLine(checkPath).fens[checkPath.length];
    const planned = repertoireMovesAt(repertoires[checked.game.side], fen).map(
      (move): BoardArrow => ({ san: move.san, kind: 'repertoire', share: 0.5 }),
    );
    return [...planned, { san: checked.check.played, kind: 'costly', share: 0.5 }];
  }, [checked, checkPath, repertoires, judgement]);

  return (
    <aside aria-label="Position" className="sticky top-6 flex flex-col gap-3 self-start">
      <ArrowBoard path={path} flipped={checked?.game.side === 'b'} arrows={arrows} />
      {checked?.check.kind === 'left' && (
        <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>red</span> played ·{' '}
          <span className="font-bold" style={{ color: REPERTOIRE }}>green</span> your repertoire
        </p>
      )}
    </aside>
  );
}

const JUDGED_DEPTH = 12;

/**
 * Ce que vaut chaque coup adverse hors répertoire, selon Stockfish : `undefined` tant que le moteur cherche.
 * Seuls les coups montrés sont évalués : ceux du jour et ceux qui attendent une décision.
 */
function useOpponentJudgements(lived: readonly CheckedGame[], day: string) {
  const judged = useMemo(
    () =>
      lived.flatMap((checked) => {
        if (checked.check.kind !== 'uncovered' || (checked.game.playedAt !== day && !checked.asks)) return [];
        const fens = replayLine(checked.game.moves.slice(0, checked.check.ply + 1)).fens;
        return [{ id: checked.id, before: fens[checked.check.ply], after: fens[checked.check.ply + 1] }];
      }),
    [lived, day],
  );
  const fens = useMemo(() => judged.flatMap(({ before, after }) => [before, after]), [judged]);
  const evaluations = useEvaluations(fens, JUDGED_DEPTH);

  return (checked: CheckedGame): Judgement | null | undefined => {
    const entry = judged.find(({ id }) => id === checked.id);
    const before = entry && evaluations.get(entry.before);
    const after = entry && evaluations.get(entry.after);
    if (!before || !after) return undefined;
    return judgeMove(before.cp, after.cp, checked.game.side === 'w' ? 'b' : 'w');
  };
}
