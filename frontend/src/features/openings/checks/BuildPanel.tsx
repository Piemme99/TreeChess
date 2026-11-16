import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { draftLines, type DraftMove } from '../domain/addition';
import { MATE_CP, winChance } from '../domain/diagnosis';
import { figurineLine, figurineMove } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK, judgeMove, type Judgement } from '../domain/judgement';
import { useEvaluations } from '../line/engine';
import { repertoireMovesAt, type Repertoire } from '../domain/repertoire';
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
  repertoire: Repertoire;
}

export function BuildPanel({ builder, candidates, fresh, onPoint, onAccept, onCancel, compact = false, repertoire }: BuildPanelProps) {
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
  const second = useSecondChoice(builder, fresh, repertoire);
  const planned = useMemo(() => new Set(repertoireMovesAt(repertoire, builder.fen).map((move) => move.san)), [repertoire, builder.fen]);
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

      {origin.reply && chosen && chosen !== origin.reply && (
        <p className="rounded-xl px-3 py-2 text-[13px]" style={{ background: COLOURS.cream }}>
          You chose {figurineMove(chosen, origin.start.length + 1)}: the game where you played {figurineMove(origin.reply, origin.start.length + 1)} will come back to settle.
        </p>
      )}

      {second && (
        <p className="rounded-xl px-3 py-2 text-[13px]" style={{ background: COLOURS.cream }}>
          Your repertoire already plays {second.existing} here: {second.added} becomes a second choice.
        </p>
      )}
      <CandidateTable builder={builder} candidates={candidates} onPoint={onPoint} compact={compact} planned={planned} />

      <p className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
        <strong>{origin.side === 'w' ? 'White' : 'Black'} %</strong>: how players of your colour score after the move on Lichess, 1400–1800 ·{' '}
        <strong>Engine</strong>: + is good for you · <strong>You</strong>: how often you played it in 12 months, and your score once you have 3 games (
        <span style={{ color: COLOURS.terracotta }}>red</span>: where you score worst).
      </p>
      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            Your line{lines.length > 1 ? 's' : ''}: click a move to go back to it.{' '}
            <span style={{ color: REPERTOIRE }}>Green moves</span> are already in your repertoire.
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

      {/* Les actions restent au bas du panneau, quoi qu'on fasse défiler au-dessus. */}
      <div className={`flex flex-col gap-2 ${compact ? 'sticky bottom-20 -mx-4 -mb-4 rounded-b-3xl px-4 pt-3 pb-4 lg:bottom-0' : ''}`} style={compact ? { background: COLOURS.paper, boxShadow: '0 -10px 14px -12px oklch(0.3 0.05 60 / 0.35)' } : undefined}>
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
          {lines.length ? 'Play your answer to add it.' : 'Play a move on the board, or pick one in the table.'}
        </span>
      )}
      </div>
    </section>
  );
}

/** Un coup du joueur ajouté là où le répertoire en a déjà un : un second choix, à dire avant d'ajouter. */
function useSecondChoice(builder: Builder, fresh: readonly DraftMove[], repertoire: Repertoire): { existing: string; added: string } | null {
  const { origin, path } = builder;
  return useMemo(() => {
    for (const move of fresh) {
      if (!isPlayerMove(origin.side, move.path.length)) continue;
      const before = move.path.slice(0, -1);
      const known = repertoireMovesAt(repertoire, replayLine(before).fens[before.length]).map((known) => known.san);
      if (known.length === 0) continue;
      const ply = move.path.length;
      return { existing: known.map((san) => figurineMove(san, ply)).join(' · '), added: figurineMove(move.path[ply - 1], ply) };
    }
    return null;
    // `path` change avec chaque coup ; le brouillon suffit à décider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, origin.side, path, repertoire]);
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

function CandidateTable({ builder, candidates, onPoint, compact, planned }: { builder: Builder; candidates: Candidates; onPoint: (san: string | null) => void; compact: boolean; planned: ReadonlySet<string> }) {
  const { rows, costly, here, explorer } = candidates;
  const ply = builder.path.length + 1;
  const side = builder.origin.side === 'w' ? 'White' : 'Black';
  const all = [...rows, ...costly];
  // Sans l'explorateur, ses deux colonnes ne diraient que « — ».
  const stats = explorer === 'ready' || explorer === 'asking';
  // Là où le joueur perd le plus dans ses propres parties : ce qu'une priorité lui demande de regarder.
  const scored = all.filter((row) => row.mine >= 3 && row.mineScore !== undefined);
  // Rouge par rapport au meilleur candidat : sous 50 % tout le monde l'est souvent avec les Noirs, et le rouge ne dirait plus rien.
  const scores = all.flatMap((row) => (row.score === undefined ? [] : [row.score]));
  // Le rouge juge un choix du joueur ; les coups de l'adversaire, il les subit.
  const best = builder.playerToMove && scores.length > 1 ? Math.max(...scores) : undefined;
  // Le coup que le joueur joue vraiment d'abord : c'est par rapport à lui qu'il choisit.
  const habit = builder.playerToMove ? [...all].filter((row) => row.mine >= 2).sort((a, b) => b.mine - a.mine)[0]?.san : undefined;
  const ordered = habit ? [...all.filter((row) => row.san === habit), ...all.filter((row) => row.san !== habit)] : all;
  const worst = scored.length > 1 ? scored.reduce((low, row) => (row.mineScore! < low.mineScore! ? row : low)).san : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <span className="whitespace-nowrap">{builder.playerToMove ? 'Your move' : 'Their move'}</span>
        <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap">
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
                <th colSpan={2} className={`whitespace-nowrap px-2 pb-0.5 text-center font-semibold ${compact ? 'hidden sm:table-cell' : ''}`} style={{ borderBottom: `1px solid ${COLOURS.sand}` }}>
                  Lichess 1400–1800
                </th>
                {compact && (
                  <th className="whitespace-nowrap px-2 pb-0.5 text-right font-semibold sm:hidden" style={{ borderBottom: `1px solid ${COLOURS.sand}` }}>
                    Lichess
                  </th>
                )}
                <th />
                <th />
              </tr>
            )}
            <tr className="text-left">
              <th className="pb-1 pr-2 font-semibold">Move</th>
              {stats && <th className={`pb-1 px-2 font-semibold ${compact ? 'hidden sm:table-cell' : ''}`}>played</th>}
              {stats && (
                <th className="pb-1 px-2 text-right font-semibold" title={`How ${side} scores after this move, at this level`}>
                  {side} %
                </th>
              )}
              <th className="pb-1 px-2 text-right font-semibold" title="Engine evaluation after the move, from your side: + is good for you">
                Engine
              </th>
              <th className="pb-1 pl-2 text-right font-semibold" title="Your games in the last 12 months, and your score in them">
                You
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <CandidateRow
                key={row.san}
                row={row}
                ply={ply}
                faded={costly.includes(row)}
                stats={stats}
                compact={compact}
                side={builder.origin.side}
                worst={worst}
                best={best}
                yours={(row.san === builder.origin.reply && builder.path.length === builder.start.length) || row.san === habit}
                planned={planned.has(row.san)}
                mine={builder.playerToMove}
                onPlay={() => builder.play(row.san)}
                onPoint={() => onPoint(row.san)}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}
      {best !== undefined && all.some((row) => row.score !== undefined && row.score < best - 0.05) && (
        <span className="text-[11px]" style={{ color: COLOURS.leafSoft }}>
          <span style={{ color: COLOURS.terracotta }}>Red</span>: {side} scores clearly less after that move than after the best one.
        </span>
      )}
    </div>
  );
}

