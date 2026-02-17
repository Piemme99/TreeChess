import { useMemo } from 'react';
import { Chess } from 'chess.js';
import type { EngineEvaluation, RepertoireNode } from '../../../../types';
import { stockfishService } from '../../../../services/stockfish';
import { cpToWinPercent, formatEval, formatWinPercent } from '../../../../shared/utils/moveClassification';
import { useExplorerEnrichment } from '../hooks/useExplorerEnrichment';
import { Plus } from 'lucide-react';

interface TopMovesPanelProps {
  evaluation?: EngineEvaluation | null;
  /** All MultiPV lines (best-first). Falls back to single evaluation if empty. */
  lines?: EngineEvaluation[];
  fen?: string;
  /** Repertoire ID for the "Add" button. */
  repertoireId?: string;
  /** Currently selected node in the tree. */
  selectedNode?: RepertoireNode | null;
  /** Callback to add a move to the repertoire. */
  onAddMove?: (san: string) => void;
}

interface LineDisplay {
  rank: number;
  san: string;
  score: string;
  winPercent: number;
  pvSanMoves: string[];
  evaluation: EngineEvaluation;
  /** Whether this move already exists as a child in the current node. */
  existsInTree: boolean;
}

export function TopMovesPanel({ evaluation, lines, fen, repertoireId, selectedNode, onAddMove }: TopMovesPanelProps) {
  // Get Explorer stats for this position
  const explorerStats = useExplorerEnrichment(fen);

  // Build line displays from either MultiPV lines or single evaluation
  const lineDisplays = useMemo(() => {
    if (!fen) return [];

    const evaluations = lines && lines.length > 0 ? lines : (evaluation ? [evaluation] : []);
    if (evaluations.length === 0) return [];

    const isBlack = fen.split(' ')[1] === 'b';

    // Get existing children moves for "exists in tree" check
    const existingMoves = new Set(
      (selectedNode?.children ?? []).map(c => c.move).filter(Boolean)
    );

    return evaluations.map((evalLine, index): LineDisplay | null => {
      if (!evalLine.pv || evalLine.pv.length === 0) return null;

      // Convert PV moves to SAN
      const sanMoves: string[] = [];
      try {
        const chess = new Chess(fen);
        for (const uciMove of evalLine.pv.slice(0, 6)) {
          const san = stockfishService.uciToSAN(uciMove, chess.fen());
          if (san === uciMove) break;
          sanMoves.push(san);
          const from = uciMove.slice(0, 2);
          const to = uciMove.slice(2, 4);
          const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
          const result = chess.move({ from, to, promotion });
          if (!result) break;
        }
      } catch {
        // If conversion fails, use what we have
      }

      if (sanMoves.length === 0) return null;

      // Normalize score to white's perspective
      const whiteScore = isBlack ? -(evalLine.score ?? 0) : (evalLine.score ?? 0);
      const whiteMate = evalLine.mate !== undefined && evalLine.mate !== null && isBlack
        ? -evalLine.mate : evalLine.mate;
      const winPercent = whiteMate !== undefined && whiteMate !== null
        ? (whiteMate > 0 ? 99.9 : 0.1)
        : cpToWinPercent(whiteScore);

      return {
        rank: index + 1,
        san: sanMoves[0],
        score: formatEval(whiteScore, whiteMate),
        winPercent,
        pvSanMoves: sanMoves,
        evaluation: evalLine,
        existsInTree: existingMoves.has(sanMoves[0]),
      };
    }).filter((l): l is LineDisplay => l !== null);
  }, [evaluation, lines, fen, selectedNode]);

  if (lineDisplays.length === 0) return null;

  const depth = lineDisplays[0]?.evaluation.depth ?? 0;

  return (
    <div className="space-y-3">
      <h3 className="m-0 text-sm font-semibold text-text-muted uppercase tracking-wider">
        Engine Analysis <span className="text-text-muted/50 font-normal normal-case">(depth {depth})</span>
      </h3>

      {lineDisplays.map((line) => {
        // Get Explorer stats for this specific move
        const moveStats = explorerStats?.moves.find(m => m.san === line.san);
        const popularity = moveStats
          ? (moveStats.totalGames / explorerStats!.totalGames * 100)
          : null;
        const practicalWinRate = moveStats?.winRate ?? null;

        return (
          <div
            key={line.rank}
            className={`rounded-xl border px-3 py-2.5 transition-colors ${
              line.rank === 1
                ? 'border-primary/20 bg-primary/5'
                : 'border-primary/10 bg-bg'
            }`}
          >
            {/* Main row: rank + move + score + Win% + add button */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-muted/50 w-4 shrink-0">{line.rank}.</span>
              <span className="text-base font-bold text-text">{line.san}</span>
              <span className="text-sm font-mono text-text-muted">{line.score}</span>
              <span className={`text-xs font-medium ${line.winPercent >= 55 ? 'text-success' : line.winPercent >= 45 ? 'text-text-muted' : 'text-danger'}`}>
                {formatWinPercent(line.winPercent)}
              </span>

              {/* Explorer stats */}
              {popularity !== null && (
                <span className="text-[10px] text-text-muted/60 ml-auto flex items-center gap-1.5">
                  <span title="Popularity in master/online games">{popularity.toFixed(0)}% played</span>
                  {practicalWinRate !== null && (
                    <>
                      <span className="text-text-muted/30">|</span>
                      <span title="Win rate in practice">{practicalWinRate.toFixed(0)}% WR</span>
                    </>
                  )}
                </span>
              )}

              {/* Add to repertoire button */}
              {onAddMove && repertoireId && !line.existsInTree && (
                <button
                  onClick={() => onAddMove(line.san)}
                  className="ml-auto p-1 rounded-md hover:bg-primary/10 text-text-muted hover:text-primary transition-colors cursor-pointer"
                  title={`Add ${line.san} to repertoire`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}

              {line.existsInTree && (
                <span className="ml-auto text-[10px] text-success/70 px-1.5 py-0.5 rounded bg-success/10">
                  in tree
                </span>
              )}
            </div>

            {/* PV line */}
            {line.pvSanMoves.length > 1 && (
              <div className="mt-1.5 text-[12px] text-text-muted/70 font-mono pl-6">
                {line.pvSanMoves.map((san, i) => (
                  <span key={i} className="mr-1">{san}</span>
                ))}
                {(line.evaluation.pv?.length ?? 0) > 6 && <span className="text-text-muted/40">...</span>}
              </div>
            )}
          </div>
        );
      })}

      {/* Explorer position stats */}
      {explorerStats && explorerStats.totalGames > 0 && (
        <div className="text-[10px] text-text-muted/50 px-1">
          Based on {explorerStats.totalGames.toLocaleString()} games from the Lichess database
        </div>
      )}
    </div>
  );
}
