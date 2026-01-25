import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '../../shared/components/UI';
import { MoveHistory } from './shared/components/MoveHistory';
import { RepertoireTree } from './shared/components/RepertoireTree';
import { TopMovesPanel } from './edit/components/TopMovesPanel';
import { useRepertoireLoader } from './edit/hooks/useRepertoireLoader';
import { usePendingAddNode } from './edit/hooks/usePendingAddNode';
import { useMoveActions } from './edit/hooks/useMoveActions';
import { useEngine } from './edit/hooks/useEngine';
import { findNode } from './edit/utils/nodeUtils';
import { STARTING_FEN } from './edit/utils/constants';
import type { RepertoireNode } from '../../types';
import { BoardSection } from './edit/components/BoardSection';
import { AddMoveModal } from './edit/components/AddMoveModal';
import { DeleteModal } from './edit/components/DeleteModal';

export function RepertoireEdit() {
  // All hooks must be called first, before any conditions
  const navigate = useNavigate();
  const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [prefillMove, setPrefillMove] = useState('');

  const { color, repertoire, selectedNodeId, loading, selectNode, setRepertoire } = useRepertoireLoader();
  const engine = useEngine();

  const selectedNode = repertoire && selectedNodeId ? findNode(repertoire.treeData, selectedNodeId) : null;
  const currentFEN = selectedNode?.fen || STARTING_FEN;
  const isRootNode = selectedNode?.id === repertoire?.treeData?.id;

  usePendingAddNode(repertoire, color, selectNode, (move: string) => {
    setPrefillMove(move);
    setAddMoveModalOpen(true);
  });

  const { actionLoading, possibleMoves, setPossibleMoves, handleBoardMove, handleAddMoveSubmit, handleDeleteBranch } =
    useMoveActions(selectedNode, currentFEN, color, setRepertoire, selectNode);

  const handleNodeClick = useCallback(
    (node: RepertoireNode) => {
      selectNode(node.id);
      setPossibleMoves([]);
    },
    [selectNode, setPossibleMoves]
  );

const goToRoot = useCallback(() => {
    if (repertoire) {
      selectNode(repertoire.treeData.id);
    }
  }, [repertoire, selectNode]);

  useEffect(() => {
    if (currentFEN) {
      engine.analyze(currentFEN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFEN]);

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
          {color === 'white' ? '♔' : '♚'} {color === 'white' ? 'White' : 'Black'} - Edit
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
          <RepertoireTree repertoire={repertoire.treeData} selectedNodeId={selectedNodeId} onNodeClick={handleNodeClick} color={color!} />
        </div>

        <BoardSection
          selectedNode={selectedNode}
          repertoire={repertoire}
          currentFEN={currentFEN}
          color={color}
          possibleMoves={possibleMoves}
          setPossibleMoves={setPossibleMoves}
          onMove={handleBoardMove}
          currentEvaluation={engine.currentEvaluation}
          isAnalyzing={engine.isAnalyzing}
        />
      </div>

      <div className="repertoire-edit-bottom">
        <MoveHistory rootNode={repertoire.treeData} selectedNodeId={selectedNodeId} />
        <div className="repertoire-edit-actions">
          <Button variant="primary" onClick={() => setAddMoveModalOpen(true)} disabled={actionLoading}>
            + Add move
          </Button>
          <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)} disabled={isRootNode || actionLoading}>
            Delete last
          </Button>
        </div>
        {engine.currentEvaluation && engine.currentEvaluation.pv && engine.currentEvaluation.pv.length > 0 && (
          <TopMovesPanel evaluation={engine.currentEvaluation} fen={currentFEN} />
        )}
      </div>

      <AddMoveModal
        isOpen={addMoveModalOpen}
        onClose={() => setAddMoveModalOpen(false)}
        onSubmit={handleAddMoveSubmit}
        actionLoading={actionLoading}
        prefillMove={prefillMove}
        evaluation={engine.currentEvaluation}
        fen={currentFEN}
      />

      <DeleteModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteBranch}
        moveName={selectedNode?.move}
        actionLoading={actionLoading}
      />
    </div>
  );
}