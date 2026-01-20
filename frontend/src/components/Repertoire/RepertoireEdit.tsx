import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRepertoireStore } from '../../stores/repertoireStore';
import { repertoireApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, Modal, ConfirmModal, Loading } from '../UI';
import { ChessBoard } from '../Board/ChessBoard';
import { RepertoireTree } from '../Tree/RepertoireTree';
import { isValidMove, makeMove, getShortFEN, getLegalMoves } from '../../utils/chess';
import type { Color, RepertoireNode, AddNodeRequest } from '../../types';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function RepertoireEdit() {
  const { color } = useParams<{ color: Color }>();
  const navigate = useNavigate();

  const {
    whiteRepertoire,
    blackRepertoire,
    selectedNodeId,
    loading,
    setRepertoire,
    selectNode,
    setLoading
  } = useRepertoireStore();

  const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moveInput, setMoveInput] = useState('');
  const [moveError, setMoveError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  const repertoire = color === 'white' ? whiteRepertoire : blackRepertoire;

  useEffect(() => {
    const loadRepertoire = async () => {
      if (!color || (color !== 'white' && color !== 'black')) {
        navigate('/');
        return;
      }

      if (!repertoire) {
        setLoading(true);
        try {
          const data = await repertoireApi.get(color);
          setRepertoire(color, data);
          selectNode(data.treeData.id);
        } catch {
          toast.error('Failed to load repertoire');
          navigate('/');
        } finally {
          setLoading(false);
        }
      } else if (!selectedNodeId) {
        selectNode(repertoire.treeData.id);
      }
    };

    loadRepertoire();
  }, [color, repertoire, selectedNodeId, setRepertoire, selectNode, setLoading, navigate]);

  useEffect(() => {
    setPossibleMoves([]);
  }, [selectedNodeId]);

  const findNode = useCallback((node: RepertoireNode, id: string): RepertoireNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }, []);

  const selectedNode = repertoire && selectedNodeId
    ? findNode(repertoire.treeData, selectedNodeId)
    : null;

  const currentFEN = selectedNode?.fen || STARTING_FEN;
  const isRootNode = selectedNode?.id === repertoire?.treeData.id;

  const handleNodeClick = useCallback((node: RepertoireNode) => {
    selectNode(node.id);
    setPossibleMoves([]);
  }, [selectNode]);

  const handleBoardMove = useCallback(async (move: { san: string }) => {
    if (!color || !selectedNode || !repertoire) return;

    const existingMove = selectedNode.children.find(c => c.move === move.san);
    if (existingMove) {
      selectNode(existingMove.id);
      return;
    }

    const newFEN = makeMove(currentFEN, move.san);
    if (!newFEN) {
      toast.error('Invalid move');
      return;
    }

    setActionLoading(true);
    try {
      const request: AddNodeRequest = {
        parentId: selectedNode.id,
        move: move.san,
        fen: getShortFEN(newFEN),
        moveNumber: selectedNode.moveNumber + (selectedNode.colorToMove === 'b' ? 1 : 0),
        colorToMove: selectedNode.colorToMove === 'w' ? 'b' : 'w'
      };

      const updatedRepertoire = await repertoireApi.addNode(color, request);
      setRepertoire(color, updatedRepertoire);

      const newNode = findNode(updatedRepertoire.treeData, selectedNode.id);
      if (newNode) {
        const addedNode = newNode.children.find(c => c.move === move.san);
        if (addedNode) {
          selectNode(addedNode.id);
        }
      }

      toast.success('Move added');
    } catch {
      toast.error('Failed to add move');
    } finally {
      setActionLoading(false);
    }
  }, [color, selectedNode, repertoire, currentFEN, setRepertoire, selectNode, findNode]);

  const handleSquareClick = useCallback((square: string) => {
    if (!color || !selectedNode) return;

    const moves = getLegalMoves(selectedNode.fen);
    const targetSquares = moves.map(m => m.to);

    if (possibleMoves.includes(square)) {
      const moveInfo = moves.find(m => m.to === square);
      if (moveInfo) {
        handleBoardMove({ san: moveInfo.san });
      }
      setPossibleMoves([]);
      return;
    }

    const targetToNodeId = new Map<string, string>();
    for (const child of selectedNode.children) {
      if (child.move) {
        const destSquare = child.move.slice(-2);
        targetToNodeId.set(destSquare, child.id);
      }
    }
    const nodeId = targetToNodeId.get(square);
    if (nodeId && repertoire) {
      const nodeForSquare = findNode(repertoire.treeData, nodeId);
      if (nodeForSquare) {
        selectNode(nodeForSquare.id);
        setPossibleMoves([]);
        return;
      }
    }

    if (targetSquares.includes(square)) {
      setPossibleMoves(targetSquares);
    } else {
      setPossibleMoves([]);
    }
  }, [color, selectedNode, repertoire, possibleMoves, selectNode, findNode, handleBoardMove]);

  const handleAddMoveSubmit = useCallback(async () => {
    if (!color || !selectedNode || !repertoire || !moveInput.trim()) return;

    if (!isValidMove(currentFEN, moveInput.trim())) {
      setMoveError('Invalid move. Please use SAN notation (e.g., e4, Nf3, O-O)');
      return;
    }

    const existingMove = selectedNode.children.find(c => c.move === moveInput.trim());
    if (existingMove) {
      setMoveError('This move already exists in the repertoire');
      return;
    }

    const newFEN = makeMove(currentFEN, moveInput.trim());
    if (!newFEN) {
      setMoveError('Invalid move');
      return;
    }

    setActionLoading(true);
    try {
      const request: AddNodeRequest = {
        parentId: selectedNode.id,
        move: moveInput.trim(),
        fen: getShortFEN(newFEN),
        moveNumber: selectedNode.moveNumber + (selectedNode.colorToMove === 'b' ? 1 : 0),
        colorToMove: selectedNode.colorToMove === 'w' ? 'b' : 'w'
      };

      const updatedRepertoire = await repertoireApi.addNode(color, request);
      setRepertoire(color, updatedRepertoire);

      const newNode = findNode(updatedRepertoire.treeData, selectedNode.id);
      if (newNode) {
        const addedNode = newNode.children.find(c => c.move === moveInput.trim());
        if (addedNode) {
          selectNode(addedNode.id);
        }
      }

      toast.success('Move added');
      setAddMoveModalOpen(false);
      setMoveInput('');
      setMoveError('');
    } catch {
      toast.error('Failed to add move');
    } finally {
      setActionLoading(false);
    }
  }, [color, selectedNode, repertoire, moveInput, currentFEN, setRepertoire, selectNode, findNode]);

  const handleDeleteBranch = useCallback(async () => {
    if (!color || !selectedNode || !repertoire || isRootNode) return;

    setActionLoading(true);
    try {
      const updatedRepertoire = await repertoireApi.deleteNode(color, selectedNode.id);
      setRepertoire(color, updatedRepertoire);

      if (selectedNode.parentId) {
        selectNode(selectedNode.parentId);
      } else {
        selectNode(updatedRepertoire.treeData.id);
      }

      toast.success('Branch deleted');
      setDeleteConfirmOpen(false);
    } catch {
      toast.error('Failed to delete branch');
    } finally {
      setActionLoading(false);
    }
  }, [color, selectedNode, repertoire, isRootNode, setRepertoire, selectNode]);

  const goToRoot = useCallback(() => {
    if (repertoire) {
      selectNode(repertoire.treeData.id);
    }
  }, [repertoire, selectNode]);

  if (loading || !repertoire) {
    return (
      <div className="repertoire-edit">
        <Loading size="lg" text="Loading repertoire..." />
      </div>
    );
  }

  return (
    <div className="repertoire-edit">
      <header className="repertoire-edit-header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <h1 className="repertoire-edit-title">
          {color === 'white' ? '♔' : '♚'} {color === 'white' ? 'White' : 'Black'} Repertoire
        </h1>
        <div className="header-spacer" />
      </header>

      <div className="repertoire-edit-content">
        <div className="repertoire-edit-tree">
          <div className="panel-header">
            <h2>Opening Tree</h2>
            <Button variant="ghost" size="sm" onClick={goToRoot}>
              Go to Root
            </Button>
          </div>
          <RepertoireTree
            repertoire={repertoire.treeData}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            color={color!}
            width={500}
            height={400}
          />
        </div>

        <div className="repertoire-edit-board">
          <div className="panel-header">
            <h2>Position</h2>
            {selectedNode && (
              <span className="position-info">
                {selectedNode.move
                  ? `${selectedNode.moveNumber}${selectedNode.colorToMove === 'w' ? '.' : '...'} ${selectedNode.move}`
                  : 'Starting Position'}
              </span>
            )}
          </div>
          <ChessBoard
            fen={currentFEN}
            orientation={color}
            onMove={handleBoardMove}
            onSquareClick={handleSquareClick}
            highlightSquares={possibleMoves}
            interactive={true}
            width={400}
          />

          <div className="repertoire-edit-actions">
            <Button
              variant="primary"
              onClick={() => {
                setMoveInput('');
                setMoveError('');
                setAddMoveModalOpen(true);
              }}
              disabled={actionLoading}
            >
              + Add Move
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isRootNode || actionLoading}
            >
              Delete Branch
            </Button>
          </div>
        </div>
      </div>

      {/* Add Move Modal */}
      <Modal
        isOpen={addMoveModalOpen}
        onClose={() => setAddMoveModalOpen(false)}
        title="Add Move"
        size="sm"
        footer={
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setAddMoveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddMoveSubmit}
              loading={actionLoading}
              disabled={!moveInput.trim()}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="add-move-form">
          <label htmlFor="move-input">Move (SAN notation)</label>
          <input
            id="move-input"
            type="text"
            value={moveInput}
            onChange={(e) => {
              setMoveInput(e.target.value);
              setMoveError('');
            }}
            placeholder="e.g., e4, Nf3, O-O, e8=Q"
            className={moveError ? 'input-error' : ''}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddMoveSubmit();
              }
            }}
          />
          {moveError && <p className="error-message">{moveError}</p>}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteBranch}
        title="Delete Branch"
        message={`Are you sure you want to delete this branch? This will remove "${selectedNode?.move || ''}" and all its variations.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
