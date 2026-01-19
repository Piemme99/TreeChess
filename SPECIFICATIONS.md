# TreeChess - Spécifications Techniques et Fonctionnelles

**Version:** 2.0  
**Date:** 19 Janvier 2026  
**Statut:** Brouillon

---

## 1. Contexte et Vision

### 1.1 Problématique

Les joueurs d'échecs amateurs (sous 2000 ELO) rencontrent des difficultés significatives dans l'apprentissage et la mémorisation de leurs ouvertures. Les outils existants (Lichess, Chess.com, livres) proposent soit des répertoires statiques, soit des outils d'analyse, mais aucun ne permet de construire un répertoire personnalisé de manière interactive tout en l'enrichissant automatiquement à partir de ses propres parties.

### 1.2 Solution Proposée

TreeChess est une application web permettant aux joueurs de créer, visualiser et enrichir leur répertoire d'ouvertures sous forme d'arbre interactif. L'utilisateur construit son répertoire coup par coup, puis l'importe depuis ses parties pour identifier ses lacunes et compléter automatiquement les branches manquantes.

### 1.3 Valeur Ajoutée

- **Personnalisation** : L'utilisateur garde uniquement les lignes qu'il souhaite apprendre
- **Progression incrémentale** : L'arbre grandit naturellement à chaque partie importée
- **Visualisation intuitive** : Représentation GitHub-style de l'arbre des possibilités
- **Révision active** : Rejouer les branches pour ancrer les séquences en mémoire

---

## 2. Objectifs du Projet

### 2.1 Objectifs MVP (Version 1.0) - Développement Local

Permettre à un utilisateur unique de créer et visualiser deux arbres de répertoire (Blancs et Noirs) en important des fichiers PGN, avec possibilité d'ajouter manuellement des nouvelles branches lors des divergences.

**Stack technique MVP :**
- Frontend : React 18 + TypeScript
- Backend : Go
- Base de données : PostgreSQL (dev local)
- Pas d'authentification
- Pas de déploiement production

### 2.2 Objectifs V2 (Version 2.0) - Production

- Authentification via OAuth Lichess (les utilisateurs ont déjà un compte Lichess)
- Import direct depuis l'API Lichess
- Support multi-utilisateurs
- Déploiement en production

### 2.3 Fonctionnalités reportées en V2

- Mode entraînement avec quiz et répétition espacée
- Import API Chess.com
- Plusieurs répertoires par couleur
- Visualisation main line vs sideline
- Export PGN du répertoire
- Statistiques de progression
- Comments/Vidéos sur les positions

---

## 3. Spécifications Fonctionnelles

### 3.1 Gestion des Répertoires

#### REQ-001 : Création initiale des répertoires
Au premier démarrage de l'application, l'API crée automatiquement deux répertoires vides :
- Un répertoire "Blancs" avec la position initiale (fen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -)
- Un répertoire "Noirs" avec la position initiale

#### REQ-002 : Sélection du répertoire actif
L'utilisateur peut basculer entre le répertoire Blancs et le répertoire Noirs via un sélecteur. L'arbre affiché correspond au répertoire sélectionné.

#### REQ-003 : Persistence des données (PostgreSQL)
Les données sont stockées dans une base PostgreSQL. Schéma :

```sql
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_repertoires_color ON repertoires(color);
```

#### REQ-004 : Répertoire unique par couleur
Pour le MVP, un seul répertoire Blanc et un seul répertoire Noirs par installation. Pas de support multi-répertoires (V2).

---

### 3.2 Import PGN

#### REQ-010 : Import de fichier PGN
L'utilisateur peut uploader un fichier PGN via une interface de sélection de fichier. Le fichier peut contenir une ou plusieurs parties.

#### REQ-011 : Parsing PGN
Le backend parse les éléments suivants du PGN :
- En-têtes : `[Event]`, `[Site]`, `[Date]`, `[Round]`, `[White]`, `[Black]`, `[Result]`, `[ECO]`, `[Termination]`
- Moves : Séquence des coups en notation algébrique abrégée (SAN)

