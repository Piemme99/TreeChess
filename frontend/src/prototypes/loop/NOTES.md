# POC 1 — la boucle, sur une seule ligne

**Jetable.** À supprimer ou à absorber une fois la décision prise.

## Question

Périmètre retenu pour la v2 : la boucle **1. Repérer → 2. Comprendre → 3. Préparer → 4. Vérifier**,
où « comprendre » et « préparer » s'appuient sur l'existant (Stockfish, Lichess, parties de GM).

Deux inconnues, indissociables, que ce POC doit trancher :

1. **À quoi ressemble l'étape 4 (vérifier)** — jamais conçue, et c'est elle qui fait revenir le joueur.
2. **Comment on passe du macro au micro** — je clique sur une fuite, j'arrive sur quoi ?

Hors périmètre ici : la lisibilité du macro à gros volume (le flame graph avait déjà gagné sur ce
terrain en septembre 2026) et le coût de l'onboarding à froid. Chacun aura son POC.

## Dispositif

Route jetable `/prototype/loop` (dev uniquement), hors du layout v1 pour ne pas juger la v2 à
travers l'UI qu'on veut raser. Données figées dans `data.ts`, zéro backend, zéro mutation.
Un seul scénario : Scandinave, `1.e4 d5 2.exd5 Dxd5 3.Cc3 Da5`, où 4.Cf3 est joué à la place de 4.d4.

- `?variant=A|B|C` — les trois structures
- `?step=1|2|3|4` — l'étape de la boucle
- flèches ←/→ pour changer de variante, touches 1-4 pour l'étape

## Les trois variantes

- **A — Tout dans l'arbre.** Aucun changement de page : l'arbre zoome sur la zone, un panneau
  contextuel s'ouvre, la prépa s'enregistre en place, la vérification revient dans le même arbre.
- **B — Deux mondes.** Macro (flame graph) et Étude (salle d'étude plein écran) sont deux surfaces
  distinctes avec une bascule explicite. La vérification est un écran de rapport dédié.
  C'est la piste ouverte en fin de session du 16 septembre 2026.
- **C — Fil d'actions.** Conteste le postulat : l'entrée n'est plus l'arbre mais une liste priorisée
  par coût. L'arbre devient une carte secondaire. La vérification remonte en tête de fil.

## Verdict — 2026-10-17

**Variante B (Deux mondes) retenue.**

Raison : la séparation macro / micro porte le geste du produit. Une fois la faiblesse identifiée au
macro, le micro est un espace où l'on travaille **celle-ci et rien d'autre** — l'isolement est une
fonctionnalité, pas un effet de bord de la navigation.

Conséquence sur le périmètre : « préparer » garde une **page dédiée chez nous**, même si le problème
est déjà résolu ailleurs (Chessable, studies Lichess). On ne délègue pas la surface, seulement
l'intelligence (moteur, base de parties).

Ce qui reste à trancher dans le monde micro : son contenu exact (place respective de l'échiquier,
de mes parties, du moteur, des parties de GM) et le retour vers le macro après préparation.
