import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { PlayableBoard } from '../board/PlayableBoard';
import { BuildSession } from '../checks/BuildSession';
import type { BuildOrigin } from '../checks/useBuilder';
import type { AddedMove } from '../domain/addition';
import { figurineMove } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { Side } from '../domain/playedGame';
import { positionKey } from '../domain/repertoire';
import { acceptedMoves, hasDueAhead, isDue, nextReply, planLine, playerPositions, sessionDone, sessionPositions } from '../domain/review';
import { formatPercent } from '../flame/format';
import { replayLine } from '../position/replay';
import { liveGames } from '../checks/decisions';
import { useSource } from '../source/useSource';
import { useRepertoires } from '../replay/useRepertoires';
import { useStoppedMoves } from '../replay/useStoppedMoves';
import { gamesUntil } from '../domain/replay';
import { useReplayDay } from '../replay/useReplayDay';
import { LineName } from '../workshop/LineName';
import { TaskBar, TaskDone } from '../workshop/Task';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWide } from '../workshop/useWide';
import { BOARD_BESIDE, BOARD_CELL, SIDE_BELOW, SIDE_TOP, TASK_MAIN } from '../workshop/taskLayout';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { useReview } from './useReview';

// Le temps de voir le coup adverse arriver avant de devoir répondre.
const REPLY_DELAY = 450;
const HABIT_MONTHS = 12;
// Une séance touche une dizaine de positions sur des centaines : arrondi à l'unité, le chiffre ne bougerait souvent pas.
const precisePercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

interface Line {
  side: Side;
  /** Le chemin vers la position visée : l'adversaire le suit tant qu'on y reste. */
  plan: readonly string[];
  path: readonly string[];
  status: 'player' | 'opponent' | 'wrong' | 'done';
  expected: readonly string[];
  /** Le dernier coup joué hors du répertoire, que le joueur peut y ajouter. */
  tried?: string;
  missed: number;
}

