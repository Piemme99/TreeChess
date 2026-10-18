# Prototype — vue de ligne (« Understand »)

**Question** : quelle disposition pour la vue de ligne, ouverte par « Study this line » ? Elle doit
répondre à « où, dans cette ligne, est-ce que je perds mes points, et qu'est-ce que je joue là ? ».
Exemple réel (blancs, 12 derniers mois) : 1.e4 e5 2.Nf3 d6 3.d4 tient autour de 40 % jusqu'à
4…Nf6, puis tombe à 11 % sur 9 parties, où le joueur joue toujours 5.Nc3. La vue actuelle (liste
de coups + barres) ne fait pas ressortir ce décrochage.

Route : `/dev/flame-graph?line=0|A|B|C|D`. La page s'ouvre directement sur la vue de ligne de la
première priorité ; « ← Openings » puis une autre priorité pour changer de ligne. Barre du bas :
`[` et `]` (← → servent à parcourir la ligne dans la variante A).

| Clé | Variante | Parti pris |
|---|---|---|
| `0` | Actuelle | point de comparaison |
| `A` | Profile | la courbe du score coup par coup en pleine largeur, moyenne du joueur en pointillé, taille du point = parties, chute la plus forte marquée (« −29 pts here ») ; dessous, plateau fléché de la position choisie (épaisseur = part des parties, couleur = score) et ses coups. ← → parcourent la ligne |
| `B` | Fork map | toute la ligne d'un coup d'œil : une rangée par position, divisée selon les coups joués (largeur = parties, la ligne en vert foncé, rangées adverses fines comme dans le flame graph), un rail avec le score à gauche. Le plateau suit le survol |
| `C` | Moments | la ligne racontée en quelques positions : le décrochage d'abord, puis les embranchements où un coup s'écarte de la moyenne, chacun avec son plateau fléché ; à droite, les parties du joueur sur la ligne (date, résultat, jusqu'où elles l'ont suivie, coup de sortie) |
| `D` | Engine vs you | voir plus bas : le moteur contre les résultats |

Choix communs, à confirmer :
- **Couleur à partir de 5 parties** (au lieu de 20 dans le flame graph), le lissage du déficit
  faisant le reste : à 20, presque toute ligne étudiée est grise.
- **Chute = plus forte baisse du score d'un demi-coup au suivant, lissée** sur le nombre de parties
  (même lissage à 12 parties que le déficit).
- **Flèches sur le plateau** pour les coups joués (ADR 0002 : coups montrés par des flèches).
- Les parties du joueur (variante C) sont lues directement dans la fixture : à brancher sur les
  vraies données quand l'import existera.

## Retours de PMG (18/10)

1. Flèches grises illisibles sur les cases vertes → liseré crème autour de chaque flèche, gris plus foncé.
2. Trop de flèches → trois au plus : le coup de la ligne, puis les plus joués.
3. **On a mal posé le problème.** Les −29 pts de la Philidor tombent sur 4…♘f6, un coup de
   théorie : la position n'est pas mauvaise, c'est le joueur qui la joue mal. Il faut distinguer
   un coup objectivement mauvais (solution simple : jouer le bon coup) d'un coup correct qui mène à
   une position où l'on perd (solution : travailler la position en profondeur). → variante `D`.
4. La fork map (B) plaît, mais intimide un débutant → repliée sous la vue D (« The whole line »),
   les rangées adverses réduites au coup de la ligne tant qu'on ne coche pas « show every opponent move ».
5. Beaucoup d'informations, rien pour savoir quoi en faire. Être humble : dire « tu joues bien
   l'ouverture et tu perds ensuite, travaille-la », récapituler les erreurs décisives, et renvoyer
   l'analyse ailleurs — **Lichess**, gratuit et libre (pas chess.com : l'analyse y est payante).
   → D réorganisée : verdict, récap des erreurs décisives avec lien Lichess sur chaque partie (ouverte
   au coup fautif), position clé à étudier sur Lichess ; courbes et fork map repliées en dessous.
   Un coup qui coûte est énoncé (« 4.c3 costs 3 pts · engine: ♘f3 »), pas prescrit : le choix d'une
   ouverture, un gambit compris, reste au joueur (README).

## Variante D — le moteur contre les résultats

Stockfish (le WASM du dépôt, worker dédié) évalue chaque position de la ligne (profondeur 16), puis
les parties du joueur depuis la position clé (profondeur 12, 40 demi-coups, 20 parties au plus).

- **Ce que vaut une position pour le joueur** = chances de gain du moteur (formule de Lichess),
  recalées pour valoir sa moyenne au départ. Même échelle que son score : les deux courbes se lisent
  ensemble, l'aire entre elles est ce qui se perd en jouant.
- **Partage des points perdus** à l'entrée de la ligne : *coups d'ouverture* = moyenne − valeur de la
  position ; *après l'ouverture* = valeur − score. La somme fait l'écart brut à la moyenne.
- **Verdict** : une cause est « à travailler » dès 3 pts (coups d'ouverture, ou après l'ouverture) ; les
  coups listés sont ceux qui perdent ≥ 2 pts, les trois plus chers.