#### REQ-012 : Exclusion des commentaires
Les commentaires `{}` et variations `()` sont ignorés lors du parsing.

#### REQ-013 : Validation du format PGN
Si le fichier n'est pas un PGN valide, afficher un message d'erreur explicite avec la ligne problématique.

---

### 3.3 Comparaison avec le Répertoire

#### REQ-020 : Matching automatique des coups
Pour chaque partie importée, le backend compare chaque coup avec le répertoire correspondant (Blancs pour les coups Blancs, Noirs pour les coups Noirs).

#### REQ-021 : Définition du "suivi de répertoire"
Un coup est considéré comme "dans le répertoire" s'il existe une arête sortante correspondante depuis le nœud courant dans l'arbre de l'utilisateur.

#### REQ-022 : Classification des divergences
Trois cas de figure lors de l'import :

| Cas | Condition | Action |
|-----|-----------|--------|
| A | Le coup de l'utilisateur existe dans l'arbre | Marquer comme "OK" |
| B | Le coup de l'utilisateur n'existe pas | Marquer comme "Erreur - hors répertoire" |
| C | Le coup de l'adversaire n'existe pas dans l'arbre | Marquer comme "Nouvelle ligne possible" |

#### REQ-023 : Résumé post-import
Après traitement d'un fichier PGN, afficher un résumé :
- Nombre de parties analysées
- Coups dans le répertoire (vert)
- Coups hors répertoire (orange)
- Nouvelles lignes détectées (bleu)

---

### 3.4 Enrichissement du Répertoire

#### REQ-030 : Ajout manuel de coups
Depuis une divergence (cas B ou C), l'utilisateur peut ajouter des coups au répertoire via :
- Saisie sur l'échiquier (cliquer la pièce, sélectionner la case cible)
- Notation SAN dans un champ de texte

#### REQ-031 : Contrainte d'unicité de réponse
Pour un coup adverse donné, l'utilisateur ne peut enregistrer QU'UNE seule réponse. Si une réponse existe déjà, elle est proposée automatiquement.

#### REQ-032 : Ajout de séquences
L'utilisateur peut ajouter plusieurs coups consécutifs (1-3 coups typiquement) pour définir une nouvelle variation.

#### REQ-033 : Validation des mouvements
Tout coup ajouté doit être légal selon les règles des échecs. Utiliser `chess.js` pour validation côté frontend avant envoi au backend.

---

### 3.5 Visualisation de l'Arbre

#### REQ-040 : Représentation GitHub-style
L'arbre est affiché comme un diagramme de commits GitHub :
- Nœuds = positions après un coup
- Arêtes = coups joués
- Layout horizontal de gauche à droite (début → fin)
- Branches qui divergent se séparent visuellement
- Plus la branche s'éloigne de la racine, plus les nœuds sont proches (densification)

#### REQ-041 : Navigation dans l'arbre
- Zoom in/out via molette ou contrôles
- Pan par glisser-déposer
- Clic sur un nœud pour centrer la vue et mettre à jour l'échiquier

#### REQ-042 : Affichage du coup
Chaque nœud affiche :
- Le SAN du coup (ex: "e4", "Nf3", "O-O")

#### REQ-043 : Couleurs des nœuds
- Racine : Noir
- Tous les nœuds : Même style pour le MVP

---

### 3.6 Mode Révision

#### REQ-050 : Visualisation d'une branche
L'utilisateur sélectionne un nœud et accède à une vue dédiée affichant :
- Un échiquier avec la position courante
- La séquence de coups du nœud racine au nœud sélectionné
- Navigation Previous/Next pour parcourir la séquence

#### REQ-051 : Révision active
En mode révision, l'utilisateur peut :
- Rejouer les coups en les jouant sur l'échiquier
- Recevoir un feedback immédiat si mauvais coup
- Retourner au début de la branche

