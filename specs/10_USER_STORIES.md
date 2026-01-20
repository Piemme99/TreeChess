# User Stories - TreeChess MVP

## Legend
- ✅ **EXISTING** - Implemented and working
- 🔶 **PARTIAL** - Basic implementation, needs refinement
- ❌ **NOT STARTED** - Not yet implemented

---

## Pages Architecture

| Path | Page | Status |
|------|------|--------|
| `/` | Dashboard | ✅ EXISTING (single-page view) |
| `/repertoire/:color` | Repertoire Edit | 🔶 PARTIAL (inline) |
| `/imports` | Import List | ❌ NOT STARTED |
| `/imports/:id` | Import Detail | ❌ NOT STARTED |

---

## US-01: Dashboard - Vue d'ensemble

**En tant que** joueur d'échecs amateur  
**Je veux** voir mes répertoires sur une page d'accueil  
**Afin de** visualiser rapidement mon progrès

### Scénarios

#### Scénario principal : Afficher les deux répertoires
```gherkin
Étant donné que je suis sur la page d'accueil
Quand la page se charge
Alors je vois une carte "White Repertoire" avec le nombre de coups
Et je vois une carte "Black Repertoire" avec le nombre de coups
Et chaque carte a un bouton "Éditer"
```

#### Scénario : Accéder à l'édition d'un répertoire
```gherkin
Étant donné que je suis sur la page d'accueil
Quand je clique sur le bouton "Éditer" de "White Repertoire"
Alors je suis redirigé vers /repertoire/white
```

### Chemin utilisateur
```
/ → Dashboard component → clique "Éditer" → navigate('/repertoire/:color')
```

### Status
- **Page Dashboard**: ✅ EXISTING (single-page, needs separation)
- **Cards avec count**: ❌ NOT STARTED
- **Navigation vers edit**: ❌ NOT STARTED (à implémenter)

---

## US-02: Visualisation de l'arbre des coups

**En tant que** joueur construisant mon répertoire  
**Je veux** voir mes lignes d'ouverture sous forme d'arbre  
**Afin de** naviguer facilement entre les variantes

### Scénarios

#### Scénario principal : Afficher l'arbre
```gherkin
Étant donné que j'ai sélectionné un répertoire
Quand l'arbre se charge
Alors je vois le nœud racine (position initiale)
Et chaque nœud affiche la notation SAN du coup
Et les nœuds sont connectés par des lignes
```

#### Scénario : Color coding
```gherkin
Étant donné que l'arbre est affiché
Quand je regarde un nœud
Alors les nœuds verts sont mes coups (dans le répertoire)
Et les nœuds rouges sont les coups adverses (pas encore dans le répertoire)
Et le nœud sélectionné est bleu
```

#### Scénario : Sélectionner un nœud
```gherkin
Étant donné que l'arbre est affiché
Quand je clique sur un nœud
Alors le nœud est sélectionné (highlight bleu)
Et l'échiquier se met à jour sur ce coup
```

### Chemin utilisateur
```
/repertoire/:color → RepertoireTreeView component (récursif)
                   → clique nœud → selectNode(nodeId)
                   → ChessBoard se met à jour
```

### Status
- **Arbre récursif**: ✅ EXISTING
- **Color coding**: ✅ EXISTING
- **Sélection nœud**: ✅ EXISTING
- **Zoom/pan**: ❌ NOT STARTED

---

## US-03: Ajouter un coup manuellement

**En tant que** joueur qui prépare une ouverture  
**Je veux** ajouter un coup à mon répertoire en jouant sur l'échiquier  
**Afin de** construire mon arbre move par move

### Scénarios

#### Scénario principal : Jouer un coup
```gherkin
Étant donné qu'un nœud est sélectionné dans l'arbre
Quand je drag & drop une pièce vers une case valide
Et le coup est légal
Alors le coup est ajouté au répertoire via l'API
Et le nouveau nœud apparaît dans l'arbre
Et l'échiquier se met à jour
```

#### Scénario : Coup illégal
```gherkin
Étant donné qu'un nœud est sélectionné dans l'arbre
Quand je tente de jouer un coup illégal
Alors un message d'erreur s'affiche
Et l'échiquier ne change pas
```

#### Scénario : Coups légaux highlightés
```gherkin
Étant donné qu'une pièce est sélectionnée
Quand je regarde l'échiquier
Alors les cases destinations possibles ont un point gris
```

### Chemin utilisateur
```
/repertoire/:color → sélectionne nœud
                   → clique pièce → highlight moves (react-chessboard)
                   → drag & drop → onPieceDrop(source, target)
                   → handleMove(san) → repertoireApi.addNode()
                   → addMove() local → refresh arbre
```