/** Réviser le répertoire (README, « Path by use », écran 5) : des lignes entières, jouées contre l'application. */
export function ReviewPage() {
  useWorkshopFont();
  // Pas de séance ici : les verdicts du moteur sur les écarts n'y servent pas.
  const source = useSource();
  const replay = useReplayDay(source.games, source.firstDay, source.replay);
  const { repertoires: whole, repertoireOn, add } = useRepertoires(source.games, source.start);
  const known = useMemo(() => gamesUntil(source.games, replay.day), [source.games, replay.day]);
  // Un coup que le joueur ne joue plus attend sa décision hors de la révision.
  const { reviewed: repertoires } = useStoppedMoves(whole, known, source.start);
  const today = replay.today;
  const lived = useMemo(() => liveGames(source.games, repertoireOn, source.firstDay, replay.day), [source, repertoireOn, replay.day]);
  const review = useReview(source.games, repertoires, lived, today, source.start);
  const habits = useMemo(() => gamesOfLastMonths(known, HABIT_MONTHS, new Date(replay.day)), [known, replay.day]);
  const wide = useWide();
  const { toast, show, close } = useToast();
  const [building, setBuilding] = useState<BuildOrigin | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [exhausted, setExhausted] = useState(false);
  // `due` : les positions dues au départ déjà répondues, ce qui fait avancer la séance ; `seen` : toutes celles répondues.
  const [results, setResults] = useState<{ lines: number; due: Set<string>; seen: Set<string>; missed: Set<string> }>({ lines: 0, due: new Set(), seen: new Set(), missed: new Set() });
  const [played, setPlayed] = useState<Record<Side, (readonly string[])[]>>({ w: [], b: [] });
  const due = review.due.w + review.due.b;
  // Les positions que Home a comptées : une ligne prolongée au-delà n'en fait pas avancer la séance.
  const [dueAtStart] = useState(() => new Set((['w', 'b'] as const).flatMap((side) => playerPositions(repertoires[side]).filter(({ key }) => isDue(review.state[side], key, today)).map(({ key }) => key))));
  const planned = sessionPositions(dueAtStart.size);
  const [knownBefore] = useState(review.known);

  const start = () => {
    const plans = (['w', 'b'] as const).flatMap((side) => {
      const plan = planLine(repertoires[side], review.state[side], today, review.weight(side), played[side]);
      return plan ? [{ side, ...plan }] : [];
    });
    plans.sort((a, b) => b.weight - a.weight || review.due[b.side] - review.due[a.side]);
    const chosen = plans[0];
    if (!chosen) {
      // Plus rien de dû avant la fin prévue : la séance s'arrête là, avec son bilan.
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
      const next: Line = { ...line, path, status: goesOn ? 'player' : 'done' };
      setLine(next);
      if (!goesOn) count(next);
    }, REPLY_DELAY);
    return () => window.clearTimeout(timer);
    // Seul un nouveau tour de l'adversaire relance la réponse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const count = (ended: Line) => {
    setResults((current) => ({ ...current, lines: current.lines + 1 }));
    setPlayed((current) => ({ ...current, [ended.side]: [...current[ended.side], ended.path] }));
  };
  const finish = (ended: Line) => {
    setLine({ ...ended, status: 'done' });
    count(ended);
  };

  const play = (san: string) => {
    if (!line || (line.status !== 'player' && line.status !== 'wrong')) return;
    const repertoire = repertoires[line.side];
    const accepted = acceptedMoves(repertoire, fen);
    const key = positionKey(fen);
    const right = accepted.includes(san);
    if (line.status === 'player') {
      setResults((current) => ({ ...current, seen: new Set(current.seen).add(key), due: dueAtStart.has(key) ? new Set(current.due).add(key) : current.due }));
    }
    if (!right) {
      // L'échiquier a déjà joué le coup : un nouveau chemin, identique, le ramène à la position.
      setLine({ ...line, path: [...line.path], status: 'wrong', expected: accepted, tried: san });
      return;
    }
    // L'oubli ne compte qu'une fois le coup du répertoire rejoué : jusque-là, le joueur peut encore changer sa
    // préparation. Une seule erreur compte par position, les essais suivants n'en sont pas.
    const missed = line.status === 'wrong';
    review.answer(line.side, key, !missed);
    if (missed) setResults((current) => ({ ...current, missed: new Set(current.missed).add(key) }));
    setLine({ ...line, path: [...line.path, san], status: 'opponent', expected: [], tried: undefined, missed: line.missed + (missed ? 1 : 0) });
  };

  const changePrep = () => {
    if (!line?.tried) return;
    setBuilding({ side: line.side, start: line.path, given: [], played: line.tried, keep: true });
  };

  // Le coup ajouté à la position est la réponse du joueur, pas un oubli : la ligne continue par lui.
  const accept = (moves: AddedMove[]) => {
    setBuilding(null);
    if (!line || !moves.length) return;
    add({ side: line.side, addedAt: replay.day, moves });
    show({ text: `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire` });
    const key = positionKey(fen);
    const chosen = moves.find((move) => move.position === key)?.san;
    if (!chosen) return;
    review.answer(line.side, key, true);
    setLine({ ...line, path: [...line.path, chosen], status: 'opponent', expected: [], tried: undefined });
  };

  const sessionOver = exhausted || sessionDone(results.due.size, planned, line?.status === 'done');
  const arrows = line?.status === 'wrong' ? line.expected.map((san) => ({ san, share: 1, kind: 'repertoire' as const })) : [];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-16" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <TaskBar title="Review" progress={sessionOver ? 'done' : line ? `${Math.min(results.due.size, planned)} of ${planned} positions · as ${line.side === 'w' ? 'White' : 'Black'}` : undefined} />
        <main className={TASK_MAIN}>
          {opened && !line && !sessionOver && (
            <TaskDone title="Nothing to review today">
              <p>Come back tomorrow, or after your next games.</p>
              <p>Repertoire known: {formatPercent(review.known)}</p>
            </TaskDone>
          )}
          {line && building && (
            <BuildSession
              origin={building}
              games={habits.filter((game) => game.side === line.side)}
              repertoire={repertoires[line.side]}
              onAccept={accept}
              onCancel={() => setBuilding(null)}
              stacked={!wide}
              nested
            />
          )}
          {line && !building && !(sessionOver && line.status === 'done') && (
            <div className={BOARD_BESIDE}>
              <div className={SIDE_TOP}>
                <LineName path={line.path} wrap />
              </div>
              <div className={`-mx-2 lg:mx-0 ${BOARD_CELL}`}>
                <PlayableBoard path={line.path} flipped={line.side === 'b'} arrows={arrows} onMove={play} />
              </div>
              <div className={SIDE_BELOW}>
                <Prompt line={line} onNext={sessionOver ? undefined : start} onChangePrep={changePrep} />
              </div>
            </div>
          )}
          {sessionOver && line?.status === 'done' && (
            <TaskDone title={`${results.seen.size - results.missed.size} of ${results.seen.size} positions right`}>
              <p>{results.missed.size ? `${results.missed.size} ${results.missed.size === 1 ? 'position' : 'positions'} to see again tomorrow` : 'Nothing missed'}</p>
              <p>
                Repertoire known: {precisePercent(knownBefore)} → <strong>{precisePercent(review.known)}</strong>
              </p>
            </TaskDone>
          )}
        </main>
        <Toast toast={toast} onClose={close} />
      </div>
    </MotionConfig>
  );
}

function Prompt({ line, onNext, onChangePrep }: { line: Line; onNext?: () => void; onChangePrep: () => void }) {
  const ply = line.path.length + 1;
  if (line.status === 'wrong') {
    return (
      <div className="flex flex-col gap-1.5">
        <p role="status" className="rounded-2xl px-4 py-3 text-[16px] font-bold" style={{ background: COLOURS.terracotta, color: 'white' }}>
          Not your move here · play {line.expected.map((san) => figurineMove(san, ply)).join(' or ')}
        </p>
        {line.tried && (
          <button type="button" onClick={onChangePrep} className="self-start rounded-lg px-1 py-1.5 text-[14px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
            I play {figurineMove(line.tried, ply)} now: add it to my repertoire →
          </button>
        )}
      </div>
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