#### REQ-052 : Affichage position + notation
TOUJOURS afficher simultanément :
- Diagramme de l'échiquier avec les pièces
- Notation SAN du coup au format textuel

---

## 4. Modèle de Données

### 4.1 Structure de l'Arbre (PostgreSQL JSONB)

```typescript
type Color = 'w' | 'b';
type MoveSAN = string;

interface RepertoireNode {
  id: string;
  fen: string;
  move: MoveSAN | null;
  moveNumber: number;
  colorToMove: Color;
  parentId: string | null;
  children: RepertoireNode[];
}

interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
  lastGameDate: string | null;
}
```

### 4.2 Schéma PostgreSQL

```sql
-- Table principale des répertoires
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_repertoire_per_color UNIQUE (color)
);

-- Index pour performance
CREATE INDEX idx_repertoires_color ON repertoires(color);
CREATE INDEX idx_repertoires_updated ON repertoires(updated_at DESC);
```

### 4.3 Structure JSONB stockée

```json
{
  "id": "root-white",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
  "move": null,
  "moveNumber": 0,
  "colorToMove": "w",
  "children": [
    {
      "id": "e4",
      "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
      "move": "e4",
      "moveNumber": 1,
      "colorToMove": "b",
      "parentId": "root-white",
      "children": [
        {
          "id": "c5-sicilian",
          "fen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6",
          "move": "c5",
          "moveNumber": 1,
          "colorToMove": "w",
          "parentId": "e4",
          "children": [
            {
              "id": "nf3",
              "fen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKBNR b KQkq -",
              "move": "Nf3",
              "moveNumber": 2,
              "colorToMove": "b",
              "parentId": "c5-sicilian",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### 4.4 Résultat d'Analyse PGN

```typescript
interface GameAnalysis {
  gameIndex: number;
  headers: PGNHeaders;
  moves: MoveAnalysis[];
}

interface MoveAnalysis {
  plyNumber: number;
  san: string;
  fen: string;
  status: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
  expectedMove?: string;
  isUserMove: boolean;
}
```

---

## 5. Architecture Technique

### 5.1 Stack Technologique MVP

| Couche | Technologie | Raison |
|--------|-------------|--------|
| Frontend | React 18 + TypeScript | Composants, typage strict |
| Gestion état | Zustand | Lightweight |
| Échecs | chess.js | Validation moves, FEN, SAN |
| Visualisation | D3.js ou React Flow | Arbre interactif GitHub-style |
| Backend | Go | API REST performante |
| Base de données | PostgreSQL | Données structurées, JSONB natif |
| Driver BDD | pgx | Driver PostgreSQL natif pour Go |
| Build frontend | Vite | Dev server rapide |

### 5.2 Architecture Backend (Go)

```
cmd/server/
├── main.go                          # Point d'entrée
├── config/
│   └── config.go                    # Configuration (BDD, port)
├── internal/
│   ├── handlers/
│   │   ├── repertoire.go            # CRUD répertoires
│   │   ├── pgn.go                   # Import PGN
│   │   └── analysis.go              # Analyse répertoire
│   ├── services/
│   │   ├── repertoire_service.go    # Logique métier
│   │   ├── pgn_parser.go            # Parsing PGN
│   │   └── tree_service.go          # Manipulation arbre
│   ├── repository/
│   │   └── repertoire_repo.go       # Accès PostgreSQL
│   ├── models/
│   │   └── repertoire.go            # Types TypeScript/Go
│   └── middleware/
│       └── logger.go                # Logging
├── migrations/
│   └── 001_init.sql                 # Schéma PostgreSQL
└── go.mod
```

### 5.3 API REST (MVP)

```
GET    /api/repertoire/:color        # Récupérer un répertoire
POST   /api/repertoire/:color/node   # Ajouter un nœud
DELETE /api/repertoire/:color/node/:id  # Supprimer un nœud
POST   /api/pgn/import               # Importer un fichier PGN
POST   /api/pgn/analyze              # Analyser une partie vs répertoire
GET    /api/health                   # Health check
```

### 5.4 Architecture Frontend

```
src/
├── components/
│   ├── App.tsx
│   ├── Board/
│   │   ├── ChessBoard.tsx
│   │   └── MoveHistory.tsx
│   ├── Tree/
│   │   ├── RepertoireTree.tsx
│   │   ├── TreeNode.tsx
│   │   └── TreeEdge.tsx
│   ├── PGN/
│   │   ├── FileUploader.tsx
│   │   └── AnalysisResult.tsx
│   ├── Repertoire/
│   │   ├── RepertoireSelector.tsx
│   │   └── BranchReview.tsx
│   └── UI/
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Toast.tsx
├── hooks/
│   ├── useRepertoire.ts
│   ├── useChess.ts
│   └── useTreeLayout.ts
├── services/
│   ├── api.ts
│   └── pgnParser.ts
├── stores/
│   └── repertoireStore.ts
├── types/
│   └── index.ts
└── styles/
    └── main.css
