# Prototypes v2 — état du cadrage

Code **jetable**, routes servies en développement uniquement. Il n'a pas vocation à être repris
tel quel : il existe pour trancher des questions de conception avant d'écrire la v2.

## Le problème

Un joueur amateur rejoue sans le savoir les mêmes mauvais coups d'ouverture, et n'a aucun moyen
simple de savoir lesquels lui coûtent le plus cher ni par lequel commencer.

La boucle complète serait : **repérer → comprendre → préparer → vérifier**. Les étapes 2 et 3 sont
bien servies par l'existant (Stockfish, Lichess, Chessable) ; les étapes 1 et 4 ne le sont par
personne. C'est le périmètre retenu : l'arbre est le fil conducteur, l'intelligence est déléguée,
la surface ne l'est pas.

## Décisions prises, et par quoi elles ont été tranchées

| Décision | Tranchée par |
|---|---|
| Deux mondes séparés, macro et micro, avec bascule explicite — l'isolement du micro *est* la fonctionnalité | POC 1 (`loop/`) |
| L'unité de travail est **la ligne**, pas le coup | POC 2 : les coups fautifs coûtent 5 points, les lignes mal tenues 80 |
| Trois signaux distincts au macro : fuite, zone faible, pas de réponse arrêtée | POC 2 (`macro/NOTES.md`) |
| Une préparation = un coup choisi à chaque position où l'on a la main, sur les bifurcations qui pèsent ; sa complétude se mesure en **couverture** | POC 4 |
| La ligne par défaut est la ligne de fait du joueur, bornée par le volume de données, et s'arrête faute d'habitude nette | POC 4 |
| L'écran d'entrée est un classement unique des chantiers, les deux couleurs confondues, en points en jeu | POC 4 |

## Les routes

- `/prototype/loop` — POC 1. Trois structures de la boucle sur données figées. **B l'emporte.**
  A et C sont conservées : elles servent encore à montrer l'alternative à quelqu'un d'extérieur.
- `/prototype/macro` — POC 2 à 4, sur de vraies parties. Import chess.com public, agrégation,
  évaluation Stockfish WASM locale, flame graph, écran d'étude, préparation et vérification.

Mesure d'onboarding à froid : **95 s pour 5 654 parties** (1 136 positions évaluées). Ensuite tout
est en cache.

## Ce qui reste ouvert

1. **La base de parties humaines.** Le moteur donne son avis aux points à trancher, mais il ne dit
   pas ce que jouent les autres ni ce que ça leur rapporte. `explorer.lichess.ovh` exige un jeton
   OAuth (la v1 le relaie via son backend) : il faut le compte Lichess du joueur pour aller plus loin.
2. **La lisibilité pour un néophyte.** Soupçon jamais levé depuis septembre 2026 ; ne se tranche
   pas en interne.
3. **La persistance.** Rien n'est stocké : ni la préparation, ni les évaluations au-delà d'un cache
   navigateur. La v2 devra décider où vit une préparation et comment la partie suivante lui est
   confrontée automatiquement.
4. **Le reste du produit.** Authentification Lichess seule, import, synchronisation : décidé mais
   non prototypé.
