# Prototype — vue de ligne (« Understand »)

**Question** : quelle disposition pour la vue de ligne, ouverte par « Study this line » ? Elle doit
répondre à « où, dans cette ligne, est-ce que je perds mes points, et qu'est-ce que je joue là ? ».
Exemple réel (blancs, 12 derniers mois) : 1.e4 e5 2.Nf3 d6 3.d4 tient autour de 40 % jusqu'à
4…Nf6, puis tombe à 11 % sur 9 parties, où le joueur joue toujours 5.Nc3. La vue actuelle (liste
de coups + barres) ne fait pas ressortir ce décrochage.

Route : `/dev/flame-graph?line=0|A|B|C`. La page s'ouvre directement sur la vue de ligne de la
première priorité ; « ← Openings » puis une autre priorité pour changer de ligne. Barre du bas :
`[` et `]` (← → servent à parcourir la ligne dans la variante A).

| Clé | Variante | Parti pris |
|---|---|---|
| `0` | Actuelle | point de comparaison |
| `A` | Profile | la courbe du score coup par coup en pleine largeur, moyenne du joueur en pointillé, taille du point = parties, chute la plus forte marquée (« −29 pts here ») ; dessous, plateau fléché de la position choisie (épaisseur = part des parties, couleur = score) et ses coups. ← → parcourent la ligne |
| `B` | Fork map | toute la ligne d'un coup d'œil : une rangée par position, divisée selon les coups joués (largeur = parties, la ligne en vert foncé, rangées adverses fines comme dans le flame graph), un rail avec le score à gauche. Le plateau suit le survol |
| `C` | Moments | la ligne racontée en quelques positions : le décrochage d'abord, puis les embranchements où un coup s'écarte de la moyenne, chacun avec son plateau fléché ; à droite, les parties du joueur sur la ligne (date, résultat, jusqu'où elles l'ont suivie, coup de sortie) |

Choix communs, à confirmer :
- **Couleur à partir de 5 parties** (au lieu de 20 dans le flame graph), le lissage du déficit
  faisant le reste : à 20, presque toute ligne étudiée est grise.
- **Chute = plus forte baisse du score d'un demi-coup au suivant, lissée** sur le nombre de parties
  (même lissage à 12 parties que le déficit).
- **Flèches sur le plateau** pour les coups joués (ADR 0002 : coups montrés par des flèches).
- Les parties du joueur (variante C) sont lues directement dans la fixture : à brancher sur les
  vraies données quand l'import existera.

## Verdict

_À remplir après lecture par PMG._ Ce qui est à garder, ce qui est à jeter, et dans quelle variante.
Ensuite : fondre le gagnant dans `line/` proprement (tests sur la chute et les parties de la
ligne), supprimer ce dossier, le point d'injection `renderLine` et `studyFirstPriority` de `OpeningsPage`.