```

---

## 6. Composant Tree Visual - Spécifications Détaillées

### 6.1 Objectif

Créer un composant React affichant l'arbre des coups comme un diagramme GitHub-style (gauche → droite) avec zoom/pan et sélection de nœud. Ce composant est critique et sera développé en dernier.

### 6.2 Layout Algorithmique

```typescript
interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  san: string;
  depth: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  path: string;
}

function computeTreeLayout(root: RepertoireNode): TreeLayout {
  // Algorithme de type Reingold-Tilford ou Walker's algorithm
  // Objectif : minimiser les croisements, espacement constant
  // Branches profondes = nœuds rapprochés
}
```

### 6.3 Interactions

| Interaction | Comportement |
|-------------|--------------|
| Scroll molette | Zoom in/out centré sur souris |
| Clic + drag | Pan du viewport |
| Clic nœud | Sélectionne le nœud, met à jour échiquier |
| Double-clic nœud | Ouvre mode révision de la branche |
| Bouton reset | Revient à la racine |

### 6.4 Rendu Graphique

```tsx
<svg className="repertoire-tree">
  <g className="viewport" transform={translate(x, y) scale(zoom)}>
    <TreeEdges edges={layout.edges} />
    <TreeNodes 
      nodes={layout.nodes} 
      selectedNodeId={selectedId}
      onNodeClick={handleNodeClick}
    />
  </g>
  <ZoomControls onZoom={setZoom} />
  <Legend />
</svg>
```

### 6.5 Style Visuel

- **Nœud** : Cercle (r=12px) ou rectangle arrondi avec texte du coup
- **Arête** : Ligne incurvée (Bézier quadratique) avec flèche
- **Nœud sélectionné** : Contour épais, couleur différente
- **Racine** : Carré (distinct des autres nœuds)
- **Depth fade** : Opacité réduite pour les branches très profondes

---

## 7. Interface Utilisateur - Wireframes Textuels

### 7.1 Écran Principal

```
┌─────────────────────────────────────────────────────────────────┐
│  TreeChess                                            [Reset]   │
├─────────────────────────────────────────────────────────────────┤
│  [Blancs]  [Noirs]                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                             ││
│  │          ┌─────────┐                                         ││
│  │          │    e4   │                                         ││
│  │          └────┬────┘                                         ││
│  │               │                                              ││
│  │     ┌─────────┴─────────┐                                   ││
│  │     ▼                   ▼                                   ││
│  │ ┌───────┐          ┌───────┐                                ││
│  │ │  c5   │          │  e5   │                                ││
│  │ └───┬───┘          └───┬───┘                                ││
│  │     │                  │                                     ││
│  │     ▼                  ▼                                     ││
│  │  ┌──────┐           ┌──────┐                                ││
│  │  │ Nf3  │           │ Nf3  │                                ││
│  │  └──────┘           └──────┘                                ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌───────────┐ ┌─────────────────────────────────────────────┐ │
│  │  Échiquier│ │  Historique:                                │ │
│  │  ┌─────┐  │ │  1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4      │ │
│  │  │♜ ♞ ♝ │  │  [c5] [d6] [cxd4] [Nxd4]                     │ │
│  │  │♟ ♟ ♟ │  │                                              │ │
│  │  │  ·   │  │  [+] Ajouter un nouveau coup                 │ │
│  │  │♙ ♙ ♙ │  │                                              │ │
│  │  │♖ ♘ ♗ │  │  Import PGN: [📁 Choisir fichier]            │ │
│  │  └─────┘  │  └─────────────────────────────────────────────┘ │
│  └───────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Modal d'Ajout de Coup

