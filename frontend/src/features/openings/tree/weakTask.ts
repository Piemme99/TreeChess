import type { Side } from '../domain/playedGame';
import { shownLine, type Priority } from '../domain/priorities';
import { startsWith } from './repertoireMap';

export interface AskedLine {
  side: Side;
  line: readonly string[];
}

/** La réponse qui coûte change avec les parties : l'adresse retrouve la faiblesse par son coup, suivi ou non d'une réponse. */
export const weakIndexOf = (priorities: readonly Priority[], asked: AskedLine) =>
  priorities.findIndex((candidate) => candidate.side === asked.side && startsWith(asked.line, candidate.path) && asked.line.length - candidate.path.length <= 1);

/**
 * Le rang où mène une adresse périmée, sinon `null`. Une adresse dont la ligne n'est plus une faiblesse (autre jour du
 * rejeu, lien ancien) mène à la première ; celle d'une faiblesse qui se montre ailleurs aujourd'hui mène là où elle se montre.
 */
export function weakRedirect(priorities: readonly Priority[], asked: AskedLine): number | null {
  if (!priorities.length) return null;
  const index = weakIndexOf(priorities, asked);
  if (index < 0) return 1;
  return shownLine(priorities[index]).join(' ') === asked.line.join(' ') ? null : index + 1;
}

// Une ouverture faible se montre après la réponse qui coûte, mais reste la sienne sur son propre coup.
export const showsOn = (priority: Priority, line: readonly string[]) => [priority.path, shownLine(priority)].some((shown) => shown.join(' ') === line.join(' '));
