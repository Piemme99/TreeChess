import { MotionConfig, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useOpeningTable } from '../../../shared/hooks/useOpeningName';
import { resolveOpening, type OpeningTable } from '../../../shared/utils/openings';
import type { CheckedGame } from '../checks/checkedGame';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK } from '../domain/judgement';
import { figurineLine, figurineMove } from '../domain/notation';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, shownLine, type Priority } from '../domain/priorities';
import { playerPositions } from '../domain/review';
import { adherence, isThrough, splitWorked, type Adherence } from '../domain/worked';
import { replayLine } from '../position/replay';
import { formatShortDay } from '../replay/formatDay';
import { useWorkedLines, type WorkedLine } from '../replay/useWorkedLines';
import { REVIEW_LINES, useReview } from '../review/useReview';
import type { SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { useV2Path } from '../workshop/routes';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile, ZOOM } from '../workshop/theme';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { homeHero } from './hero';
import { ImportScreen, SignInScreen } from './ImportScreen';
import { SourceProvider } from '../source/SourceContext';
import { useGameSource } from '../source/useGameSource';
import { PageSkeleton } from '../workshop/PageSkeleton';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;
const SHOWN_PRIORITIES = 3;

/** Ce qui attend le joueur (docs/flow/target.html) : une carte en avant, la plus urgente, les autres tâches en lignes. */
export function HomePage() {
  useWorkshopFont();
  const { state, syncing, startImport, tryDemo, leaveDemo } = useGameSource();
  if (state.kind === 'loading') return <PageSkeleton />;
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-20" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        {state.kind === 'signed-out' && <SignInScreen onDemo={tryDemo} />}
        {state.kind === 'to-import' && <ImportScreen username={state.username} state={state.state} onImport={() => void startImport()} />}
        {state.kind === 'ready' && (
          <SourceProvider source={state.source}>
            <Home onForget={leaveDemo} syncing={syncing} />
          </SourceProvider>
        )}
      </div>
    </MotionConfig>
  );
}

