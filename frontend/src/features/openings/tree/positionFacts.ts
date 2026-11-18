import { useMemo } from 'react';
import { isPlayerMove, nodeAt, type OpeningNode } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { shownLine } from '../domain/priorities';
import type { BoardArrow } from '../line/ArrowBoard';
import { MAX_ARROWS, relevantArrows } from '../position/arrows';
import type { PositionPaneProps } from './PositionPane';
import type { MapNode } from './repertoireMap';

export interface PositionFacts {
  inRepertoire: boolean;
  ply: number;
  arrows: BoardArrow[];
  suggestions: string[];
  here: OpeningNode | undefined;
  average: number;
  leak: OpeningNode | undefined;
  /** Le joueur a quitté son propre répertoire, et le coup qu'il y joue d'habitude. */
  leftByPlayer: boolean;
  usual: MapNode | undefined;
  prioritised: boolean;
  settling: boolean;
  waiting: boolean;
}

/** Ce que la position porte, calculé une fois pour le volet de l'ordinateur comme pour celui du téléphone. */
export function usePositionFacts({ side, path, node, recent, steps, priority, lead }: Pick<PositionPaneProps, 'side' | 'path' | 'node' | 'recent' | 'steps' | 'priority' | 'lead'>): PositionFacts {
  const inRepertoire = path.length === node.path.length;
  const here = useMemo(() => nodeAt(recent, path), [recent, path]);
  // Hors du répertoire, seule la faiblesse dont c'est la ligne exacte garde sa carte (tâche Weak opening).
  const afterLeak = priority?.leak !== undefined && shownLine(priority).join(' ') === path.join(' ');
  const prioritised = priority !== undefined && (inRepertoire || priority.path.join(' ') === path.join(' ') || afterLeak);
  const settling = inRepertoire && steps.length > 0 && !(prioritised && lead === 'priority');
  const leak = useMemo(() => (priority?.leak ? nodeAt(recent, shownLine(priority)) : undefined), [recent, priority]);
  const arrows = useMemo(() => {
    const deviation = [...steps].sort((a, b) => b.games.length - a.games.length)[0];
    // Deux couleurs sur l'arbre : le vert du répertoire, le terracotta de ce qui demande à être regardé.
    const shown = !inRepertoire
      ? []
      : relevantArrows(node.children.map((child) => ({ san: child.san!, games: child.games })), node.games, deviation?.played).map(
          (arrow): BoardArrow => ('kind' in arrow && arrow.kind === 'neutral' ? { ...arrow, kind: 'costly' } : arrow),
        );
    // La carte « Priority » nomme le coup où l'on perd le plus : il doit se voir sur l'échiquier, à jouer ou déjà joué.
    if (!leak || settling || !(afterLeak || inRepertoire)) return shown;
    const costly: BoardArrow = { san: leak.san!, kind: 'costly', share: 0.5, emphasis: true, played: afterLeak };
    return [...shown.filter((arrow) => afterLeak || arrow.san !== leak.san).slice(0, MAX_ARROWS - 1), costly];
  }, [inRepertoire, node, steps, leak, settling, afterLeak]);
  // Un point d'atterrissage par flèche, pas par coup du répertoire : dix points sur l'échiquier, c'est dix flèches de plus.
  const suggestions = useMemo(() => arrows.filter((arrow) => 'kind' in arrow && arrow.kind === 'repertoire').map((arrow) => arrow.san), [arrows]);
  const average = useMemo(() => playerAverage(recent), [recent]);
  return {
    inRepertoire,
    ply: path.length + 1,
    arrows,
    suggestions,
    here,
    average,
    leak,
    leftByPlayer: !inRepertoire && isPlayerMove(side, node.path.length + 1),
    usual: [...node.children].sort((a, b) => b.games - a.games)[0],
    prioritised,
    settling,
    waiting: inRepertoire && steps.length > 0 && !settling,
  };
}
