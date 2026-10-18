import type { DecisiveMistake, GameCourse } from '../domain/diagnosis';
import { figurineMove } from '../domain/notation';
import type { PlayedGame } from '../domain/playedGame';
import { COLOURS, raised, tile } from '../workshop/theme';
import { lichessGame } from './lichess';
import { BEST, INK } from './tone';
import { FOLLOWED_PLIES } from './useLineDiagnosis';

interface MistakesProps {
  games: readonly PlayedGame[];
  courses: readonly GameCourse[];
  black: boolean;
  keyPly: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}

/** Les parties du joueur depuis la position clé, rangées par moment de l'erreur décisive. */
export function Mistakes({ games, courses, black, keyPly, selected, onSelect }: MistakesProps) {
  const order = games.map((_, index) => index).sort((a, b) => (courses[a].mistake?.ply ?? Infinity) - (courses[b].mistake?.ply ?? Infinity));
  const pending = courses.filter(({ chances }) => chances.includes(null)).length;

  return (
    <div className="flex flex-col gap-2">
      {pending > 0 && (
        <p className="text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          Engine on {pending} of {games.length} games…
        </p>
      )}
      <ul aria-label="Your decisive mistakes" className="flex flex-col gap-1.5">
        {order.map((index) => {
          const game = games[index];
          const { chances, mistake } = courses[index];
          const isSelected = selected === index;
          const choose = () => mistake && onSelect(isSelected ? null : index);
          return (
            <li key={index}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={choose}
                onKeyDown={(event) => event.key === 'Enter' && choose()}
                className={`grid w-full grid-cols-[1.5rem_3.5rem_11rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] ${mistake ? 'cursor-pointer' : ''}`}
                style={raised(isSelected)}
              >
                <ResultDot score={game.score} />
                <span className="text-[12px] font-semibold tabular-nums opacity-75">{formatDate(game.playedAt)}</span>
                <Sparkline chances={chances} mistakeIndex={mistake ? mistake.ply - 1 - keyPly : null} />
                <span className="truncate">
                  {mistake ? (
                    <MistakeLabel mistake={mistake} inverted={isSelected} />
                  ) : chances.includes(null) ? (
                    <span className="opacity-50">…</span>
                  ) : (
                    <span className="opacity-60">no decisive mistake in the next {FOLLOWED_PLIES / 2} moves</span>
                  )}
                </span>
                <a
                  href={lichessGame(game.moves, mistake ? mistake.ply - 1 : keyPly, black)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-full px-2.5 py-0.5 text-[12px] font-bold"
                  style={isSelected ? { background: COLOURS.cream, color: COLOURS.leaf } : tile(COLOURS.sand)}
                >
                  Lichess ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MistakeLabel({ mistake, inverted = false }: { mistake: DecisiveMistake; inverted?: boolean }) {
  return (
    <span className="font-semibold">
      <span className="font-extrabold" style={{ color: inverted ? COLOURS.apricot : COLOURS.terracotta }}>
        {figurineMove(mistake.san, mistake.ply)}
      </span>
      {mistake.best && mistake.best !== mistake.san && (
        <>
          {' → '}
          <span className="font-extrabold" style={{ color: inverted ? COLOURS.sage : BEST }}>
            {figurineMove(mistake.best, mistake.ply)}
          </span>
        </>
      )}
      <span className="opacity-70"> · −{Math.round(mistake.drop * 100)} pts</span>
    </span>
  );
}

// Chances du joueur coup après coup depuis la position clé ; le trait du milieu marque 50 %.
function Sparkline({ chances, mistakeIndex }: { chances: (number | null)[]; mistakeIndex: number | null }) {
  const width = 176;
  const height = 26;
  const x = (index: number) => (index / FOLLOWED_PLIES) * width;
  const y = (chance: number) => (1 - chance) * height;
  const points = chances.flatMap((chance, index) => (chance === null ? [] : [`${x(index)},${y(chance)}`]));
  const after = mistakeIndex === null ? null : chances[mistakeIndex + 1];
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke={COLOURS.sand} strokeWidth="1" />
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {mistakeIndex !== null && after != null && (
        <circle cx={x(mistakeIndex + 1)} cy={y(after)} r="3.2" fill={COLOURS.terracotta} stroke="white" strokeWidth="1" />
      )}
    </svg>
  );
}

function ResultDot({ score }: { score: number }) {
  const [background, color, text] =
    score === 1 ? [INK.winning, 'white', 'W'] : score === 0 ? [COLOURS.terracotta, 'white', 'L'] : [COLOURS.sand, COLOURS.leaf, '½'];
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold" style={{ background, color }}>
      {text}
    </span>
  );
}

const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