### Status
- **Drag & drop**: ✅ EXISTING (react-chessboard)
- **Validation**: ✅ EXISTING (chess.js interne)
- **API call**: ✅ EXISTING
- **Update local**: ✅ EXISTING
- **Message erreur**: ❌ NOT STARTED (toast)

---

## US-04: Basculer entre blanc et noir

**En tant que** joueur travaillant sur les deux côtés  
**Je veux** switcher entre répertoire blanc et noir  
**Afin de** visualiser les deux perspectives

### Scénarios

#### Scénario principal : Toggle
```gherkin
Étant donné que je consulte "White Repertoire"
Quand je clique sur "Black Repertoire"
Alors l'échiquier pivote (les noirs en bas)
Et l'arbre affiche le répertoire noir
```

### Chemin utilisateur
```
/repertoire/:color → radio toggle
                   → viewColor state change
                   → boardOrientation: 'white' | 'black'
                   → repertoire mis à jour
```

### Status
- **Toggle UI**: ✅ EXISTING
- **Pivot échiquier**: ✅ EXISTING
- **Repertoire switching**: ✅ EXISTING

---

## US-05: Import PGN - Upload et analyse

**En tant que** joueur qui veut enrichir son répertoire  
**Je veux** importer un fichier PGN de mes parties  
**Afin d'identifier les coups qui me manquent

### Scénarios

#### Scénario principal : Coller et importer
```gherkin
Étant donné que je suis sur la page d'import
Quand je colle un PGN dans la zone de texte
Et je clique sur "Importer"
Alors le PGN est envoyé au backend
Et une barre de chargement apparaît
Et les répertoires sont rechargés après succès
Et un message de confirmation s'affiche
```

#### Scénario : Selection couleur
```gherkin
Étant donné que la zone d'import est affichée
Quand je sélectionne "White" ou "Black"
Alors le backend analyse contre le bon répertoire
```

### Chemin utilisateur
```
/ → textarea PGN → handleImport()
→ importApi.upload(pgn)
→ POST /api/imports
→ loadRepertoires()
→ toast "Import successful!"
```

### Status
- **Textarea UI**: ✅ EXISTING
- **API integration**: ✅ EXISTING
- **Loading state**: ❌ NOT STARTED
- **Toast messages**: ❌ NOT STARTED

---

## US-06: Page Éditer Répertoire (séparée)

**En tant que** joueur qui veut se concentrer sur son répertoire  
**Je veux** une page dédiée avec arbre à gauche et échiquier à droite  
**Afin de** travailler efficacement sur mes ouvertures

### Scénarios

#### Scénario principal : Layout deux panels
```gherkin
Étant donné que je suis sur /repertoire/:color
Quand la page charge
Alors je vois un panel gauche avec l'arbre (30% largeur)
Et un panel droit avec l'échiquier (70% largeur)
Et un header avec le titre "Édition - [White|Black] Repertoire"
```

#### Scénario : Responsive
```gherkin
Étant donné que j'utilise un mobile
Quand la page charge
Alors l'arbre est caché par défaut
Et un bouton "Voir l'arbre" affiche l'arbre en modal
```

### Chemin utilisateur
```
/ → Dashboard → clique "Éditer"
→ navigate('/repertoire/:color')
→ Layout avec Header + TreePanel + BoardPanel
```

### Status
- **Route**: ❌ NOT STARTED (à créer)
- **Layout**: ❌ NOT STARTED (à créer)
- **Components**: ❌ NOT STARTED (Header, TreePanel, BoardPanel)

---

## US-07: Zoom et Pan sur l'arbre

**En tant que** joueur avec un répertoire complexe  
**Je veux** zoomer et défiler dans l'arbre  
**Afin de** naviguer dans les longues variantes

### Scénarios

#### Scénario : Zoom avec molette
```gherkin
Étant donné que l'arbre est affiché
Quand je scroll vers le haut avec la molette
Alors l'arbre grossit (max 3x)
Et quand je scroll vers le bas
Alors l'arbre rétrécit (min 0.5x)
```

#### Scénario : Pan avec drag
```gherkin
Étant donné que l'arbre est zoomé
Quand je clique et drag sur le fond
Alors l'arbre se déplace dans la direction du drag
```

#### Scénario : Reset
```gherkin
Étant donné que l'arbre est zoomé/déplacé
Quand je clique sur le bouton "Reset"
Alors l'arbre revient à la position et zoom par défaut
```

### Chemin utilisateur
```
/repertoire/:color → RepertoireTreeView
→ mouseWheel → zoom state
→ mouseDown/move → panX/panY state
→ reset button → zoom=1, panX=0, panY=0
```

