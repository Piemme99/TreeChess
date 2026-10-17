// PROTOTYPE JETABLE — le geste commun aux trois variantes : jouer son coup sur l'échiquier.
import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../../shared/components/Board';
import type { Side } from '../../features/openings/domain/playedGame';
import { useElementWidth } from '../../features/openings/flame/useElementWidth';
import { replayLine } from '../../features/openings/position/replay';

export type Attempt = 'idle' | 'wrong' | 'solved';

interface PlayMoveProps {
  side: Side;
  path: readonly string[];
  expected: string;
  onSolved?: (firstTry: boolean) => void;
}

export function PlayMove({ side, path, expected, onSolved }: PlayMoveProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [attempt, setAttempt] = useState<Attempt>('idle');
  const [tries, setTries] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const replayed = useMemo(() => replayLine(path), [path]);
  const fen = replayed.fens[replayed.fens.length - 1];
  const expectedMove = useMemo(() => new Chess(fen).move(expected), [fen, expected]);

  const solvedFen = useMemo(() => {
    const chess = new Chess(fen);
    chess.move(expected);
    return chess.fen();
  }, [fen, expected]);

  const handleMove = ({ san }: { san: string }) => {
    setTries((n) => n + 1);
    if (san === expected) {
      setAttempt('solved');
      onSolved?.(tries === 0 && !revealed);
    } else {
      setAttempt('wrong');
    }
  };

  return (
    <div ref={ref} data-expected={`${expectedMove.from}${expectedMove.to}`} data-fen={fen} className="flex flex-col gap-2">
      {width > 0 ? (
        <ChessBoard
          key={`${fen}-${tries}`}
          fen={attempt === 'solved' ? solvedFen : fen}
          orientation={side === 'w' ? 'white' : 'black'}
          interactive={attempt !== 'solved'}
          onMove={handleMove}
          lastMove={attempt === 'solved' ? expectedMove : replayed.lastMove}
          width={width}
          customArrows={revealed && attempt !== 'solved' ? [[expectedMove.from, expectedMove.to, '#6B8E23']] : []}
        />
      ) : null}
      <div className="flex min-h-9 items-center justify-between text-sm">
        {attempt === 'idle' ? <span className="text-text-muted">Play your prep move</span> : null}
        {attempt === 'wrong' ? <span className="font-medium text-danger">Not your prep · try again</span> : null}
        {attempt === 'solved' ? <span className="font-medium text-success">✓ {expected} · your prep</span> : null}
        {attempt === 'wrong' && !revealed ? (
          <button onClick={() => setRevealed(true)} className="rounded-full border border-border px-3 py-1 text-text-muted">
            Show prep
          </button>
        ) : null}
      </div>
    </div>
  );
}