```
┌───────────────────────────────────────────┐
│  Ajouter une réponse à c5                 │
├───────────────────────────────────────────┤
│                                           │
│    ┌─────┐  Coup: [ Nf3    ]  [Valider]   │
│    │♜ ♞ ♝│                                   │
│    │♟ ♟ ♟│  Ou jouer sur l'échiquier:        │
│    │  ·  │                                   │
│    │♙ ♙ ♙│     ┌─────┐                      │
│    │♖ ♘ ♗│     │♘    │                      │
│    └─────┘     │     │                      │
│                │    ♙│ → →                   │
│                └─────┘                      │
│                                           │
│  [Annuler]                                 │
└───────────────────────────────────────────┘
```

### 7.3 Modal Résultat Import

```
┌───────────────────────────────────────────┐
│  Import terminé                           │
├───────────────────────────────────────────┤
│                                           │
│  Parties analysées: 5                     │
│  ✓ Dans le répertoire: 23 coups           │
│  ✗ Hors répertoire: 4 coups               │
│  ◇ Nouvelles lignes: 2                    │
│                                           │
│  [Voir les erreurs]   [Voir nouvelles]    │
│                                           │
│  [Fermer]                                  │
└───────────────────────────────────────────┘
```

### 7.4 Mode Révision

```
┌─────────────────────────────────────────┐
│  Révision: Sicilienne Najdorf    [← Retour] │
├─────────────────────────────────────────┤
│                                         │
│    ┌─────┐  Branche: e4 c5 Nf3 d6       │
│    │♜ ♞ ♝│  Coup 5/6: 5. d4             │
│    │♟ ♟ ♟│                                 │
│    │  ·  │    [Rejouer la branche]       │
│    │♙ ♙ ♙│                                 │
│    │♖ ♘ ♗│                                 │
│    └─────┘                                 │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  Coup suivant ?                     ││
│  │  [ d6 ]  [ cxd4 ]  [ a6 ]  [ g6 ]   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## 8. Parcours Utilisateur Détaillés

### 8.1 Scénario 1 : Création initiale du répertoire

**Préconditions** : Application vide, premier lancement

1. L'utilisateur ouvre l'application
2. Par défaut, le répertoire "Blancs" est affiché
3. L'échiquier montre la position initiale
4. L'utilisateur joue e4 sur l'échiquier
5. Le système demande : "Ajouter e4 comme premier coup ?"
6. L'utilisateur valide
7. L'arbre affiche un nouveau nœud "e4"
8. L'utilisateur sélectionne "Noirs" et ajoute c5
9. Le répertoire de base est créé

### 8.2 Scénario 2 : Import PGN et détection d'erreurs

**Préconditions** : Répertoire existant, fichier PGN disponible

1. L'utilisateur clique sur "Import PGN"
2. Il sélectionne un fichier `mes_parties.pgn`
3. Le backend parse le fichier (5 parties détectées)
4. Pour chaque partie, le backend compare avec le répertoire
5. Le frontend affiche un résumé :
   - "23 coups dans le répertoire"
   - "4 coups hors répertoire"
   - "2 nouvelles lignes adverses"
6. L'utilisateur clique sur "Voir les erreurs"
7. Chaque erreur est listée avec la position et le coup joué
8. L'utilisateur peut corriger en ajoutant les coups manquants

### 8.3 Scénario 3 : Enrichissement via nouvelle ligne adverse

**Préconditions** : Répertoire existant, import effectué

1. Lors de l'import, une nouvelle ligne est détectée : après 1.e4 c5 2.Nf3 d6, l'adversaire a joué 3...a6 (au lieu de 3...Nc6 ou 3...e6)
2. Le système affiche : "Nouvelle ligne : 3...a6"
3. L'utilisateur clique pour développer cette branche
4. Il peut ajouter des réponses :
   - 4.Bb5+ (réponse principale)
   - Eventuellement 4.d4 ou 4.c3
5. L'arbre s'enrichit avec la nouvelle branche

### 8.4 Scénario 4 : Révision d'une branche

**Préconditions** : Répertoire avec au moins une branche

1. L'utilisateur sélectionne un nœud dans l'arbre (ex: position après 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6)
2. Il clique sur "Réviser cette branche"
3. L'échiquier affiche la position initiale
4. L'utilisateur joue les coups dans l'ordre sur l'échiquier (e4 → c5 → Nf3 → d6 → d4 → cxd4 → Nxd4 → Nf6)
5. À chaque bon coup, le système avance
6. Si mauvais coup, feedback visuel
7. À la fin, message de congratulation

---

## 9. Cas d'Erreur et Validation

### 9.1 Erreurs de Parsing PGN

| Erreur | Message | Action |
|--------|---------|--------|
| Fichier vide | "Le fichier est vide" | Inviter à choisir un autre fichier |
| Format invalide | "Format PGN non reconnu à la ligne X" | Afficher exemples de format |
| Encoding UTF-8 | "Erreur d'encodage, utilisez UTF-8" | Auto-correction si possible |
| Aucun coup trouvé | "Le fichier ne contient aucune partie" | Inviter à vérifier le fichier |

### 9.2 Erreurs de Validation des Coups

| Erreur | Message | Action |
|--------|---------|--------|
| Coup illégal | "Ce coup n'est pas légal" | Bloquer l'ajout |
| Ambiguïté SAN | "Précisez la case de départ (ex: Nge2)" | Demander notation complète |
| Position invalide | "Position incohérente" | Recharger depuis FEN |

### 9.3 Erreurs Backend

| Erreur | Message | Action |
|--------|---------|--------|
| Connexion BDD | "Erreur de connexion à la base de données" | Retry avec exponential backoff |
| Timeout | "L'opération a expiré" | Réessayer |
| JSON invalide | "Données corrompues" | Rollback transaction |

---

## 10. Roadmap : MVP → V2

### 10.1 MVP - Version 1.0 (Mois 1-2) - Développement Local

| Feature | Priorité | Estimation |
|---------|----------|------------|
| Setup projet Go + PostgreSQL | Haute | 1 jour |
| Migration schéma BDD | Haute | 0.5 jour |
| Architecture React + TypeScript | Haute | 2 jours |
| Composant Échiquier (chess.js) | Haute | 3 jours |
| CRUD répertoire (API + UI) | Haute | 4 jours |
| Parser PGN backend | Haute | 2 jours |
| Matching répertoire vs parties | Haute | 3 jours |
| Visualisation Tree GitHub-style | Haute | 5 jours |
| Mode révision | Moyenne | 3 jours |
| UI/Polish | Moyenne | 3 jours |
| **Total** | | **~27 jours** |

**Note MVP :**
- Backend Go en développement local avec PostgreSQL
- Pas d'authentification
- Pas de déploiement en production
- Les données sont stockées en base PostgreSQL locale

### 10.2 V2 - Version 2.0 (Mois 3-6) - Production

| Feature | Description |
|---------|-------------|
| **Authentification Lichess OAuth** | Login via compte Lichess (gratuit) |
| **Multi-utilisateurs** | Isolation des données par user_id |
| **API Lichess** | Import direct depuis compte Lichess |
| **Déploiement production** | Serveur + PostgreSQL cloud |
| **Tests et CI/CD** | Pipeline de déploiement |

### 10.3 V3+ - Améliorations Futures

| Feature | Description |
|---------|-------------|
| **Mode Entraînement** | Quiz "Quel coup suivant ?" avec 4 choix |
| **Répétition espacée** | Algorithme Anki-like pour révision |
| **Main line vs Sideline** | Couleurs différentes dans l'arbre |
| **Multiples répertoires** | "Club", "Compétitif", "Fun" |
| **Export PGN** | Sauvegarder son répertoire |
| **ECO automatique** | Classification ECO des positions |
| **Statistiques** | % de maîtrise par ouverture |
| **API Chess.com** | Import depuis compte Chess.com |
| **Comments/Vidéos** | Annotations sur les positions |
| **Opening explorer** | Stats Lichess sur positions |
| **Shared repertoires** | Templates communautaires |

---

## 11. Installation et Développement Local

### 11.1 Prérequis

- Go 1.21+
- PostgreSQL 15+
- Node.js 18+
- npm ou yarn

### 11.2 Setup Base de Données

```bash
# Créer la base de données
createdb treechess

