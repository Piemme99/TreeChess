# Epic 6: Repertoire CRUD

**Objective:** Implement repertoire creation, editing, and deletion operations

**Status:** Not Started  
**Dependencies:** Epic 5 (Tree Visual), Epic 4b (Board Component)

---

## 1. Objective

Implement full CRUD operations for repertoires:
- Create initial White and Black repertoires
- Add nodes (moves) to the tree
- Delete nodes and branches from the tree
- Navigate through the tree
- Undo/redo operations (optional MVP)
- Persist changes to backend

---

## 2. Definition of Done

- [ ] Repertoires are loaded on startup
- [ ] Adding a move works (from board or SAN input)
- [ ] Deleting a node works
- [ ] Deleting a branch (with children) works
- [ ] Tree updates in real-time
- [ ] Board updates when node is selected
- [ ] Error handling for invalid operations
- [ ] Loading states during API calls

---

## 3. Tasks

### 3.1 Repertoire Edit Page

**File: `src/components/Repertoire/RepertoireEdit.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RepertoireTree } from '../Tree/RepertoireTree';
import { ChessBoard } from '../Board/ChessBoard';
import { Button } from '../UI/Button';
import { Modal } from '../UI/Modal';
import { Loading } from '../UI/Loading';
import { useRepertoireStore } from '../../stores/repertoireStore';
import { useToastStore } from '../../stores/toastStore';
import { ChessValidator } from '../../utils/chessValidator';
import { RepertoireNode } from '../../services/api';

export function RepertoireEdit() {
  const { color } = useParams<{ color: string }>();
  const navigate = useNavigate();
  const {
    selectedColor,
    whiteRepertoire,
    blackRepertoire,
    selectedNode,
    isLoading,
    error,
    setSelectedColor,
    setSelectedNode,
    loadRepertoire,
    addNode,
    deleteNode,
  } = useRepertoireStore();
  
  const { addToast } = useToastStore();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sanInput, setSanInput] = useState('');
  const [boardFEN, setBoardFEN] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const isWhite = color === 'white';
  const repertoire = isWhite ? whiteRepertoire : blackRepertoire;
  const currentNode = selectedNode;

  // Load repertoire on mount
  useEffect(() => {
    if (color === 'white' || color === 'black') {
      setSelectedColor(color as 'white' | 'black');
    }
  }, [color, setSelectedColor]);

  // Update board FEN when node is selected
  useEffect(() => {
    if (currentNode) {
      setBoardFEN(currentNode.fen);
    } else {
      setBoardFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    }
  }, [currentNode]);

  // Handle node selection from tree
  const handleNodeSelect = useCallback((node: RepertoireNode) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  // Open add move modal
  const handleOpenAddModal = () => {
    setSanInput('');
    setIsAddModalOpen(true);
  };

  // Validate and add move
  const handleAddMove = async () => {
    if (!sanInput.trim() || !currentNode || !repertoire) return;

    setIsValidating(true);
    try {
      const validator = new ChessValidator(currentNode.fen);
      const result = validator.validateMove(sanInput.trim());

      if (!result) {
        addToast('Invalid move. Please check the notation.', 'error');
        setIsValidating(false);
        return;
      }

      // Add the move
      await addNode(
        currentNode.id,
        sanInput.trim(),
        result.san,
        currentNode.moveNumber + (currentNode.colorToMove === 'b' ? 1 : 0)
      );

      addToast('Move added successfully', 'success');
      setIsAddModalOpen(false);
      setSanInput('');
    } catch (err) {
      addToast('Failed to add move', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle move from board
  const handleBoardMove = async (move: { from: string; to: string }) => {
    if (!currentNode || !repertoire) return;

    const sanMove = `${move.from}${move.to}`;
    
    try {
      await addNode(
        currentNode.id,
        sanMove,
        sanMove,
        currentNode.moveNumber + (currentNode.colorToMove === 'b' ? 1 : 0)
      );

      addToast('Move added', 'success');
    } catch (err) {
      addToast('Failed to add move', 'error');
    }
  };

  // Delete node/branch
  const handleDeleteNode = async () => {
    if (!currentNode || !selectedNode) return;

    const confirmed = window.confirm(
      `Delete "${currentNode.move || 'root'}" and all its branches?`
    );

    if (!confirmed) return;

    try {
      await deleteNode(currentNode.id);
      addToast('Branch deleted', 'success');
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  };

  // Go back to root
  const handleGoToRoot = () => {
    setSelectedNode(null);
  };

  if (isLoading && !repertoire) {
    return <Loading text="Loading repertoire..." />;
  }

  if (error) {
    return (
      <div className="repertoire-edit">
        <div className="error-message">{error}</div>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="repertoire-edit">
      <div className="repertoire-edit__header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back
        </Button>
        <h1>{isWhite ? '♔ White' : '♚ Black'} Repertoire</h1>
        <div className="repertoire-edit__actions">
          <Button variant="secondary" onClick={handleGoToRoot} disabled={!currentNode}>
            Go to Root
          </Button>
          <Button variant="danger" onClick={handleDeleteNode} disabled={!currentNode}>
            Delete Branch
          </Button>
          <Button onClick={handleOpenAddModal} disabled={!currentNode}>
            + Add Move
          </Button>
        </div>
      </div>

      <div className="repertoire-edit__content">
        <div className="repertoire-edit__tree">
          {repertoire && (
            <RepertoireTree
              repertoire={repertoire.treeData}
              selectedNodeId={selectedNode?.id}
              onNodeSelect={handleNodeSelect}
              width={500}
              height={600}
            />
          )}
        </div>

        <div className="repertoire-edit__board">
          <ChessBoard
            initialFEN={boardFEN}
            onMove={handleBoardMove}
            interactive={!!currentNode}
            selectedSquare={null}
            onSquareSelect={() => {}}
          />
          
          {currentNode && (
            <div className="current-position-info">
              <p>Position: {currentNode.fen.split(' ')[0]}</p>
              <p>Move number: {currentNode.moveNumber}</p>
              {currentNode.move && <p>Last move: {currentNode.move}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Add Move Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Move"
      >
        <div className="add-move-form">
          <div className="form-group">
            <label htmlFor="san-input">Move (SAN notation)</label>
            <input
              id="san-input"
              type="text"
              value={sanInput}
              onChange={(e) => setSanInput(e.target.value)}
              placeholder="e.g., e4, Nf3, O-O, exd5"
              disabled={isValidating}
              autoFocus
            />
            <small>e4, Nf3, O-O, exd5=Q, etc.</small>
          </div>

          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button onClick={handleAddMove} isLoading={isValidating}>
              Add Move
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

### 3.2 CSS for Edit Page

**File: `src/components/Repertoire/RepertoireEdit.css`**

```css
.repertoire-edit {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: var(--spacing-md);
}

