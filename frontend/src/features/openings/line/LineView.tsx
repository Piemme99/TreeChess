import { useState, type ReactNode } from 'react';
import type { OpeningTree } from '../domain/openingTree';
import { figurineMove } from '../domain/notation';
import type { PlayedGame } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import { replayLine } from '../position/replay';
import { COLOURS } from '../workshop/theme';
import { ArrowBoard, type BoardArrow } from './ArrowBoard';
import { Fold } from './Fold';
import { lichessGame, lichessPosition } from './lichess';
import { LineHeader } from './LineHeader';
import { MistakeLabel, Mistakes } from './Mistakes';
import { Practice } from './Practice';
import { PreparedCaption, Preparation, type PointedPreparation } from './Preparation';
import { arrowMoves, moveTone } from './tone';
import { useLineDiagnosis } from './useLineDiagnosis';
import { Verdict } from './Verdict';
import { WholeLine, type PointedMove } from './WholeLine';

interface LineViewProps {
  tree: OpeningTree;
  /** Les parties du joueur sur la même période que l'arbre. */
  games: readonly PlayedGame[];
  path: readonly string[];
  onBack: () => void;
  onOpen: (path: readonly string[]) => void;
}

interface Shown {
  path: readonly string[];
  arrows: BoardArrow[];
  caption: ReactNode;
  link: { href: string; label: string };
}

const WORTH = COLOURS.leaf;
const SCORE = COLOURS.kumquatDeep;

/**
 * « Study this line » : d'où viennent les points perdus (un coup à changer, ou ce qui suit une
 * ouverture saine), puis un plan pour la ligne. L'analyse se fait sur Lichess, gratuit et libre.
 */
export function LineView({ tree, games, path, onBack, onOpen }: LineViewProps) {
  const black = tree.side === 'b';
  const { line, positions, average, fens, diagnosis, key, keyGames, courses, preparation } = useLineDiagnosis(tree, games, path);
  const [selected, setSelected] = useState<number | null>(null);
  const [pointed, setPointed] = useState<PointedMove | null>(null);
  const [prepared, setPrepared] = useState<PointedPreparation | null>(null);
  const shownPly = key ?? line.entry;

  const shown = ((): Shown => {
    if (pointed) {
      const position = positions[pointed.ply];
      const move = position.moves.find((candidate) => candidate.san === pointed.san);
      return {
        path: position.path,
        arrows: move ? [{ san: move.san, tone: moveTone(move.rate, move.games, average), share: 0.6, emphasis: true }] : [],
        caption: move && (
          <>
            {figurineMove(move.san, position.ply + 1)} · {move.games} games · {formatPercent(move.rate)}
          </>
        ),
        link: { href: lichessPosition(fens[pointed.ply], black), label: 'Analyse on Lichess ↗' },
      };
    }
    if (prepared) {
      const { path: before, move } = prepared;
      return {
        path: before,
        arrows: [
          ...(move.dropped ? [{ san: move.dropped.san, kind: 'costly' as const, share: 0.6 }] : []),
          { san: move.san, kind: move.byPlayer ? 'repertoire' : 'neutral', share: 0.6, emphasis: true },
        ],
        caption: <PreparedCaption move={move} />,
        link: { href: lichessPosition(replayLine(before).fens[before.length], black), label: 'Analyse on Lichess ↗' },
      };
    }
    const mistake = selected === null ? null : courses[selected]?.mistake;
    if (selected !== null && mistake) {
      const game = keyGames[selected];
      return {
        path: game.moves.slice(0, mistake.ply - 1),
        arrows: [
          { san: mistake.san, kind: 'costly', share: 0.6 },
          ...(mistake.best && mistake.best !== mistake.san ? [{ san: mistake.best, kind: 'engine' as const, share: 0.6 }] : []),
        ],
        caption: <MistakeLabel mistake={mistake} />,
        link: { href: lichessGame(game.moves, mistake.ply - 1, black), label: 'Open this game on Lichess ↗' },
      };
    }
    const position = positions[shownPly];
    const point = diagnosis.points[shownPly];
    return {
      path: position.path,
      arrows: arrowMoves(position.moves).map((move) => ({
        san: move.san,
        tone: moveTone(move.rate, move.games, average),
        share: move.share,
        emphasis: move.onLine,
      })),
      caption: point.worth !== null && (
        <>
          worth <span style={{ color: WORTH }}>{formatPercent(point.worth)}</span> · you score{' '}
          <span style={{ color: SCORE }}>{formatPercent(point.score)}</span> · {point.games} games
        </>
      ),
      link: { href: lichessPosition(fens[shownPly], black), label: 'Study this position on Lichess ↗' },
    };
  })();

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <LineHeader path={path} side={tree.side} studied={line.steps[line.entry - 1]} average={average} onBack={onBack} />
      <div className="grid grid-cols-[minmax(0,26rem)_1fr] items-start gap-10">
        <div className="sticky top-6 flex flex-col gap-3">
          <ArrowBoard path={shown.path} flipped={black} arrows={shown.arrows} />
          <p className="min-h-5 px-1 text-[14px] font-semibold">{shown.caption}</p>
          <a
            href={shown.link.href}
            target="_blank"
            rel="noreferrer"
            className="self-start rounded-full px-4 py-2 text-[15px] font-bold"
            style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 6px 14px -6px oklch(0.3 0.06 150 / 0.55)' }}
          >
            {shown.link.label}
          </a>
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <Verdict diagnosis={diagnosis} keyStep={key === null ? undefined : line.steps[key - 1]} positions={positions.length} />
          {key !== null && (
            <section aria-label="Your plan" className="flex flex-col gap-5">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Your plan for this line</h2>
              <Step number={1} title="Extend your preparation">
                <Preparation preparation={preparation} keyPath={positions[key].path} onPoint={setPrepared} />
              </Step>
              <Step number={2} title="Practise the position">
                <Practice
                  fens={fens.slice(0, key + 1)}
                  habit={positions[key].playerToMove ? (positions[key].moves[0]?.san ?? null) : null}
                />
                <Fold title={`Your decisive mistakes from here · ${courses.filter(({ mistake }) => mistake).length}`}>
                  <Mistakes games={keyGames} courses={courses} black={black} keyPly={key} selected={selected} onSelect={setSelected} />
                </Fold>
              </Step>
            </section>
          )}
          <Fold title="The whole line">
            <WholeLine positions={positions} entry={line.entry} average={average} pointed={pointed} onPoint={setPointed} onOpen={onOpen} />
          </Fold>
        </div>
      </div>
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <article aria-label={title} className="flex flex-col gap-3 rounded-3xl p-5" style={{ background: COLOURS.paper, boxShadow: '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)' }}>
      <header className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full text-[16px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          {number}
        </span>
        <h3 className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h3>
      </header>
      {children}
    </article>
  );
}
