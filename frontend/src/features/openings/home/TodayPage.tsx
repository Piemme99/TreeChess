import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useOpeningTable } from '../../../shared/hooks/useOpeningName';
import { resolveOpening, type OpeningTable } from '../../../shared/utils/openings';
import type { CheckedGame } from '../checks/checkedGame';
import { JUDGEMENT_MARK } from '../domain/judgement';
import { figurineLine, figurineMove } from '../domain/notation';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, type Priority } from '../domain/priorities';
import { playerPositions } from '../domain/review';
import { adherence, isThrough, type Adherence } from '../domain/worked';
import { playedGamesFixture } from '../fixtures/playedGames';
import { replayLine } from '../position/replay';
import { formatShortDay } from '../replay/formatDay';
import { ReplayBar } from '../replay/ReplayBar';
import { useWorkedLines, type WorkedLine } from '../replay/useWorkedLines';
import { useReview } from '../review/useReview';
import type { SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { useV2Path } from '../workshop/routes';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile, ZOOM } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { ImportScreen } from './ImportScreen';
import { useImported } from './useImported';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;
const SHOWN_PRIORITIES = 3;

/** Ce qui attend le joueur (README, « Path by use ») : une carte en avant, la plus urgente, le reste en lignes. */
export function TodayPage() {
  useWorkshopFont();
  const [imported, setImported] = useImported();
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-20" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        {imported ? <Today onForget={() => setImported(false)} /> : <ImportScreen onDone={() => setImported(true)} />}
      </div>
    </MotionConfig>
  );
}

function Today({ onForget }: { onForget: () => void }) {
  const pathOf = useV2Path();
  const { replay, known, lived, repertoires, steps, judging, forgetIgnored, forgetAdditions } = useReplayedSession();
  const review = useReview(playedGamesFixture, repertoires, lived, replay.day);
  const { worked, clear: forgetWorked } = useWorkedLines();
  const table = useOpeningTable();
  const priorities = usePriorities(known, replay.day);
  const { toast, show, close } = useToast();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const done = params.get('done');
    if (done === null) return;
    show({ text: `Check done · ${done} settled` });
    setParams({}, { replace: true });
  }, [params, setParams, show]);

  const reset = replay.reset && (() => {
    replay.reset!();
    forgetIgnored();
    forgetAdditions();
    forgetWorked();
    review.forget();
    onForget();
  });

  const tree = pathOf('tree');
  const workOn = (line: { side: Side; path: readonly string[] }) => `${tree}?from=today&side=${line.side}&line=${encodeURIComponent(line.path.join(' '))}`;
  const checkHref = `${tree}?from=today&session=1`;
  const dayGames = replay.index ? lived.filter(({ game }) => game.playedAt === replay.day) : [];
  const stepOf = (checked: CheckedGame) => steps.find((step) => step.games.some((game) => game.id === checked.id));
  const openToday = dayGames.filter(stepOf).length;
  const waiting = steps.length;
  const due = review.due.w + review.due.b;
  const workedOf = (priority: { side: Side; path: readonly string[] }) => worked.find((line) => line.side === priority.side && line.path.join(' ') === priority.path.join(' '));

  const hero: 'first' | 'games' | 'review' | 'work' = !replay.index ? 'first' : openToday ? 'games' : due ? 'review' : 'work';

  return (
    <>
      <PageHeader>
        <ReplayBar replay={{ ...replay, reset }} />
      </PageHeader>
      <main className="mx-auto flex max-w-[34rem] flex-col gap-4 px-4 pt-5">
        {hero === 'first' && (
          <Hero title="Where you lose points" facts={<Facts games={known.length} repertoires={repertoires} />}>
            <PriorityList priorities={priorities.slice(0, SHOWN_PRIORITIES)} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          </Hero>
        )}
        {hero === 'games' && (
          <Hero title={`${dayGames.length} new ${dayGames.length === 1 ? 'game' : 'games'}`} facts={judging ? 'The engine is judging your moves…' : `${waiting} to settle${waiting > openToday ? `, ${waiting - openToday} from earlier days` : ''}`}>
            <ul className="flex flex-col">
              {dayGames.map((checked) => (
                <GameLine key={checked.id} checked={checked} step={stepOf(checked)} table={table} worked={worked} lived={lived} />
              ))}
            </ul>
            <Action to={checkHref}>Check them</Action>
          </Hero>
        )}
        {hero === 'review' && (
          <Hero title={`${due} ${due === 1 ? 'position' : 'positions'} to review`} facts={`${review.due.w} as White · ${review.due.b} as Black`}>
            <Action to={pathOf('review')}>Review</Action>
          </Hero>
        )}
        {hero === 'work' && priorities[0] && (
          <Hero title="Work on your weakest opening" facts="Nothing to check, nothing due">
            <PriorityList priorities={priorities.slice(0, 1)} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          </Hero>
        )}

        <ul className="flex flex-col gap-2">
          {hero !== 'games' && dayGames.length > 0 && <Row label="Today's games" figure={`${dayGames.length} checked ✓`} />}
          {hero !== 'games' && waiting > 0 && <Row label="To settle" figure={`${waiting} waiting`} to={checkHref} />}
          {hero !== 'review' && due > 0 && <Row label="Review" figure={`${due} due`} to={pathOf('review')} />}
          {hero !== 'first' && priorities.length > 0 && (
            <WeakOpenings priorities={priorities} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          )}
        </ul>
        <Link to={pathOf('openings')} className="hidden self-start text-[14px] font-semibold underline-offset-4 hover:underline sm:inline" style={{ color: COLOURS.leafSoft }}>
          All your openings by result →
        </Link>
      </main>
      <Toast toast={toast} onClose={close} />
    </>
  );
}