function Home({ onForget, syncing }: { onForget: () => void; syncing: boolean }) {
  const pathOf = useV2Path();
  const { source, replay, known, lived, repertoires, reviewed, stopped, steps, judging, forgetIgnored, forgetAdditions } = useReplayedSession();
  const review = useReview(source.games, reviewed, lived, replay.today, source.start);
  const { worked, clear: forgetWorked } = useWorkedLines();
  const table = useOpeningTable();
  const priorities = usePriorities(known, replay.day);
  const { toWork, treated } = useMemo(() => splitWorked(priorities, worked, known, MAX_PRIORITIES), [priorities, worked, known]);
  const { toast, close } = useToast();

  const reset = replay.reset && (() => {
    replay.reset!();
    forgetIgnored();
    forgetAdditions();
    forgetWorked();
    review.forget();
    onForget();
  });

  const tree = pathOf('tree');
  const workOn = (priority: Priority) => `${tree}?task=weak&side=${priority.side}&line=${encodeURIComponent(shownLine(priority).join(' '))}`;
  const checkHref = `${tree}?task=check`;
  const dayGames = replay.index ? lived.filter(({ game }) => game.playedAt === replay.day) : [];
  const stepOf = (checked: CheckedGame) => steps.find((step) => step.games.some((game) => game.id === checked.id));
  const openToday = dayGames.filter(stepOf).length;
  const waiting = steps.length;
  const due = review.due.w + review.due.b;
  const lines = `${REVIEW_LINES} lines`;
  const repertoireKnown = `${formatPercent(review.known)} of your repertoire known`;
  const workedOf = (priority: { side: Side; path: readonly string[] }) => worked.find((line) => line.side === priority.side && line.path.join(' ') === priority.path.join(' '));

  const hero = homeHero({ firstDay: !replay.index, gamesToSettle: openToday, linesDue: due, weakToWork: toWork.length });
  const inHero = hero === 'first' ? SHOWN_PRIORITIES : hero === 'work' ? 1 : 0;
  const moreToWork = toWork.slice(inHero);

  return (
    <>
      <PageHeader replay={{ ...replay, reset }} />
      <main className="mx-auto flex max-w-[34rem] flex-col gap-4 px-4 pt-5 lg:grid lg:max-w-[84rem] lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6 lg:px-8">
        {syncing && (
          <p role="status" className="-mb-2 px-1 text-[13px] font-semibold lg:col-span-2" style={{ color: COLOURS.leafSoft }}>
            Looking for new games on Lichess…
          </p>
        )}
        {hero === 'first' && (
          <Hero title="Weak openings" facts={<Facts games={known.length} repertoires={repertoires} />}>
            <PriorityList priorities={toWork.slice(0, inHero)} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          </Hero>
        )}
        {hero === 'games' && (
          <Hero title={`${dayGames.length} new ${dayGames.length === 1 ? 'game' : 'games'}`} facts={judging ? 'The engine is judging your moves…' : `${waiting} to settle${waiting > openToday ? `, ${waiting - openToday} from earlier days` : ''}`}>
            {/* Le bouton avant la liste : avec dix parties, il passerait sous l'écran du téléphone. */}
            {!judging && waiting > 0 && <Action to={checkHref}>Check them</Action>}
            <ul className="flex flex-col">
              {dayGames.map((checked) => (
                <GameLine key={checked.id} checked={checked} step={stepOf(checked)} table={table} worked={worked} lived={lived} />
              ))}
            </ul>
          </Hero>
        )}
        {hero === 'review' && (
          <Hero title="Review" facts={`${lines}, played from your repertoire. The app plays their moves; you play yours. ${repertoireKnown}.`}>
            <Action to={pathOf('review')}>Start</Action>
          </Hero>
        )}
        {hero === 'work' && (
          <Hero title="Weak openings" facts="Nothing to check, nothing due">
            <PriorityList priorities={toWork.slice(0, inHero)} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          </Hero>
        )}
        {hero === 'done' && (
          <Hero title="Nothing to do now" facts="No game to check, no review due, your weak openings are worked. Play: your next games will show here.">
            <Action to={tree}>Browse your repertoire</Action>
          </Hero>
        )}

        <ul className="flex flex-col gap-2 lg:col-start-2">
          {hero !== 'games' && waiting > 0 && <Row label="To settle" figure={`${waiting}`} to={checkHref} />}
          {stopped.length > 0 && (
            <Row label="No longer played" figure={`${stopped.length} ${stopped.length === 1 ? 'move' : 'moves'}`} to={`${tree}?side=${stopped[0].side}&line=${encodeURIComponent(stopped[0].path.join(' '))}`} />
          )}
          {hero !== 'review' && due > 0 && <Row label="Review" figure={`${lines} · ${formatPercent(review.known)} known`} to={pathOf('review')} />}
          {moreToWork.length > 0 && (
            <WeakOpenings label={inHero ? 'More weak openings' : 'Weak openings'} summary={`${openingName(table, shownLine(moreToWork[0]))} ${formatPercent(moreToWork[0].score)}`} priorities={moreToWork} table={table} href={workOn} workedOf={workedOf} lived={lived} />
          )}
          {treated.length > 0 && (
            <WeakOpenings label="Worked openings" summary={`${openingName(table, shownLine(treated[0]))}${treated.length > 1 ? ` +${treated.length - 1}` : ''}`} priorities={treated} table={table} href={workOn} workedOf={workedOf} lived={lived} action="Open" />
          )}
          <PracticeRow href={(side) => `${pathOf('practice')}?side=${side}`} />
        </ul>
      </main>
      <Toast toast={toast} onClose={close} />
    </>
  );
}

function usePriorities(known: readonly PlayedGame[], day: string): Priority[] {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]): Record<Side, OpeningTree> => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    return findPriorities(trees(known), trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day))), Infinity);
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

