import { MotionConfig } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import type { AddedMove, Addition } from '../domain/addition';
import { figurineMove } from '../domain/notation';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { judgeMove, type Judgement } from '../domain/judgement';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
import { gamesOfLastMonths } from '../domain/period';
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
import { ARROW, COLOURS, FONT_FAMILY, REPERTOIRE } from '../workshop/theme';
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
  const { ignored, ignore, unignore, clear } = useIgnoredChecks();
  const { toast, show, close } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const { repertoires, add, remove, clear: forgetAdditions } = useRepertoires(playedGamesFixture);
  const lived = useMemo(() => liveGames(playedGamesFixture, repertoires, REPLAY_FIRST_DAY, replay.day), [repertoires, replay.day]);
  const today = lived.filter(({ game }) => game.playedAt === replay.day);
  const toDecide = gamesToDecide(lived, ignored, replay.day);
  const settled = today.filter((checked) => !isOpen(checked, ignored));
  const judgementOf = useOpponentJudgements(lived, replay.day);
  const selected = lived.find((checked) => checked.id === selectedId) ?? toDecide[0] ?? today[0] ?? null;
  const adding = lived.find((checked) => checked.id === addingId);
  const habits = useMemo(
    () => (adding ? gamesOfLastMonths(gamesUntil(playedGamesFixture, replay.day), 12, new Date(replay.day)).filter((game) => game.side === adding.game.side) : []),
    [adding, replay.day],
  );

  // Au téléphone l'échiquier est au-dessus de la liste : choisir une partie y ramène.
  const board = useRef<HTMLDivElement>(null);
  const select = (id: number) => {
    setSelectedId(id);
    if (!window.matchMedia?.('(min-width: 1024px)').matches) board.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const startAdding = (checked: CheckedGame) => {
    setSelectedId(checked.id);
    setAddingId(checked.id);
    // Le constructeur s'ouvre en haut de la page : sans ça, le bouton semble ne rien faire.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stopAdding = () => {
    setAddingId(null);
  };
  const accept = (moves: AddedMove[]) => {
    if (adding) {
      const addition: Addition = { side: adding.game.side, addedAt: replay.day, moves };
      add(addition);
      show({ text: `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire`, undo: () => remove(addition) });
    }
    stopAdding();
  };
  // Comme sur l'arbre : garder le coup joué l'ajoute tout de suite ; préparer une réponse demande de la jouer.
  const addPlayed = (checked: CheckedGame) => {
    if (checked.check.kind !== 'left') return startAdding(checked);
    const addition: Addition = { side: checked.game.side, addedAt: replay.day, moves: [{ position: checked.check.position, san: checked.check.played, source: 'habit' }] };
    add(addition);
    // La partie réglée quitte la liste : on passe à la suivante plutôt que de garder un échiquier orphelin.
    setSelectedId(null);
    show({ text: `${figurineMove(checked.check.played, checked.check.ply + 1)} added to your repertoire`, undo: () => remove(addition) });
  };
  const setAside = (checked: CheckedGame) => {
    ignore(checked.id);
    setSelectedId(null);
    show({ text: 'Repertoire unchanged · game set aside', undo: () => unignore([checked.id]) });
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
                To settle{' '}
                <span className="text-[15px] font-semibold" style={{ color: COLOURS.leafSoft }}>
                  · {toDecide.length} {toDecide.length === 1 ? 'game' : 'games'}
                </span>
              </h2>
              {toDecide.length ? (
                <ul className="flex flex-col gap-2">
                  {toDecide.map((checked) => (
                    <GameCard
                      key={checked.id}
                      checked={checked}
                      selected={checked === selected}
                      onSelect={() => select(checked.id)}
                      onIgnore={() => setAside(checked)}
                      onAdd={() => addPlayed(checked)}
                      onBuild={() => startAdding(checked)}
                      showDate={checked.game.playedAt !== replay.day}
                      judgement={judgementOf(checked)}
                    />
                  ))}
                </ul>
              ) : (
                <p style={{ color: COLOURS.leafSoft }}>
                  {replay.index ? 'Nothing to settle.' : 'No game yet: your repertoire was just created. Press “Next day”.'}
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
                      onSelect={() => select(checked.id)}
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
          <ReplayBar replay={{ ...replay, next, reset }} />
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
          <main className="mx-auto flex max-w-[84rem] flex-col gap-6 px-4 pt-6 sm:px-8 lg:grid lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-10 lg:pt-8">
            <div ref={board} className="scroll-mt-4">
              <CheckBoard checked={selected} repertoires={repertoires} judgement={selected ? judgementOf(selected) : undefined} />
            </div>
            <div className="flex min-w-0 flex-col gap-10">{lists}</div>
          </main>
        )}
        <Toast toast={toast} onClose={close} />
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
    return [...planned, { san: checked.check.played, kind: 'neutral', share: 0.5, emphasis: true }];
  }, [checked, checkPath, repertoires, judgement]);

  return (
    <aside aria-label="Position" className="mx-auto flex w-full max-w-[26rem] flex-col gap-3 self-start lg:sticky lg:top-6 lg:max-w-none">
      <ArrowBoard path={path} flipped={checked?.game.side === 'b'} arrows={arrows} />
      {checked?.check.kind === 'left' && (
        <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
          <span className="font-bold" style={{ color: ARROW.neutral.colour }}>dark</span> played instead ·{' '}
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
