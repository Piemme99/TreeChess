// Les décisions du joueur restent dans le navigateur jusqu'à la brique 3 de l'import : chaque source de parties a
// les siennes, pour que la démo et un compte importé ne se mélangent pas. La démo garde les clés d'avant.
let scope = '';

export function setStorageScope(sourceId: string) {
  scope = sourceId === 'demo' ? '' : `${sourceId}.`;
}

export const storageKey = (key: string) => `kumquat.v2.${scope}${key}`;