- **Position clé** = celle où le score est le plus sous la valeur (lissé à 12 parties, 5 au moins).
- **Coup décisif** d'une partie = coup du joueur qui fait le plus chuter ses chances (≥ 10 pts, et
  encore ≥ 8 deux demi-coups plus tard pour écarter les sauts d'évaluation en pleine prise). La
  première imprécision a été essayée et écartée : souvent rattrapée, elle ne dit pas où la partie se perd.
- Les parties complètes viennent de `recent-full-games.json` (12 derniers mois, chess.com,
  477 Ko, avec l'URL) : la fixture principale coupe les parties à 16 demi-coups.

Mesuré hors navigateur sur les 5 priorités (Stockfish 18 lite en Node, un thread) :

| Ligne | Coups d'ouverture | Après l'ouverture |
|---|---|---|
| Philidor 3.d4 (42 p.) | +2 | −13 |
| Morra 4.c3 (50 p.) | −4 | −4 |
| 1.d4 ♘f6, Noirs (28 p.) | 0 | −12 |
| 1.d4 c6, Noirs (7 p.) | 0 | −43 |
| Dragon accéléré, Noirs (29 p.) | 0 | −3 |

Aucun coup du joueur ne perd 5 pts sur ces lignes (le pire : 4.c3, ~3 pts) : ce sont toutes des
positions mal jouées, pas des coups faux. Dans la Philidor, les parties basculent entre les coups 8
et 20 (10.g4, 15.♘f5, 15.f4, 18.♗xg5, 20.f5…). Coût : ~27 ms par position à profondeur 12 sur un
thread, ~10 s pour les 9 parties de la Philidor, ~55 s pour les 5 priorités entières.

6. La finalité de « Study this line » ne peut pas être une liste d'erreurs : il faut soit orienter le
   joueur ailleurs, soit lui donner quelque chose de concret à faire. PMG choisit le second (« B ») :
   un plan pour la ligne, outils gratuits uniquement. Construit sans jeton Lichess :
   1. **Prolonger la préparation** depuis la position clé, à partir des parties du joueur : son coup
      habituel, remplacé par celui du moteur s'il coûte ≥ 5 pts ; les coups adverses vus ≥ 2 fois.
      **Constat** : les parties s'éparpillent 1 à 3 coups après la position clé (Philidor : plus aucune
      suite commune après le coup 8), et les habitudes y tiennent. Aller plus loin demande ce que jouent
      les adversaires de ce niveau : l'explorateur Lichess, qui exige un jeton (401 sans ; CORS ouvert,
      en-tête `Authorization` accepté).
   2. **S'entraîner sur la position** : partie contre Stockfish sur Lichess depuis la position clé,
      puzzles Lichess de la famille d'ouverture, erreurs décisives repliées dessous.
   3. **Suivre son score** : score mois par mois sur la ligne face à l'objectif, ce que vaut la position.

7. Jeton personnel Lichess (dans `frontend/.env.local`, ignoré par git) en attendant de brancher
   l'OAuth qui existe déjà dans le backend v1 (PKCE, jeton stocké, proxy `GET /api/training/opening`
   avec cache Postgres) ; ce branchement viendra avec la brique import. L'étape 1 devient :
   - à ton coup : ton habitude (≥ 2 parties) si le moteur l'accepte (perte < 5 pts), sinon le coup le
     plus joué à ton niveau que le moteur accepte, sinon le coup du moteur ;
   - au coup adverse : les réponses à ton niveau (Lichess, blitz + rapide, 1400-1800) qui pèsent
     ≥ 15 %, trois au plus, tant que la branche concerne ≥ 8 % des parties, plus celles que tu as
     rencontrées ≥ 2 fois ; 6 coups au-delà de la position clé.
   Philidor : jusqu'au coup 8, ~20 appels à l'explorateur et 16 s ; après 7…c5 elle propose 8.♘db5,
   là où une partie a été perdue sur 8.♘f5. L'étape 2 ajoute ce que jouent les maîtres à la position
   clé et trois de leurs parties (liens Lichess). Explorateur limité en débit : une requête à la fois,
   cache dans le localStorage, une minute de pause sur un 429 (vu en test).
   **Contredit l'ADR 0002, point 5** (« la préparation proposée s'arrête là où s'arrêtent les parties
   du joueur ») : elle va ici au-delà, avec ce que jouent les adversaires de son niveau. À trancher.
   Position clé : à écart presque égal (90 %), celle où le joueur a le trait.

Pour plus tard, avec l'OAuth Lichess : créer d'un clic une étude Lichess des positions d'erreur de la ligne.

## Verdict

_À remplir après lecture par PMG._ Ce qui est à garder, ce qui est à jeter, et dans quelle variante.
Ensuite : fondre le gagnant dans `line/` proprement (tests sur la chute et les parties de la
ligne), supprimer ce dossier, le point d'injection `renderLine` et `studyFirstPriority` de `OpeningsPage`.
