import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { figurineLine, figurineMove } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import { positionKey } from '../domain/repertoire';
import { acceptedMoves, hasDueAhead, nextReply, planLine } from '../domain/review';
import { replayLine } from '../position/replay';
import { liveGames } from '../checks/decisions';
import { useSource } from '../source/useSource';
import { useRepertoires } from '../replay/useRepertoires';
import { useReplayDay } from '../replay/useReplayDay';
import { TaskBar, TaskDone } from '../workshop/Task';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { REVIEW_LINES as LINES, useReview } from './useReview';

// Le temps de voir le coup adverse arriver avant de devoir répondre.
const REPLY_DELAY = 450;

interface Line {
  side: Side;
  /** Le chemin vers la position visée : l'adversaire le suit tant qu'on y reste. */
  plan: readonly string[];
  path: readonly string[];
  status: 'player' | 'opponent' | 'wrong' | 'done';
  expected: readonly string[];
  missed: number;
}

/** Réviser le répertoire (README, « Path by use », écran 5) : des lignes entières, jouées contre l'application. */
export function ReviewPage() {
  useWorkshopFont();
  // Pas de séance ici : les verdicts du moteur sur les écarts n'y servent pas.
  const source = useSource();
  const replay = useReplayDay(source.games, source.firstDay, source.replay);
  const { repertoires } = useRepertoires(source.games, source.start);
  const today = replay.day;
  const lived = useMemo(() => liveGames(source.games, repertoires, source.firstDay, today), [source, repertoires, today]);
  const review = useReview(source.games, repertoires, lived, today, source.start);
  const [line, setLine] = useState<Line | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [results, setResults] = useState<{ clean: number; lines: number; missed: Set<string> }>({ clean: 0, lines: 0, missed: new Set() });
  const due = review.due.w + review.due.b;

  const start = () => {
    const plans = (['w', 'b'] as const).flatMap((side) => {
      const plan = planLine(repertoires[side], review.state[side], today, review.weight(side));
      return plan ? [{ side, ...plan }] : [];
    });
    plans.sort((a, b) => b.weight - a.weight || review.due[b.side] - review.due[a.side]);
    const chosen = plans[0];
    if (!chosen) {
      // Plus rien de dû avant la cinquième ligne : la séance s'arrête là, avec son bilan.
      if (results.lines) setExhausted(true);
      else setLine(null);
      return;
    }
    const fen = replayLine(chosen.autoplayed).fens.at(-1)!;
    setLine({ side: chosen.side, plan: chosen.path, path: chosen.autoplayed, status: fen.split(' ')[1] === chosen.side ? 'player' : 'opponent', expected: [], missed: 0 });
  };

  const fen = useMemo(() => (line ? replayLine(line.path).fens.at(-1)! : ''), [line]);
  // La tâche commence tout de suite : « Review » sur Home vaut « Start ».
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (due) start();
    setOpened(true);
    // Une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // L'adversaire suit le chemin vers la position visée, puis la réponse qui mène au plus de révisions dues.
  useEffect(() => {
    if (!line || line.status !== 'opponent') return;
    const timer = window.setTimeout(() => {
      const repertoire = repertoires[line.side];
      const onPlan = line.path.length < line.plan.length && line.path.every((san, index) => line.plan[index] === san);
      const reply = onPlan ? line.plan[line.path.length] : nextReply(repertoire, fen, review.state[line.side], today, review.weight(line.side));
      if (!reply) return finish(line);
      const path = [...line.path, reply];
      const reached = replayLine(path).fens.at(-1)!;
      const goesOn = acceptedMoves(repertoire, reached).length > 0 && hasDueAhead(repertoire, reached, review.state[line.side], today);
      setLine(goesOn ? { ...line, path, status: 'player' } : { ...line, path, status: 'done' });
      if (!goesOn) count(line);
    }, REPLY_DELAY);
    return () => window.clearTimeout(timer);
    // Seul un nouveau tour de l'adversaire relance la réponse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const count = (ended: Line) =>
    setResults((current) => ({ ...current, lines: current.lines + 1, clean: current.clean + (ended.missed ? 0 : 1) }));
  const finish = (ended: Line) => {
    setLine({ ...ended, status: 'done' });
    count(ended);
  };

  const play = (san: string) => {
    if (!line || (line.status !== 'player' && line.status !== 'wrong')) return;
    const repertoire = repertoires[line.side];
    const accepted = acceptedMoves(repertoire, fen);
    const key = positionKey(fen);
    if (!accepted.includes(san)) {
      // L'échiquier a déjà joué le coup : un nouveau chemin, identique, le ramène à la position.
      const path = [...line.path];
      // Une seule erreur compte par position : la suivante n'est qu'un nouvel essai.
      if (line.status === 'player') {
        review.answer(line.side, key, false);
        setResults((current) => ({ ...current, missed: new Set(current.missed).add(key) }));
        setLine({ ...line, path, status: 'wrong', expected: accepted, missed: line.missed + 1 });
      } else setLine({ ...line, path });
      return;
    }
    if (line.status === 'player') review.answer(line.side, key, true);
    setLine({ ...line, path: [...line.path, san], status: 'opponent', expected: [] });
  };

  const sessionOver = results.lines >= LINES || exhausted;
  const arrows = line?.status === 'wrong' ? line.expected.map((san) => ({ san, share: 1, kind: 'repertoire' as const })) : [];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-16" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <TaskBar title="Review" progress={sessionOver ? 'done' : line ? `line ${Math.min(results.lines + 1, LINES)} of ${LINES} · as ${line.side === 'w' ? 'White' : 'Black'}` : undefined} />
        <main className="mx-auto flex max-w-[30rem] flex-col gap-3 px-4 pt-4">
          {opened && !line && !sessionOver && (
            <TaskDone title="Nothing to review today">
              <p>Come back tomorrow, or after your next games.</p>
            </TaskDone>
          )}
          {line && !(sessionOver && line.status === 'done') && (
            <>
              <LineName path={line.path} />
              <div className="-mx-2">
                <PlayableBoard path={line.path} flipped={line.side === 'b'} arrows={arrows} onMove={play} />
              </div>
              <Prompt line={line} onNext={results.lines < LINES ? start : undefined} />
            </>
          )}
          {sessionOver && line?.status === 'done' && (
            <TaskDone title={`${results.clean} of ${results.lines} lines clean`}>
              <p>{results.missed.size ? `${results.missed.size} ${results.missed.size === 1 ? 'position' : 'positions'} to see again tomorrow` : 'Nothing missed'}</p>
            </TaskDone>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}

function LineName({ path }: { path: readonly string[] }) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  return (
    <div className="flex min-w-0 flex-col px-1">
      <span className="text-[16px] font-bold leading-tight">{opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}</span>
      <span className="truncate text-[14px]" style={{ color: COLOURS.leafSoft }}>
        {path.length ? figurineLine(path) : '—'}
      </span>
    </div>
  );
}

function Prompt({ line, onNext }: { line: Line; onNext?: () => void }) {
  const ply = line.path.length + 1;
  if (line.status === 'wrong') {
    return (
      <p role="status" className="rounded-2xl px-4 py-3 text-[16px] font-bold" style={{ background: COLOURS.terracotta, color: 'white' }}>
        Not your move here · play {line.expected.map((san) => figurineMove(san, ply)).join(' or ')}
      </p>
    );
  }
  if (line.status === 'done') {
    return (
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={raised(false)}>
        <span role="status" className="flex-1 text-[16px] font-bold" style={{ color: line.missed ? COLOURS.terracotta : REPERTOIRE }}>
          {line.missed ? `${line.missed} to see again tomorrow` : 'Line clean ✓'}
        </span>
        {onNext && <Primary onClick={onNext}>Next line</Primary>}
      </div>
    );
  }
  return (
    <p role="status" className="rounded-2xl px-4 py-3 text-[16px] font-bold" style={tile(COLOURS.paper)}>
      {line.status === 'player' ? 'Your move' : 'Their move…'}
    </p>
  );
}

function Primary({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }} transition={SPRING} className="rounded-full px-5 py-2.5 text-[15px] font-bold focus-visible:outline-2" style={raised(true)}>
      {children}
    </motion.button>
  );
}