function usePriorities(known: readonly PlayedGame[], day: string): Priority[] {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]): Record<Side, OpeningTree> => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    return findPriorities(trees(known), trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day))), MAX_PRIORITIES);
  }, [known, day]);
}

function Facts({ games, repertoires }: { games: number; repertoires: ReturnType<typeof useReplayedSession>['repertoires'] }) {
  const counts = useMemo(() => ({ w: playerPositions(repertoires.w).length, b: playerPositions(repertoires.b).length }), [repertoires]);
  return (
    <>
      {games.toLocaleString('en-GB')} games · your repertoire: {counts.w} positions as White, {counts.b} as Black
    </>
  );
}

function Hero({ title, facts, children }: { title: string; facts: ReactNode; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex flex-col gap-3 rounded-3xl p-5" style={raised(false)}>
      <span className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
        <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {facts}
        </span>
      </span>
      {children}
    </motion.section>
  );
}

function Action({ to, children }: { to: string; children: string }) {
  return (
    <motion.span whileTap={{ scale: 0.97 }} transition={SPRING} className="self-start">
      <Link to={to} className="inline-block rounded-full px-5 py-2.5 text-[15px] font-bold focus-visible:outline-2" style={raised(true)}>
        {children}
      </Link>
    </motion.span>
  );
}

function Row({ label, figure, to }: { label: string; figure: string; to?: string }) {
  const body = (
    <>
      <span className="shrink-0 font-bold">{label}</span>
      <span className="ml-auto tabular-nums" style={{ color: COLOURS.leafSoft }}>
        {figure}
      </span>
      {to && <span aria-hidden="true">→</span>}
    </>
  );
  const className = 'flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[15px] focus-visible:outline-2';
  return <li>{to ? <Link to={to} className={className} style={tile(COLOURS.paper)}>{body}</Link> : <span className={className}>{body}</span>}</li>;
}

const openingName = (table: OpeningTable | null, path: readonly string[]) => (table ? resolveOpening(replayLine(path).fens, table)?.name : undefined) ?? 'Unnamed line';

