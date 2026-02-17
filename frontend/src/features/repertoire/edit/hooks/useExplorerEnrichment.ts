import { useState, useEffect, useRef } from 'react';
import { fetchExplorerData, type ExplorerResponse, type ExplorerMove } from '../../../training/services/lichessExplorer';

export interface ExplorerMoveStats {
  san: string;
  totalGames: number;
  /** Win rate from white's perspective (0–100). */
  winRate: number;
}

export interface ExplorerPositionStats {
  totalGames: number;
  moves: ExplorerMoveStats[];
}

/**
 * Fetches Lichess Explorer data for a position and provides enrichment stats
 * for move suggestions. Uses the existing lichessExplorer service with its
 * LRU cache and rate limiting.
 *
 * Returns null while loading or if the position has insufficient data.
 */
export function useExplorerEnrichment(fen: string | undefined): ExplorerPositionStats | null {
  const [stats, setStats] = useState<ExplorerPositionStats | null>(null);
  const abortedRef = useRef(false);
  const prevFenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!fen) {
      setStats(null);
      return;
    }

    // Skip if same FEN
    if (fen === prevFenRef.current) return;
    prevFenRef.current = fen;

    abortedRef.current = false;
    // Don't clear stats immediately to avoid flicker during position navigation

    let cancelled = false;

    (async () => {
      try {
        const data: ExplorerResponse = await fetchExplorerData(fen);
        if (cancelled) return;

        const totalGames = data.white + data.draws + data.black;
        if (totalGames < 100) {
          setStats(null);
          return;
        }

        const moves: ExplorerMoveStats[] = data.moves.map((m: ExplorerMove) => {
          const moveTotal = m.white + m.draws + m.black;
          return {
            san: m.san,
            totalGames: moveTotal,
            winRate: moveTotal > 0 ? ((m.white + m.draws * 0.5) / moveTotal) * 100 : 50,
          };
        });

        setStats({ totalGames, moves });
      } catch {
        if (!cancelled) {
          setStats(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fen]);

  return stats;
}
