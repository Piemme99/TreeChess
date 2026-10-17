# POC 2 — le monde macro sur de vraies parties

**Jetable.** Route `/prototype/macro` (dev uniquement).

## Question

1. Le flame graph tient-il sur un historique réel, ou devient-il illisible ?
2. Combien coûte l'onboarding à froid (import + évaluation Stockfish locale) ?

## Dispositif

Tout se passe dans le navigateur, comme le fera le produit : API publique chess.com (pas d'auth,
CORS ouvert) → agrégation en arbre (chess.js) → évaluation Stockfish WASM multi-thread
(`crossOriginIsolated` grâce aux en-têtes COOP/COEP déjà posés par Vite) → rendu.

Les positions ne sont évaluées qu'une fois chacune (clé EPD, cache `localStorage`), et seulement
si elles sont jouées au moins `minGames` fois : c'est ce qui rend l'onboarding abordable.

## Mesures — Piemme78, chess.com, blitz + rapide, 16 demi-coups, seuil 6 parties, profondeur 12

| | |
|---|---|
| Parties | 5 654 (2 824 blancs / 2 830 noirs) |
| Positions distinctes | 45 445 |
| Positions évaluées | 1 136 (966 calculs, 170 doublons EPD) |
| Téléchargement (40 archives) | 1,6 s |
| Agrégation | 10,4 s |
| Évaluation | 82,5 s |
| **Total à froid** | **94,8 s** |
| Total à chaud (cache) | 13,7 s |

→ L'onboarding n'est pas le mur qu'on craignait : une minute et demie pour 5 654 parties.

## Ce que ça tranche

**Le flame graph tient à l'échelle.** Lisible sur 16 demi-coups, 2 800 parties par couleur. Coloré
par le déficit de points réel, il répond littéralement à son titre : les zones rouges sont celles
où le joueur marque moins que sa moyenne.

**La première métrique de « fuite » était fausse.** Classer par `perte d'éval × nombre de parties`
promeut les lignes principales : `1.e4 e5 2.Fc4` sortait 1ʳᵉ avec 535 parties et −26 cp, alors que
le joueur y marque 58 %, au-dessus de sa moyenne. `1.d4` sortait 2ᵉ avec −12 cp, soit de la
préférence de moteur. À ce niveau, 10 à 30 cp ne veulent rien dire.

**La métrique retenue** croise trois choses, et sépare deux signaux :

- plancher moteur (50 cp) pour écarter la préférence de moteur ;
- déficit de points face à la moyenne du joueur, lissé (`n / (n + 12)`) pour que 6 parties ne
  dominent pas le classement ;
- test de significativité (écart > 1 erreur-type) — exigé pour les zones faibles, simplement
  signalé (« à confirmer ») pour les fuites, où le moteur corrobore déjà ;
- déduplication : une ligne et sa sous-ligne racontent la même histoire, on garde la plus lourde.

Les trois signaux :

- **Fuite d'ouverture** — le moteur pointe un coup fautif précis. Directement préparable.
- **Zone faible** — résultats sous la moyenne sans coup fautif isolé. C'est la ligne entière qui
  rapporte peu.
- **Pas de réponse arrêtée** — le joueur alterne entre plusieurs coups qui ne se valent pas.
  Mesuré sans le moteur et sans la moyenne globale : on compare ses propres réponses entre elles.
  Deux systèmes qui marchent aussi bien sont un choix, pas un trou — seul l'écart compte, exprimé
  en points par 100 parties et étiqueté « à confirmer » tant qu'il ne survit pas à l'incertitude
  d'échantillonnage.

Trois pièges rencontrés en chemin sur ce troisième signal, tous visibles dans le code :
un coup joué 3 fois à 100 % devenait la référence (d'où le seuil à 10 parties et 5 % du nœud) ;
compter les coups distincts confondait choix et improvisation (d'où la comparaison des résultats) ;
et extrapoler le score de 158 parties à 1 363 autres annonçait un gain de 116 points (d'où le
passage à un écart par 100 parties, borné par son incertitude).

## Résultats sur le vrai compte

| | Blancs (2 824 parties, 54 %) | Noirs (2 830 parties, 51 %) |
|---|---|---|
| Fuites d'ouverture | −4,9 pts | −0,2 pts |
| Zones faibles | −40,3 pts | −39,4 pts |

Pas de réponse arrêtée : côté blancs, `1.e4 e5` est joué moitié 2.Fc4 (535 parties, 58 %) moitié
2.Cf3 (501, 53 %) — +5 pts / 100 pour le premier. Côté noirs, contre `1.e4` le joueur répond
1...c6 dans 1 363 parties à 53 % alors que ses 158 Scandinaves marquent 61 % (+7 pts / 100), et
contre `1.d4` ses quatre réponses s'étalent de 51 % à 32 %.

Têtes de liste côté blancs : le **Gambit Morra** (112 parties, 51 %, −63 cp) — l'écart assumé, d'où
le bouton « assumé » qui le range à part ; puis la **Scandinave** `1.e4 d5 2.exd5` (207 parties,
48 %) en zone faible. Côté noirs, tout le poids est contre **1.d4** : `1...Cf6` 40 % sur 124 parties,
`1...d5` 47 % sur 261, `1...c6` 32 % sur 41. Diagnostic lisible : il n'a pas de répertoire contre 1.d4.

## Conséquence pour la v2 — à arbitrer

Les vraies pertes ne sont pas dans les coups fautifs (−5 pts) mais dans les lignes entières mal
tenues (−80 pts). Or la boucle a été dessinée au POC 1 autour d'**un coup** : « tu avais préparé
4.d4, tu as joué 4.Cf3 ». Si l'essentiel du gain est ailleurs, l'unité de travail de la boucle
doit être **la ligne**, pas le coup — ce qui change l'écran micro et la façon de vérifier.

## Reste ouvert

- « Trop intimidant pour un néophyte » : ne se tranche pas en interne, il faut le montrer à quelqu'un.
- L'unité de travail de la boucle (coup vs ligne) — voir ci-dessus.
