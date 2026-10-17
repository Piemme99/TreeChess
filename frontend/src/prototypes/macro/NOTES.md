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
| **Total à froid** | **88 s** |
| Total à chaud (cache) | 14 s |

→ L'onboarding n'est pas le mur qu'on craignait : une minute et demie pour 5 654 parties.
(Mesure refaite à froid en fin de POC 4 : 88 s, dont 76 s de moteur.)

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

## POC 3 — l'écran micro, à l'échelle de la ligne

Atteint depuis le macro en cliquant une fuite, une zone faible ou une dispersion : c'est la bascule
« deux mondes » validée au POC 1, testée pour de vrai. Le geste annoncé change selon l'entrée
(remplacer un coup / trouver où ça décroche / choisir une réponse).

Trois choses qu'on n'avait pas et qui tombent naturellement quand l'unité est la ligne :

- **Le profil de décrochage** — le score au fil de la ligne, par rapport à la moyenne du joueur.
  Sur la Scandinave, il montre que la chute est immédiate (54 % → 47 % dès `1...d5`) et ne se
  creuse plus : ce n'est aucun de ses coups qui est en cause.
- **Le contraste moteur / résultat**, énoncé en clair quand les deux divergent : « le moteur te
  donne +0,61 après `2.exd5`, et tu y marques 48 % ».
- **Les bifurcations adverses** — contre quoi il se défend et ce que ça lui coûte, ce qui est la
  formulation exacte de « contre quoi je suis mal préparé ».

La ligne est prolongée par sa suite la plus fréquente au-delà du coup qui l'a fait sortir : le point
d'entrée identifie le problème, il ne délimite pas le travail.

## POC 4 — préparer et vérifier

### Ce que « fixer une ligne » veut dire

La question était ouverte : une séquence unique de coups, ou un arbre de réponses à chaque
bifurcation adverse ? Les deux réponses sont mauvaises. Une séquence unique laisse découvert dès
que l'adversaire bifurque — sur la Scandinave, `2...Cf6` arrive une fois sur six. Un arbre complet,
c'est le travail sans fin qui a rendu la v1 inutilisable.

**Décision : une préparation est un coup choisi à chaque position où le joueur a la main, sur les
seules bifurcations adverses qui pèsent.** Sa complétude ne se mesure pas en nombre de coups mais
en **couverture** : la part des parties réellement jouées qu'elle aurait prises en charge.

Trois conséquences, toutes implémentées :

- **La ligne par défaut est la ligne de fait** — ce que le joueur joue déjà, pas ce que le moteur
  préfère. Construire sur les coups les mieux notés donnait 137 parties « sorties de la prépa » sur
  207, ce qui ne mesurait rien.
- **La profondeur est bornée par le volume**, pas par le nombre de coups : en dessous de quelques
  parties il n'y a plus rien à apprendre de l'historique.
- **La ligne s'arrête là où il n'y a pas d'habitude nette** (moins d'une partie sur deux). Ces
  positions deviennent des **points à trancher** au lieu d'une recommandation inventée sur trois
  parties — et ce sont exactement les positions que le signal « pas de réponse arrêtée » détecte.

### Vérifier, mesuré sur l'historique et non maquetté

La préparation est rejouée contre les parties déjà jouées. Trois issues, et c'est la distinction
que personne ne donne aujourd'hui :

- **tu jouais déjà cette ligne** ;
- **tu en es sorti toi-même** — et à quel coup ;
- **l'adversaire est sorti de ta couverture** — un trou, pas une faute.

Sur la Scandinave : 82 % de couverture, la ligne porte jusqu'au coup 5, et le verdict est net —
48 % quand il s'y tient, 43 % quand il improvise. L'écart ne dépasse pas le bruit, donc l'écran le
dit : *« te tenir à ce que tu joues déjà ne réparera rien ici, il faut changer de système »*. Sur
`1.e4 e5`, même mesure, même conclusion.

Le point à trancher qui sort est juste : dans la Scandinave principale il n'a pas de 5ᵉ coup arrêté
(Fd2 12× à 42 %, Cf3 9× à 33 %, Fc4 4× à 75 %).

Enfin la dernière partie jouée sur la ligne est confrontée à la préparation, ce qui donne la
phrase de l'étape 4 sur des données réelles : *« 29/05 contre NosykAndrii — tu as quitté ta ligne
au coup 5 : tu as joué d4, ta ligne dit h3. »*

### Par quoi remplacer une ligne qui ne vaut rien

Première tentative : demander au moteur ses meilleurs coups à l'entrée de la ligne. Inutile — après
`1.e4 d5`, `2.exd5` est objectivement le meilleur coup (+0,63) et les alternatives sont pires. Le
choix de système ne se joue pas là.

L'avis du moteur n'a de valeur qu'aux **points à trancher**, c'est-à-dire là où le joueur n'a
justement pas d'habitude. Les deux blocs ont donc été fusionnés. Sur la Scandinave principale
après `4...Cf6`, ça donne : ses coups Fd2 12× à 42 %, Cf3 9× à 33 %, Fc4 4× à 75 % ; le moteur
propose Cf3 +0,67, Fd2 +0,67, Fe2 +0,40. Lecture immédiate : les deux coups que le moteur préfère
ne lui réussissent pas, et son meilleur score repose sur quatre parties.

**Ce qui manque ici, c'est la base de parties humaines.** `explorer.lichess.ovh` exige désormais un
jeton OAuth — c'est d'ailleurs pour cette raison que la v1 le relaie par son backend. Sans le
compte Lichess du joueur, le POC ne peut pas dire « à ton niveau, voilà ce que les autres jouent et
ce que ça leur rapporte », qui est la moitié manquante de cette réponse.

## Reste ouvert

- « Trop intimidant pour un néophyte » : ne se tranche pas en interne, il faut le montrer à quelqu'un.
- Le verdict « il faut changer de système » n'est suivi d'aucune proposition : on sait dire que la
  ligne ne vaut rien, pas par quoi la remplacer. C'est là que les parties de maîtres et la base
  d'ouvertures entreraient en jeu.
- Rien n'est persistant : la préparation vit dans l'état React. La v2 devra décider où elle vit et
  comment elle se compare à la partie suivante automatiquement.