function Row({ label, figure, to }: { label: string; figure: string; to: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[15px] focus-visible:outline-2" style={tile(COLOURS.paper)}>
        <span className="shrink-0 font-bold">{label}</span>
        <span className="ml-auto tabular-nums" style={{ color: COLOURS.leafSoft }}>
          {figure}
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

/** Un choix, jamais la carte en avant : rien n'attend le joueur ici. */
function PracticeRow({ href }: { href: (side: Side) => string }) {
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-2xl py-2 pl-4 pr-2 text-[15px]" style={tile(COLOURS.paper)}>
      <span className="flex min-w-0 flex-col">
        <span className="font-bold">Practice</span>
        <span className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
          against the moves of your level
        </span>
      </span>
      <span className="ml-auto flex shrink-0 gap-1.5">
        {(['w', 'b'] as const).map((side) => (
          <Link key={side} to={href(side)} aria-label={`Practise as ${side === 'w' ? 'White' : 'Black'}`} className="rounded-full px-3.5 py-2 text-[14px] font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
            {side === 'w' ? 'White' : 'Black'}
          </Link>
        ))}
      </span>
    </li>
  );
}

const openingName = (table: OpeningTable | null, path: readonly string[]) => (table ? resolveOpening(replayLine(path).fens, table)?.name : undefined) ?? 'Unnamed line';

function PriorityList({ priorities, table, href, workedOf, lived, action = 'Work on it' }: {
  priorities: readonly Priority[];
  table: OpeningTable | null;
  href: (line: Priority) => string;
  workedOf: (line: Priority) => WorkedLine | undefined;
  lived: readonly CheckedGame[];
  action?: string;
}) {
  const heaviest = Math.max(...priorities.map((priority) => priority.pointsToGain), 1);
  return (
    <ol className="flex flex-col">
      {priorities.map((priority, index) => {
        const line = workedOf(priority);
        return (
          <li key={`${priority.side} ${priority.path.join(' ')}`} className="flex flex-col gap-1.5 py-3" style={{ borderTop: index ? `1px solid ${COLOURS.sand}` : undefined }}>
            <span className="flex items-baseline gap-2">
              <span className="text-[16px] font-bold leading-tight">{openingName(table, shownLine(priority))}</span>
              <span className="ml-auto whitespace-nowrap text-[13px] font-semibold" style={{ color: COLOURS.terracotta }}>
                {formatPercent(priority.score)}
              </span>
            </span>
            <span className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
              {priority.side === 'w' ? 'White' : 'Black'} · {figurineLine(shownLine(priority))} · {priority.games} games · avg {formatPercent(priority.average)}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
              <motion.span className="block h-full rounded-full" style={{ background: COLOURS.terracotta }} initial={{ width: 0 }} animate={{ width: `${(priority.pointsToGain / heaviest) * 100}%` }} transition={ZOOM} />
            </span>
            <span className="flex items-center gap-3">
              {line && <WorkedTag line={line} adherence={adherence(lived, line)} />}
              <Link to={href(priority)} className="ml-auto rounded-full px-4 py-2 text-[14px] font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
                {action}
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

function WeakOpenings({ label, summary, ...props }: Parameters<typeof PriorityList>[0] & { label: string; summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col rounded-2xl" style={tile(COLOURS.paper)}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 items-center gap-3 px-4 text-left text-[15px] focus-visible:outline-2">
        <span className="shrink-0 font-bold">{label}</span>
        <span className="ml-auto min-w-0 truncate" style={{ color: COLOURS.leafSoft }}>
          {open ? `${props.priorities.length}` : summary}
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
  const played = check.kind === 'followed' ? '' : figurineMove(check.played, check.ply + 1);
  // ! une erreur à trancher, ? un coup adverse sans réponse, · un écart qui n'attend rien, ✓ la préparation suivie.
  const [icon, colour, text] =
    check.kind === 'followed'
      ? ['✓', REPERTOIRE, check.plies ? `prep followed to move ${Math.ceil(check.plies / 2)}` : 'no prep here']
      : check.kind === 'left'
        ? step
          ? ['!', COLOURS.terracotta, `you played ${played}${mark}, not ${figurineMove(check.planned[0], check.ply + 1)}`]
          : ['·', COLOURS.leafSoft, `new move ${played}`]
        : step
          ? ['?', COLOURS.terracotta, `${played}, no answer yet`]
          : ['·', COLOURS.leafSoft, `new line ${played}`];
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
          </span>
          {line && <WorkedTag line={line} adherence={adherence(lived, line)} />}
        </span>
      </span>
    </li>
  );
}