### Status
- **Zoom**: ❌ NOT STARTED
- **Pan**: ❌ NOT STARTED
- **Reset**: ❌ NOT STARTED

---

## US-08: Supprimer une branche

**En tant que** joueur qui a fait une erreur  
**Je veux** supprimer une ligne de mon répertoire  
**Afin de** corriger mon arbre

### Scénarios

#### Scénario : Supprimer avec confirmation
```gherkin
Étant donné qu'un nœud (non-racine) est sélectionné
Quand je clique sur "Supprimer la branche"
Alors une modale de confirmation apparaît
Et je dois confirmer
Quand je confirme
Alors le nœud et tous ses enfants sont supprimés
Et l'arbre se met à jour
Et l'échiquier revient au parent
```

#### Scénario : Impossible de supprimer la racine
```gherkin
Étant donné que le nœud racine est sélectionné
Quand je clique sur "Supprimer la branche"
Alors le bouton est désactivé
Et un tooltip dit "Impossible de supprimer la racine"
```

### Chemin utilisateur
```
/repertoire/:color → sélectionne nœud
→ bouton "Supprimer" → ConfirmationModal
→ DELETE /api/repertoire/:color/node/:id
→ deleteNode() local → refresh arbre
```

### Status
- **API DELETE**: ✅ EXISTING (backend)
- **UI confirmation**: ❌ NOT STARTED
- **Update local**: ❌ NOT STARTED
- **Root protection**: ❌ NOT STARTED

---

## US-09: Liste des Imports

**En tant que** joueur qui importe souvent  
**Je veux** voir l'historique de mes imports  
**Afin de** retrouver et ré-analyser d'anciens fichiers

### Scénarios

#### Scénario principal : Afficher la liste
```gherkin
Étant donné que je vais sur /imports
Quand la page charge
Alors je vois une liste de tous mes imports
Chaque entrée affiche:
  - Nom du fichier
  - Date d'import
  - Couleur analysée
  - Nombre de parties
  - Bouton "Analyser"
  - Bouton "Supprimer"
```

#### Scénario : Supprimer un import
```gherkin
Étant donné que la liste des imports est affichée
Quand je clique sur l'icône supprimer d'un import
Alors une confirmation est demandée
Et quand je confirme
L'import est supprimé de la liste et de la DB
```

### Chemin utilisateur
```
/imports → ImportList component
→ useEffect → importApi.list()
→ map imports → ImportListItem
→ clique "Analyser" → navigate('/imports/:id')
→ clique "Supprimer" → ConfirmationModal → DELETE
```

### Status
- **Route /imports**: ❌ NOT STARTED
- **GET /api/analyses**: ✅ EXISTING (backend)
- **Liste UI**: ❌ NOT STARTED
- **Delete UI**: ❌ NOT STARTED

---

## US-10: Détail d'un Import - Analyse des gaps

**En tant que** joueur qui veut compléter son répertoire  
**Je veux** voir les résultats d'analyse de mon PGN  
**Afin d'identifier et ajouter les coups qui me manquent

### Scénarios

#### Scénario principal : Afficher les résultats
```gherkin
Étant donné que je suis sur /imports/:id
Quand la page charge
Alors je vois 3 cartes de résumé:
  - "Dans le répertoire": X coups (déjà présents)
  - "Erreurs": Y coups (mes coups manquants)
  - "Nouvelles lignes": Z coups (coups adverses manquants)
```

#### Scénario : Section "Erreurs"
```gherkin
Étant donné que la section "Erreurs" est affichée
Quand je déroule la section
Alors je vois chaque coup manquant avec:
  - La position (FEN)
  - Le coup SAN qui aurait dû être joué
  - Un bouton "Ajouter au répertoire"
  - Un bouton "Ignorer"
```

#### Scénario : Ajouter depuis l'analyse
```gherkin
Étant donné que je vois un coup dans "Erreurs"
Quand je clique sur "Ajouter au répertoire"
Alors je suis redirigé vers /repertoire/:color
Et le nœud parent est sélectionné
Et une modale "Ajouter un coup" s'ouvre avec le coup pré-rempli
```

### Chemin utilisateur
```
/imports → clique "Analyser" → navigate('/imports/:id')
→ ImportDetail component
→ GET /api/analyses/:id
→ SummaryCards (InRepertoire, Errors, NewLines)
→ drill-down → MoveList
→ clique "Ajouter" → navigate + sessionStorage context
```