# Appliquer les migrations
psql -d treechess -f migrations/001_init.sql
```

### 11.3 Lancer le Backend

```bash
cd cmd/server
go run main.go
# Backend disponible sur http://localhost:8080
```

### 11.4 Lancer le Frontend

```bash
npm install
npm run dev
# Frontend disponible sur http://localhost:5173
```

### 11.5 Variables d'Environnement

```env
# .env
DATABASE_URL=postgres://user:password@localhost:5432/treechess?sslmode=disable
PORT=8080
```

---

## 12. Annexes

### 12.1 Glossaire

| Terme | Définition |
|-------|------------|
| **SAN** | Standard Algebraic Notation (notation algébrique standard : e4, Nf3, O-O) |
| **FEN** | Forsyth-Edwards Notation (notation textuelle d'une position) |
| **ECO** | Encyclopedia of Chess Openings (classification des ouvertures A-E, 000-999) |
| **Ply** | Un demi-coup (1 coup = 2 plies) |
| **Main line** | Suite principale d'une ouverture |
| **Sideline** | Variation secondaire |
| **Trunk** | Branche principale d'un répertoire |
| **JSONB** | Type JSON binaire de PostgreSQL pour stockage efficace |

### 12.2 Référence API Chess.js

```typescript
import { Chess } from 'chess.js';