function CandidateRow({ row, ply, faded, stats, compact, side, worst, best, yours, planned, mine, onPlay, onPoint }: {
  row: Candidate;
  ply: number;
  faded: boolean;
  stats: boolean;
  compact: boolean;
  side: Side;
  worst: string | undefined;
  best: number | undefined;
  yours: boolean;
  planned: boolean;
  /** Un coup du joueur : lui seul se juge ; ceux de l'adversaire, il les subit. */
  mine: boolean;
  onPlay: () => void;
  onPoint: () => void;
}) {
  const low = row.score !== undefined && best !== undefined && row.score < best - 0.05;
  return (
    <tr
      className="cursor-pointer hover:bg-[oklch(0.975_0.012_85)] focus-visible:outline-2"
      style={{ borderTop: `1px solid ${COLOURS.sand}`, opacity: faded ? 0.7 : 1 }}
      onMouseEnter={onPoint}
      onClick={onPlay}
      aria-label={`Play ${row.san}`}
    >
      <td className="whitespace-nowrap py-1.5 pr-2 text-[15px] font-extrabold">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
          onFocus={onPoint}
          className="rounded px-0.5 font-extrabold focus-visible:outline-2"
        >
          {figurineMove(row.san, ply)}
        </button>
        {row.judgement && mine && <Mark judgement={row.judgement} />}
        {(row.engine || yours || planned) && (
          <span className={compact ? 'mt-0.5 flex gap-1' : 'inline'}>
            {row.engine && (
              <span className={`${compact ? '' : 'ml-1.5 '}rounded-full px-1.5 text-[11px] font-extrabold align-[1px]`} style={{ background: COLOURS.kumquatDeep, color: 'white' }}>
                engine
              </span>
            )}
            {planned && (
              <span className={`${compact ? '' : 'ml-1.5 '}rounded-full px-1.5 text-[11px] font-extrabold align-[1px]`} style={{ background: REPERTOIRE, color: 'white' }}>
                in repertoire
              </span>
            )}
            {yours && !planned && (
              <span className={`${compact ? '' : 'ml-1.5 '}rounded-full px-1.5 text-[11px] font-extrabold align-[1px]`} style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
                you play it
              </span>
            )}
          </span>
        )}
      </td>
      {stats && (
        <td className={`px-2 py-1.5 ${compact ? 'hidden sm:table-cell' : ''}`}>
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
      <span className="whitespace-nowrap tabular-nums">{cp === undefined ? '…' : `${formatCp(cp)} ${verdictOf(cp)}`}</span>
    </span>
  );
}

/** Ce que dit l'évaluation en mots, pour qui ne lit pas les centipions. */
function verdictOf(cp: number): string {
  // Sur la valeur affichée, arrondie au dixième : « +0.5 » doit toujours dire la même chose.
  const shown = Math.round(cp / 10) * 10;
  if (Math.abs(shown) < 30) return '(equal)';
  if (Math.abs(shown) < 100) return shown > 0 ? '(slightly better)' : '(slightly worse)';
  return cp > 0 ? '(better for you)' : '(worse for you)';
}

/** Centipions, comme sur Lichess : « −0.5 », « +1.2 », « #». */
function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? '#' : '−#';
  const pawns = (Math.abs(cp) / 100).toFixed(1);
  if (pawns === '0.0') return '0.0';
  return cp < 0 ? `−${pawns}` : `+${pawns}`;
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
      style={
        disabled
          ? { background: 'transparent', color: COLOURS.leafSoft, boxShadow: `inset 0 0 0 1.5px ${COLOURS.sand}`, opacity: 0.6, cursor: 'not-allowed' }
          : primary
            ? { background: COLOURS.leaf, color: COLOURS.cream }
            : { ...tile(COLOURS.sand), color: COLOURS.leaf }
      }
    >
      {children}
    </motion.button>
  );
}
