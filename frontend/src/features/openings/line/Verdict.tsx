import { WORTH_WORKING, type LineDiagnosis } from '../domain/diagnosis';
import type { LineStep } from '../domain/line';
import { figurineMove } from '../domain/notation';
import { COLOURS, tile } from '../workshop/theme';
import { BEST } from './tone';

const LISTED_MOVES = 3;

/** Les points perdus viennent-ils d'un coup à changer, ou de ce qui suit une ouverture saine ? */
export function Verdict({ diagnosis, keyStep, positions }: { diagnosis: LineDiagnosis; keyStep: LineStep | undefined; positions: number }) {
  const { openingCost, playCost } = diagnosis;
  if (!diagnosis.complete || openingCost === null || playCost === null) {
    const evaluated = diagnosis.points.filter((point) => point.worth !== null).length;
    return (
      <article className="rounded-3xl p-6 text-[15px] font-semibold" style={{ ...tile(COLOURS.sand), color: COLOURS.leafSoft }}>
        Engine at work… {evaluated}/{positions} positions
      </article>
    );
  }
  const movesCost = openingCost >= WORTH_WORKING;
  const followCost = playCost >= WORTH_WORKING;
  const title = movesCost && followCost
    ? 'A move costs you, and so does what follows'
    : movesCost
      ? 'One of your moves costs you'
      : followCost
        ? 'Your opening is fine. What follows isn’t.'
        : 'No clear cause: the gap may be noise';

  return (
    <article aria-label="Verdict" className="flex flex-col gap-4 rounded-3xl p-6" style={tile(COLOURS.sand)}>
      <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{title}</h2>
      <div className="flex flex-wrap gap-2">
        <Cost label="your opening moves" cost={openingCost} />
        <Cost label="after the opening" cost={playCost} />
      </div>
      {movesCost && (
        <ul className="flex flex-col gap-1.5">
          {diagnosis.costlyMoves.slice(0, LISTED_MOVES).map((move) => (
            <li key={move.ply} className="flex flex-wrap items-baseline gap-x-2 rounded-xl px-3 py-2 text-[15px]" style={{ background: COLOURS.paper }}>
              <span className="font-extrabold" style={{ color: COLOURS.terracotta }}>
                {figurineMove(move.san, move.ply)}
              </span>
              <span className="font-semibold">costs</span>
              <span className="font-extrabold">{Math.round(move.loss * 100)} pts</span>
              {move.best && (
                <span className="ml-auto text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
                  engine: <span className="font-extrabold" style={{ color: BEST }}>{figurineMove(move.best, move.ply)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {followCost && (
        <p className="text-[15px] font-semibold">
          The position to work on: {keyStep ? <b>after {figurineMove(keyStep.san, keyStep.ply)}</b> : 'this line'}. Follow the plan below.
        </p>
      )}
    </article>
  );
}

function Cost({ label, cost }: { label: string; cost: number }) {
  const lost = cost >= WORTH_WORKING;
  const points = Math.round(cost * 100);
  return (
    <span className="flex items-baseline gap-2 rounded-xl px-3 py-1.5" style={{ background: COLOURS.paper }}>
      <span className="text-[20px] font-extrabold tabular-nums" style={{ color: lost ? COLOURS.terracotta : COLOURS.leafSoft }}>
        {points > 0 ? '−' : '+'}
        {Math.abs(points)} pts
      </span>
      <span className="text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {label}
      </span>
    </span>
  );
}
