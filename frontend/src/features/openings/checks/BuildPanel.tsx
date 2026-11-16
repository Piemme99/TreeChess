import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { draftLines, type DraftMove } from '../domain/addition';
import { MATE_CP, winChance } from '../domain/diagnosis';
import { figurineLine, figurineMove } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK, judgeMove, type Judgement } from '../domain/judgement';
import { useEvaluations } from '../line/engine';
import type { Side } from '../domain/playedGame';
import { replayLine } from '../position/replay';
import { COLOURS, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import type { Builder } from './useBuilder';
import { ENGINE_DEPTH, type Candidate, type Candidates } from './useCandidates';

interface BuildPanelProps {
  builder: Builder;
  candidates: Candidates;
  /** Les coups du brouillon que le répertoire n'a pas encore : seuls eux s'ajoutent. */
  fresh: readonly DraftMove[];
  onPoint: (san: string | null) => void;
  onAccept: () => void;
  onCancel: () => void;
  /** Dans le volet étroit : la part jouée en chiffres, sans barre. */
  compact?: boolean;
}

export function BuildPanel({ builder, candidates, fresh, onPoint, onAccept, onCancel, compact = false }: BuildPanelProps) {
  const { origin, draft } = builder;
  const played = origin.played && figurineMove(origin.played, origin.start.length + 1);
  const lastGiven = origin.given.at(-1);
  // Une ligne hors répertoire finissant sur un coup du joueur se garde comme un coup de partie gardé.
  const givenMove = lastGiven && figurineMove(lastGiven[lastGiven.length - 1], lastGiven.length);
  const givenByPlayer = lastGiven !== undefined && isPlayerMove(origin.side, lastGiven.length);
  // « To add » montre dès le premier coup donné (adverse imprévu, ligne hors répertoire), sinon depuis le départ.
  const shownFrom = origin.given.length ? origin.given[0].length - 1 : origin.start.length;
  const lines = draftLines(draft);
  const toAdd = fresh.length;
  const isFresh = (path: readonly string[]) => fresh.some((move) => move.path.length === path.length && move.path.every((san, at) => path[at] === san));
  const complete = fresh.some((move) => isPlayerMove(origin.side, move.path.length));
  const judgement = useLastJudgement(builder);
  // Le coup du joueur choisi juste après le départ, à comparer à sa réponse dans la partie.
  const chosen = draft.find((move) => move.path.length === origin.start.length + 1 && move.path.every((san, at) => at >= origin.start.length || origin.start[at] === san))?.path.at(-1);

  return (
    <section aria-label="Addition" className={`flex flex-col gap-4 rounded-3xl ${compact ? 'p-4' : 'p-5'}`} style={raised(false)}>
      <h2 className={`${compact ? 'text-[19px]' : 'text-[22px]'} font-extrabold leading-snug tracking-[-0.02em]`}>
        {origin.heading ? (
          origin.heading
        ) : builder.kept || givenByPlayer ? (
          <>
            <Move>{builder.kept ? played : givenMove}</Move> joins your repertoire: add it, or play on
          </>
        ) : played ? (
          <>
            You played <Move>{played}</Move>: what do you want to play here?
          </>
        ) : givenMove ? (
          <>
            Prepare your answer to <Move>{givenMove}</Move>
          </>
        ) : (
          'Extend your repertoire from here'
        )}
        <span className="mt-1 block text-[14px] font-semibold tracking-normal" style={{ color: COLOURS.leafSoft }}>
          {builder.start.length ? `From ${figurineLine(builder.start)}` : 'From the starting position'}
          {origin.reply && (
            <>
              {' · in that game you answered '}
              <span className="whitespace-nowrap" style={{ color: COLOURS.leaf }}>
                {figurineMove(origin.reply, origin.start.length + 1)}
              </span>
            </>
          )}
        </span>
      </h2>

      <CandidateTable builder={builder} candidates={candidates} onPoint={onPoint} compact={compact} />

      {origin.reply && chosen && chosen !== origin.reply && (
        <p className="rounded-xl px-3 py-2 text-[13px]" style={{ background: COLOURS.cream }}>
          You chose {figurineMove(chosen, origin.start.length + 1)}: the game where you played {figurineMove(origin.reply, origin.start.length + 1)} will come back to settle.
        </p>
      )}

      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            Your line{lines.length > 1 ? 's' : ''} · <span className="rounded px-1 font-extrabold" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>tile</span> = new,{' '}
            <span className="font-semibold" style={{ color: REPERTOIRE }}>green</span> = already in your repertoire, ringed = on the board · click a move to go back to it
          </span>
          <ul aria-label="To add" className="flex flex-col gap-1 text-[14px]">
            {lines.map((line) => (
              <li key={line.join(' ')} className="flex flex-wrap gap-1">
                {line.slice(shownFrom).map((san, index) => {
                  const upTo = line.slice(0, shownFrom + index + 1);
                  const here = upTo.length === builder.path.length && upTo.every((move, at) => builder.path[at] === move);
                  const isNew = isFresh(upTo);
                  return (
                    <button
                      key={upTo.length}
                      type="button"
                      onClick={() => builder.goTo(upTo)}
                      aria-current={here ? 'step' : undefined}
                      title={isNew ? 'New move' : 'Already in your repertoire'}
                      className="cursor-pointer rounded-md px-1.5 py-0.5 focus-visible:outline-2"
                      style={{
                        ...(isNew ? { ...tile(COLOURS.sand), color: COLOURS.leaf } : { background: 'transparent', color: REPERTOIRE }),
                        ...(here ? { outline: `2px solid ${COLOURS.leaf}`, outlineOffset: 1 } : {}),
                        fontWeight: isNew ? 800 : 600,
                      }}
                    >
                      {figurineMove(san, upTo.length)}
                      {here && judgement && <Mark judgement={judgement} />}
                    </button>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <span className="flex flex-wrap gap-2">
        <Action onClick={onAccept} primary disabled={!complete}>
          {complete ? `Add to my repertoire · ${toAdd} new ${toAdd === 1 ? 'move' : 'moves'}` : 'Add to my repertoire'}
        </Action>
        <Action onClick={builder.undo ?? (() => undefined)} disabled={!builder.undo}>
          Undo last move
        </Action>
        <Action onClick={onCancel}>Cancel</Action>
      </span>
      {!complete && (
        <span className="-mt-2 text-[13px]" style={{ color: COLOURS.leafSoft }}>
          {lines.length ? 'Play your answer to add it.' : 'Play a move on the board or click a row.'}
        </span>
      )}
    </section>
  );
}

/** Le jugement du moteur sur le dernier coup du joueur, s'il vient d'en jouer un. */
function useLastJudgement(builder: Builder): Judgement | null {
  const { path, start, origin } = builder;
  const mover = (path.length - 1) % 2 === 0 ? 'w' : 'b';
  const relevant = path.length > start.length && mover === origin.side;
  const fens = useMemo(() => (relevant ? replayLine(path).fens.slice(-2) : []), [relevant, path]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH, relevant);
  const [before, after] = fens.map((fen) => evaluations.get(fen));
  return relevant && before && after ? judgeMove(before.cp, after.cp, mover) : null;
}

function CandidateTable({ builder, candidates, onPoint, compact }: { builder: Builder; candidates: Candidates; onPoint: (san: string | null) => void; compact: boolean }) {
  const { rows, costly, here, explorer } = candidates;
  const ply = builder.path.length + 1;
  const side = builder.origin.side === 'w' ? 'White' : 'Black';
  const all = [...rows, ...costly];
  // Sans l'explorateur, ses deux colonnes ne diraient que « — ».
  const stats = explorer === 'ready' || explorer === 'asking';
  // Là où le joueur perd le plus dans ses propres parties : ce qu'une priorité lui demande de regarder.
  const scored = all.filter((row) => row.mine >= 3 && row.mineScore !== undefined);
  const worst = scored.length > 1 ? scored.reduce((low, row) => (row.mineScore! < low.mineScore! ? row : low)).san : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-3 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {builder.playerToMove ? 'Your move' : 'Their move'}
        <span className="ml-auto flex items-center gap-1.5">
          Engine, for you
          <EvalBar cp={here?.cp} side={builder.origin.side} />
        </span>
      </span>
      {explorer === 'missing' && <Muted>Lichess stats need a token (VITE_LICHESS_TOKEN in frontend/.env.local): engine and your games only.</Muted>}
      {explorer === 'failed' && <Muted>The Lichess explorer is not answering: engine and your games only.</Muted>}
      {explorer === 'asking' && <Muted>Asking the Lichess explorer…</Muted>}
      {all.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
        <table aria-label="Candidate moves" className="w-full border-collapse text-[14px]" onMouseLeave={() => onPoint(null)}>
          <thead className="text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            {stats && (
              <tr>
                <th />
                <th colSpan={2} className="whitespace-nowrap px-2 pb-0.5 text-center font-semibold" style={{ borderBottom: `1px solid ${COLOURS.sand}` }}>
                  {compact ? 'Lichess 1400+' : 'Lichess 1400–1800'}
                </th>
                <th />
                <th />
              </tr>
            )}
            <tr className="text-left">
              <th className="pb-1 pr-2 font-semibold">Move</th>
              {stats && <th className="pb-1 px-2 font-semibold">played</th>}
              {stats && <th className="pb-1 px-2 text-right font-semibold">{compact ? 'score' : `${side} scores`}</th>}
              <th className="pb-1 px-2 text-right font-semibold" title="Engine evaluation after the move, from your side: + is good for you">
                Engine
              </th>
              <th className="pb-1 pl-2 text-right font-semibold" title="Your games in the last 12 months, and your score in them">
                You
              </th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <CandidateRow
                key={row.san}
                row={row}
                ply={ply}
                faded={costly.includes(row)}
                stats={stats}
                compact={compact}
                side={builder.origin.side}
                worst={worst}
                yours={row.san === builder.origin.reply && builder.path.length === builder.start.length}
                onPlay={() => builder.play(row.san)}
                onPoint={() => onPoint(row.san)}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}
      {stats && all.some((row) => row.score !== undefined && row.score < 0.5) && (
        <span className="text-[11px]" style={{ color: COLOURS.leafSoft }}>
          <span style={{ color: COLOURS.terracotta }}>Red</span> score: {side} scores under 50% after that move at this level.
        </span>
      )}
    </div>
  );
}

function CandidateRow({ row, ply, faded, stats, compact, side, worst, yours, onPlay, onPoint }: {
  row: Candidate;
  ply: number;
  faded: boolean;
  stats: boolean;
  compact: boolean;
  side: Side;
  worst: string | undefined;
  yours: boolean;
  onPlay: () => void;
  onPoint: () => void;
}) {
  const low = row.score !== undefined && Math.round(row.score * 100) < 50;
  return (
    <tr
      className="cursor-pointer hover:bg-[oklch(0.975_0.012_85)] focus-visible:outline-2"
      style={{ borderTop: `1px solid ${COLOURS.sand}`, opacity: faded ? 0.45 : 1 }}
      onMouseEnter={onPoint}
      onClick={onPlay}
      onKeyDown={(event) => event.key === 'Enter' && onPlay()}
      tabIndex={0}
      aria-label={`Play ${row.san}`}
    >
      <td className="whitespace-nowrap py-1.5 pr-2 text-[15px] font-extrabold">
        {figurineMove(row.san, ply)}
        {row.judgement && <Mark judgement={row.judgement} />}
        {(row.engine || yours) && (
          <span className={compact ? 'mt-0.5 flex gap-1' : 'inline'}>
            {row.engine && (
              <span className={`${compact ? '' : 'ml-1.5 '}rounded-full px-1.5 text-[11px] font-extrabold align-[1px]`} style={{ background: COLOURS.kumquatDeep, color: 'white' }}>
                engine
              </span>
            )}
            {yours && (
              <span className={`${compact ? '' : 'ml-1.5 '}rounded-full px-1.5 text-[11px] font-extrabold align-[1px]`} style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
                your game
              </span>
            )}
          </span>
        )}
      </td>
      {stats && (
        <td className="px-2 py-1.5">
          {compact ? <span className="tabular-nums">{row.share === undefined ? '—' : formatPercent(row.share)}</span> : <ShareBar share={row.share} />}
        </td>
      )}
      {stats && (
        <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold" style={{ color: low ? COLOURS.terracotta : undefined }}>
          {row.score === undefined ? '—' : formatPercent(row.score)}
        </td>
      )}
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
        {row.cp === undefined ? <span style={{ color: COLOURS.leafSoft }}>…</span> : formatCp(side === 'w' ? row.cp : -row.cp)}
      </td>
      <td className="whitespace-nowrap py-1.5 pl-2 text-right" style={{ color: row.san === worst ? COLOURS.terracotta : COLOURS.leafSoft }}>
        {row.mine > 0 ? (
          <>
            {row.mine}
            {row.mine >= 3 && row.mineScore !== undefined && <span className="font-bold"> · {formatPercent(row.mineScore)}</span>}
          </>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

function Mark({ judgement, light = false }: { judgement: Judgement; light?: boolean }) {
  return (
    <b className="ml-0.5" title={judgement} style={{ color: light ? COLOURS.apricot : COLOURS.terracotta }}>
      {JUDGEMENT_MARK[judgement]}
    </b>
  );
}

function ShareBar({ share }: { share: number | undefined }) {
  return (
    <div className="relative h-4 min-w-[4.5rem] rounded-md" style={{ background: 'oklch(0.955 0.02 85)' }}>
      {share !== undefined && (
        <div
          className="h-full rounded-md"
          style={{ width: `${Math.max(share * 100, 2)}%`, background: COLOURS.sand, boxShadow: 'inset 0 -1.5px 0 oklch(0 0 0 / 0.1)' }}
        />
      )}
      <span className="absolute left-1.5 top-0 text-[11px] font-bold leading-4">{share === undefined ? '—' : formatPercent(share)}</span>
    </div>
  );
}

/** La position vue par le moteur, comme la barre de Lichess, mais du côté du joueur : la part claire est sa chance. */
function EvalBar({ cp: whiteCp, side }: { cp: number | undefined; side: Side }) {
  // Du côté du joueur : un « −0.2 » lu par un joueur des Noirs doit vouloir dire « moins bien pour moi ».
  const cp = whiteCp === undefined ? undefined : side === 'w' ? whiteCp : -whiteCp;
  const white = cp === undefined ? 0.5 : winChance(cp);
  return (
    <span className="flex items-center gap-1.5" title={cp === undefined ? 'Engine: looking…' : `Engine, for you: ${formatCp(cp)}`}>
      <span className="relative h-2.5 w-20 overflow-hidden rounded-full" style={{ background: COLOURS.leaf }}>
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: COLOURS.cream }}
          animate={{ width: `${white * 100}%` }}
          transition={SPRING}
        />
      </span>
      <span className="tabular-nums">{cp === undefined ? '…' : formatCp(cp)}</span>
    </span>
  );
}

/** Centipions, comme sur Lichess : « −0.5 », « +1.2 », « #». */
function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? '#' : '−#';
  const pawns = (Math.abs(cp) / 100).toFixed(1);
  return cp < 0 ? `−${pawns}` : cp > 0 ? `+${pawns}` : '0.0';
}


function Move({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
      {children}
    </p>
  );
}

function Action({ onClick, primary = false, disabled = false, children }: { onClick: () => void; primary?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING}
      className="cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-bold focus-visible:outline-2 disabled:cursor-default"
      style={{ ...(primary ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf }), opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </motion.button>
  );
}
