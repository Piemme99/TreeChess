import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '../../shared/components/UI';
import { RepertoireTree } from './shared/components/RepertoireTree';
import { useRepertoireLoader } from './edit/hooks/useRepertoireLoader';
import { usePendingAddNode } from './edit/hooks/usePendingAddNode';
import { useMoveActions } from './edit/hooks/useMoveActions';
import { useEngine } from './edit/hooks/useEngine';
import { findNode } from './edit/utils/nodeUtils';
import { STARTING_FEN } from './edit/utils/constants';
import type { RepertoireNode } from '../../types';
import { BoardSection } from './edit/components/BoardSection';
import { DeleteModal } from './edit/components/DeleteModal';

export function RepertoireEdit() {
  // All hooks must be called first, before any conditions
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState(false);

  const { id, color, repertoire, selectedNodeId, loading, selectNode, setRepertoire } = useRepertoireLoader();
  const engine = useEngine();

  const selectedNode = repertoire && selectedNodeId ? findNode(repertoire.treeData, selectedNodeId) : null;
  const currentFEN = selectedNode?.fen || STARTING_FEN;

  useEffect(() => {
    engine.analyze(currentFEN);
  }, [currentFEN]);
  const isRootNode = selectedNode?.id === repertoire?.treeData?.id;

  usePendingAddNode(repertoire, id, selectNode, setRepertoire);

  const { actionLoading, possibleMoves, setPossibleMoves, handleBoardMove, handleDeleteBranch } =
    useMoveActions(selectedNode, currentFEN, id, setRepertoire, selectNode);

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

  if (loading || !repertoire) {
    return (
      <div className="repertoire-edit">
        <Loading size="lg" text="Loading repertoire..." />
      </div>
    );
  }

  return (
    <div className="repertoire-edit">
      <div className="repertoire-edit-back">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repertoires')}>
          &larr; Back
        </Button>
      </div>
      <div className="repertoire-edit-content">
        <BoardSection
          selectedNode={selectedNode}
          repertoire={repertoire}
          currentFEN={currentFEN}
          color={color}
          possibleMoves={possibleMoves}
          setPossibleMoves={setPossibleMoves}
          onMove={handleBoardMove}
          engineEvaluation={engine.currentEvaluation}
        />

        <div className={`repertoire-edit-tree${treeExpanded ? ' expanded' : ''}`}>
          <div className="panel-header">
            <div className="panel-header-left">
              {selectedNode && (
                <span className="position-info">
                  {selectedNode.move
                    ? `${selectedNode.moveNumber}${selectedNode.colorToMove === 'w' ? '.' : '...'} ${selectedNode.move}`
                    : 'Starting Position'}
                </span>
              )}
            </div>
            <div className="panel-header-right">
              <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)} disabled={isRootNode || actionLoading}>
                Delete branch
              </Button>
              <Button variant="ghost" size="sm" onClick={goToRoot}>
                Go to Root
              </Button>
            </div>
          </div>
          <RepertoireTree
            repertoire={repertoire.treeData}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            color={repertoire.color}
            isExpanded={treeExpanded}
            onToggleExpand={() => setTreeExpanded((prev) => !prev)}
          />
        </div>
      </div>

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