const chess = new Chess();

// Créer une position
const position = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');

// Valider et jouer un coup
if (chess.move('e4')) {
  console.log('Coup légal');
}

// Générer tous les coups légaux
const moves = chess.moves();

// Convertir en FEN
const fen = chess.fen();

// Annuler le dernier coup
chess.undo();
```

### 12.3 Structure PGN Supportée

```pgn
[Event "Casual Game"]
[Site "Lichess.org"]
[Date "2024.01.15"]
[Round "-"]
[White "Joueur1"]
[Black "Joueur2"]
[Result "1-0"]
[ECO "B90"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0
```

### 12.4 Couleurs et Thème

**Thème par défaut (clair) :**
- Fond arbre : #FFFFFF
- Nœuds : #E8E8E8 (cercle), #1A1A1A (texte)
- Arêtes : #BDBDBD
- Échiquier clair : #F0D9B5
- Échiquier foncé : #B58863
- Accent : #4A90D9

**Thème sombre (V2) :**
- Fond arbre : #1E1E1E
- Nœuds : #2D2D2D
- Arêtes : #404040
- Échiquier clair : #779556
- Échiquier foncé : #ebecd0

---

## 13. Suivi des Modifications

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-01-19 | - | Création initiale du document |
| 2.0 | 2026-01-19 | - | Passage à PostgreSQL, single-user MVP, multi-user V2, pas de déploiement avant V2 |

---

*Document généré pour TreeChess - Web App d'entraînement aux ouvertures d'échecs*