function PriorityList({ priorities, table, href, workedOf, lived }: {
  priorities: readonly Priority[];
  table: OpeningTable | null;
  href: (line: Priority) => string;
  workedOf: (line: Priority) => WorkedLine | undefined;
  lived: readonly CheckedGame[];
}) {
  const heaviest = Math.max(...priorities.map((priority) => priority.pointsToGain), 1);
  return (
    <ol className="flex flex-col">
      {priorities.map((priority, index) => {
        const line = workedOf(priority);
        return (
          <li key={`${priority.side} ${priority.path.join(' ')}`} className="flex flex-col gap-1.5 py-3" style={{ borderTop: index ? `1px solid ${COLOURS.sand}` : undefined }}>
            <span className="flex items-baseline gap-2">
              <span className="text-[16px] font-bold leading-tight">{openingName(table, priority.path)}</span>
              <span className="ml-auto whitespace-nowrap text-[13px] font-semibold" style={{ color: COLOURS.terracotta }}>
                −{Math.round(priority.pointsToGain)} pts
              </span>
            </span>
            <span className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
              {priority.side === 'w' ? 'White' : 'Black'} · {figurineLine(priority.path)} · {priority.games} games
            </span>
            <span className="h-1.5 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
              <motion.span className="block h-full rounded-full" style={{ background: COLOURS.terracotta }} initial={{ width: 0 }} animate={{ width: `${(priority.pointsToGain / heaviest) * 100}%` }} transition={ZOOM} />
            </span>
            <span className="flex items-center gap-3">
              {line && <WorkedTag line={line} adherence={adherence(lived, line)} />}
              <Link to={href(priority)} className="ml-auto rounded-full px-4 py-2 text-[14px] font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
                Work on it
              </Link>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WorkedTag({ line, adherence: { followed, games } }: { line: WorkedLine; adherence: Adherence }) {
  return (
    <span className="text-[13px] font-semibold" style={{ color: REPERTOIRE }}>
      Worked {formatShortDay(line.since)}
      {games ? ` · prep followed ${followed} of ${games}` : ' · no game since'}
    </span>
  );
}

function WeakOpenings(props: Parameters<typeof PriorityList>[0]) {
  const [open, setOpen] = useState(false);
  const first = props.priorities[0];
  return (
    <li className="flex flex-col rounded-2xl" style={tile(COLOURS.paper)}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 items-center gap-3 px-4 text-left text-[15px] focus-visible:outline-2">
        <span className="shrink-0 font-bold">Weak openings</span>
        <span className="ml-auto min-w-0 truncate" style={{ color: COLOURS.leafSoft }}>
          {open ? `${props.priorities.length}` : `${openingName(props.table, first.path)} −${Math.round(first.pointsToGain)} pts`}
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-4 pb-1">
          <PriorityList {...props} />
        </div>
      )}
    </li>
  );
}

/** Une partie du jour en une ligne : préparation suivie, écart du joueur, ou ligne nouvelle de l'adversaire. */
function GameLine({ checked, step, table, worked, lived }: { checked: CheckedGame; step?: SessionStep; table: OpeningTable | null; worked: readonly WorkedLine[]; lived: readonly CheckedGame[] }) {
  const { game, check } = checked;
  const reached = check.kind === 'followed' ? check.plies : check.ply + 1;
  const name = openingName(table, game.moves.slice(0, Math.max(reached, 2)));
  const line = worked.find((candidate) => candidate.side === game.side && game.playedAt > candidate.since && isThrough(game, candidate.path));
  const mark = check.kind === 'left' && step?.verdict?.judgement ? JUDGEMENT_MARK[step.verdict.judgement] : '';
  const [icon, colour, text] =
    check.kind === 'followed'
      ? ['✓', REPERTOIRE, check.plies ? `prep followed to move ${Math.ceil(check.plies / 2)}` : 'no prep here']
      : check.kind === 'left'
        ? ['✗', COLOURS.terracotta, `you played ${figurineMove(check.played, check.ply + 1)}${mark}, not ${figurineMove(check.planned[0], check.ply + 1)}`]
        : ['?', COLOURS.kumquatDeep, `new line ${figurineMove(check.played, check.ply + 1)}`];
  return (
    <li className="flex flex-col py-2" style={{ borderTop: `1px solid ${COLOURS.sand}` }}>
      <span className="flex items-baseline gap-2 text-[15px]">
        <span aria-hidden="true" className="w-4 shrink-0 font-extrabold" style={{ color: colour }}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="font-bold">{name}</span> <span style={{ color: COLOURS.leafSoft }}>· {game.side === 'w' ? 'White' : 'Black'} · {game.score === 1 ? 'won' : game.score === 0 ? 'lost' : 'draw'}</span>
          <span className="block text-[14px]">
            {text}
            {check.kind !== 'followed' && !step && <span style={{ color: COLOURS.leafSoft }}> · nothing to do</span>}
          </span>
          {line && <WorkedTag line={line} adherence={adherence(lived, line)} />}
        </span>
      </span>
    </li>
  );
}