.repertoire-edit__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.repertoire-edit__header h1 {
  flex: 1;
  text-align: center;
}

.repertoire-edit__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.repertoire-edit__content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: var(--spacing-lg);
  flex: 1;
  overflow: hidden;
}

.repertoire-edit__tree {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fff;
}

.repertoire-edit__board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.current-position-info {
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-muted);
}

.current-position-info p {
  margin: 4px 0;
}

.add-move-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group label {
  font-weight: 500;
}

.form-group input {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 16px;
}

.form-group small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.error-message {
  padding: var(--spacing-lg);
  background: #fee;
  color: var(--color-danger);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

@media (max-width: 900px) {
  .repertoire-edit__content {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  
  .repertoire-edit__tree {
    min-height: 300px;
  }
}
```

### 3.3 Add Move from Analysis

When adding a move from the analysis page (Epic 7), navigate to the edit page with the correct node pre-selected:

**File: `src/utils/navigation.ts`**

```typescript
export function navigateToAddNode(
  color: 'white' | 'black',
  nodeId: string,
  fen: string
): void {
  // Store the node info in session storage for cross-page navigation
  sessionStorage.setItem('pendingAddNode', JSON.stringify({
    color,
    parentId: nodeId,
    fen,
  }));
  
  // Navigate to edit page
  window.location.href = `/repertoire/${color}/edit`;
}

export function getPendingAddNode(): { color: 'white' | 'black'; parentId: string; fen: string } | null {
  const data = sessionStorage.getItem('pendingAddNode');
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearPendingAddNode(): void {
  sessionStorage.removeItem('pendingAddNode');
}
```

---

## 4. User Flow

### 4.1 Adding a Move

1. User clicks on a node in the tree
2. Board updates to show that position
3. User clicks "+ Add Move" button
4. Modal opens with SAN input
5. User types "Nf3" or plays on board
6. System validates move (chess.js)
7. If valid, API is called to add node
8. Tree updates, toast shows success

### 4.2 Deleting a Branch

1. User clicks on a node in the tree
2. User clicks "Delete Branch" button
3. Confirmation dialog appears
4. User confirms
5. API is called to delete node
6. Tree updates, toast shows success

### 4.3 Navigating

1. User clicks on a node in the tree
2. Board updates to show that position
3. Move history shows path from root

---

## 5. Validation Rules

### 5.1 Move Validation

- Move must be legal from current position
- SAN notation must be valid
- For promotions, must specify piece (e.g., `e8=Q`)

### 5.2 Unique Response Constraint

For a given parent node, only one move with the same SAN can exist. If the user tries to add a move that already exists, show a message: "This move already exists in the repertoire."

### 5.3 Deletion Rules

- Can delete any node except the root
- When deleting a node, all children are also deleted
- Confirmation required for deletion

---

## 6. Dependencies to Other Epics

- Tree Visual (Epic 5) for tree display
- Board Component (Epic 4b) for board display
- Backend API (Epic 2) for CRUD operations
- Chess Logic (Epic 3) for move validation

---

## 7. Notes

### 7.1 Undo Operation

For MVP, no undo feature. User can manually delete incorrectly added nodes.

### 7.2 Auto-save

Changes are saved immediately to the backend. No local draft state.

### 7.3 Offline Support

If backend is not reachable, show error and suggest retry. No offline editing for MVP.