### Status
- **Route /imports/:id**: ❌ NOT STARTED
- **GET /api/analyses/:id**: ✅ EXISTING (backend)
- **Summary cards UI**: ❌ NOT STARTED
- **Move classification display**: ❌ NOT STARTED
- **Navigation vers edit**: ❌ NOT STARTED

---

## US-11: Navigation "Ajouter depuis analyse"

**En tant que** joueur qui veut corriger ses gaps  
**Je veux** être guidé vers la bonne position quand j'ajoute un coup  
**Afin de** ne pas chercher manuellement dans l'arbre

### Scénarios

#### Scénario principal : Context preservation
```gherkin
Étant donné que je clique "Ajouter" sur un coup de l'analyse
Quand la page /repertoire/:color charge
Alors le nœud parent est automatiquement sélectionné
Et la modale "Ajouter un coup" s'ouvre
Et le coup manquant est pré-rempli dans le champ SAN
```

#### Scénario : Context storage
```gherkin
Étant donné que je clique "Ajouter" sur un coup
Quand la navigation se fait
Alors les infos sont stockées dans sessionStorage:
  {"color":"white","parentId":"uuid","fen":"...","moveSAN":"e4"}
Et à la page suivante, le context est lu et appliqué
```

### Chemin utilisateur
```
/imports/:id → clique "Ajouter"
→ sessionStorage.setItem('addMoveContext', JSON.stringify(...))
→ navigate('/repertoire/:color')
→ useEffect lit context → open AddMoveModal → pre-fill
→ sessionStorage.removeItem('addMoveContext')
```

### Status
- **sessionStorage logic**: ❌ NOT STARTED
- **AddMoveModal UI**: ❌ NOT STARTED
- **Pre-fill move**: ❌ NOT STARTED
- **Context cleanup**: ❌ NOT STARTED

---

## Résumé des Statuts

| Story | Page | Status |
|-------|------|--------|
| US-01: Dashboard | `/` | 🔶 PARTIAL |
| US-02: Arbre | `/repertoire/:color` | ✅ EXISTING |
| US-03: Ajouter coup | `/repertoire/:color` | ✅ EXISTING |
| US-04: Toggle B/W | `/repertoire/:color` | ✅ EXISTING |
| US-05: Import PGN | `/` | 🔶 PARTIAL |
| US-06: Page Edit | `/repertoire/:color` | ❌ NOT STARTED |
| US-07: Zoom/Pan | `/repertoire/:color` | ❌ NOT STARTED |
| US-08: Supprimer | `/repertoire/:color` | ❌ NOT STARTED |
| US-09: Liste Imports | `/imports` | ❌ NOT STARTED |
| US-10: Détail Import | `/imports/:id` | ❌ NOT STARTED |
| US-11: Navigation | `/repertoire/:color` | ❌ NOT STARTED |

---

## Dépendances entre Stories

```
US-01 (Dashboard) ──> US-06 (Page Edit)
                        │
US-02 (Arbre) ─────────┘
US-03 (Ajouter) ───────┘
US-04 (Toggle) ────────┘
                        │
US-05 (Import) ──> US-09 (Liste) ──> US-10 (Détail) ──> US-11 (Navigation)
```

---

## Routes à créer

```typescript
// Router config
const routes = [
  { path: '/', component: Dashboard },
  { path: '/repertoire/:color', component: RepertoireEdit },
  { path: '/imports', component: ImportList },
  { path: '/imports/:id', component: ImportDetail },
]
```

---

## Components React à créer

```
src/
├── components/
│   ├── dashboard/
│   │   ├── RepertoireCard.tsx
│   │   └── ImportSection.tsx
│   ├── repertoire/
│   │   ├── RepertoireEditPage.tsx
│   │   ├── TreePanel.tsx
│   │   ├── BoardPanel.tsx
│   │   ├── AddMoveModal.tsx
│   │   ├── DeleteBranchModal.tsx
│   │   └── ZoomControls.tsx
│   └── import/
│       ├── ImportListPage.tsx
│       ├── ImportListItem.tsx
│       └── ImportDetailPage.tsx
```

---

## API Endpoints utilisés

| Endpoint | Story | Status |
|----------|-------|--------|
| GET /api/repertoire/:color | US-01, US-02, US-03 | ✅ EXISTING |
| POST /api/repertoire/:color/node | US-03, US-11 | ✅ EXISTING |
| DELETE /api/repertoire/:color/node/:id | US-08 | ✅ EXISTING |
| POST /api/imports | US-05 | ✅ EXISTING |
| GET /api/analyses | US-09 | ✅ EXISTING |
| GET /api/analyses/:id | US-10 | ✅ EXISTING |
| DELETE /api/analyses/:id | US-09 | ✅ EXISTING |
