import type { OpeningNode, OpeningTree } from './openingTree';

export function scoreRate(node: OpeningNode): number {
  return node.games === 0 ? 0 : node.score / node.games;
}

export function playerAverage(tree: OpeningTree): number {
  return scoreRate(tree.root);
}

// Ramène l'écart vers 0 sur les petits échantillons : sans ça, une ligne jouée
// 7 fois domine le classement sur du bruit.
const SMOOTHING_GAMES = 12;

export function deficit(node: OpeningNode, average: number): number {
  if (node.games === 0) return 0;
  const confidence = node.games / (node.games + SMOOTHING_GAMES);
  return (average - scoreRate(node)) * confidence;
}
