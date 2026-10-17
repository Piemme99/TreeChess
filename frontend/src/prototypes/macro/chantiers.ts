// PROTOTYPE — la synthèse : les chantiers des deux couleurs dans un seul classement. Jetable.
import { baseline, evalForUser, findDispersions, findFindings, type Color, type Tree } from './tree';
import type { Entry } from './Study';

export interface Chantier {
  nodeId: string;
  color: Color;
  entry: Entry;
  headline: string;
  detail: string;
  /** Points en jeu, toutes couleurs comparables. */
  points: number;
  confident: boolean;
}

interface Params {
  tree: Tree;
  minGames: number;
  floorCp: number;
  minWeakGames: number;
  dismissed: string[];
}

function detailFor(kind: 'leak' | 'weak', evalCp: number | undefined): string {
  if (kind === 'leak') return 'Un coup fautif, directement remplaçable.';
  if (evalCp !== undefined && evalCp > 20) {
    return `Le moteur te donne ${(evalCp / 100).toFixed(2)} dans cette position : c’est la suite qui pêche, pas l’ouverture.`;
  }
  return 'Aucun coup fautif isolé : c’est la ligne entière qui rapporte peu.';
}

export function chantiers({ tree, minGames, floorCp, minWeakGames, dismissed }: Params): Chantier[] {
  const out: Chantier[] = [];

  for (const color of ['white', 'black'] as Color[]) {
    const base = baseline(tree, color);
    const pct = (v: number) => `${Math.round(v * 100)}%`;

    for (const f of findFindings(tree, color, { minGames, floorCp, minWeakGames })) {
      if (dismissed.includes(f.node.id)) continue;
      const line = f.node.id.split('|')[1];
      out.push({
        nodeId: f.node.id,
        color,
        entry: f.kind,
        headline:
          f.kind === 'leak'
            ? `${line} te coûte ${f.lossCp} centipions sur ${f.games} parties`
            : `${line} : ${f.games} parties à ${pct(f.rate)} contre ${pct(base)} de moyenne`,
        detail: detailFor(f.kind, evalForUser(f.node)),
        points: f.pointsLost,
        confident: f.confident,
      });
    }

    for (const d of findDispersions(tree, color, minWeakGames)) {
      if (dismissed.includes(d.node.id)) continue;
      const line = d.node.id.split('|')[1] || 'le départ';
      out.push({
        nodeId: d.node.id,
        color,
        entry: 'dispersion',
        headline: `Après ${line} tu alternes entre ${d.replies.length} réponses qui ne se valent pas`,
        detail: `${d.best.san} te rapporte ${Math.round(d.gap * 100)} points de plus pour 100 parties, sur ${d.otherGames} parties jouées autrement.`,
        points: d.gapLow * d.otherGames,
        confident: d.confident,
      });
    }
  }

  return out.sort((a, b) => Number(b.confident) - Number(a.confident) || b.points - a.points);
}
