import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '../../shared/components/UI';
import { RepertoireTree } from './shared/components/RepertoireTree';
import { useRepertoireLoader } from './edit/hooks/useRepertoireLoader';
import { usePendingAddNode } from './edit/hooks/usePendingAddNode';
import { useMoveActions } from './edit/hooks/useMoveActions';
import { useEngine } from './edit/hooks/useEngine';
import { useTreeNavigation } from './edit/hooks/useTreeNavigation';
import { findNode } from './edit/utils/nodeUtils';
import { STARTING_FEN } from './edit/utils/constants';
import type { RepertoireNode } from '../../types';
import { BoardSection } from './edit/components/BoardSection';
import { DeleteModal } from './edit/components/DeleteModal';
import { ExtractModal } from './edit/components/ExtractModal';
import { repertoireApi } from '../../services/api';
import { toast } from '../../stores/toastStore';

export function RepertoireEdit() {
  // All hooks must be called first, before any conditions
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState(false);

  const { id, color, repertoire, selectedNodeId, loading, selectNode, setRepertoire } = useRepertoireLoader();
  const engine = useEngine();
  const [commentText, setCommentText] = useState('');
  const commentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNode = repertoire && selectedNodeId ? findNode(repertoire.treeData, selectedNodeId) : null;
  const currentFEN = selectedNode?.fen || STARTING_FEN;

  // Sync comment text when selected node changes
  useEffect(() => {
    setCommentText(selectedNode?.comment || '');
  }, [selectedNodeId, selectedNode?.comment]);

  useEffect(() => {
    engine.analyze(currentFEN);
  }, [currentFEN, engine]);
  const isRootNode = selectedNode?.id === repertoire?.treeData?.id;

  usePendingAddNode(repertoire, id, selectNode, setRepertoire);
  useTreeNavigation(repertoire?.treeData, selectedNodeId, selectNode);

  const { actionLoading, possibleMoves, setPossibleMoves, handleBoardMove, handleDeleteBranch, handleExtractBranch } =
    useMoveActions(selectedNode, currentFEN, id, setRepertoire, selectNode);

  const saveComment = useCallback((text: string) => {
    if (!id || !selectedNodeId) return;
    // Only save if the comment actually changed
    const currentComment = selectedNode?.comment || '';
    if (text === currentComment) return;

    repertoireApi.updateNodeComment(id, selectedNodeId, text)
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save note'));
  }, [id, selectedNodeId, selectedNode?.comment, setRepertoire]);

  const handleCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCommentText(text);
    // Debounce save
    if (commentSaveTimer.current) clearTimeout(commentSaveTimer.current);
    commentSaveTimer.current = setTimeout(() => saveComment(text), 800);
  }, [saveComment]);

  const handleCommentBlur = useCallback(() => {
    if (commentSaveTimer.current) {
      clearTimeout(commentSaveTimer.current);
      commentSaveTimer.current = null;
    }
    saveComment(commentText);
  }, [saveComment, commentText]);

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
      <div className="h-full flex flex-col overflow-hidden">
        <Loading size="lg" text="Loading repertoire..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="py-1 px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repertoires')}>
          &larr; Back
        </Button>
      </div>
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden max-md:flex-col">
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

        <div className={`flex-1 min-w-0 min-h-0 bg-bg-card overflow-hidden flex flex-col border-l border-border${treeExpanded ? ' fixed inset-0 w-full h-full z-100' : ''}`}>
          <div className="flex items-center justify-between py-2 px-4 border-b border-border gap-2">
            <div className="flex items-center gap-2">
              {selectedNode && (
                <span className="font-mono text-sm text-text font-medium">
                  {selectedNode.move
                    ? `${selectedNode.moveNumber}${selectedNode.colorToMove === 'w' ? '.' : '...'} ${selectedNode.move}`
                    : 'Starting Position'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setExtractConfirmOpen(true)} disabled={isRootNode || actionLoading}>
                Extract branch
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)} disabled={isRootNode || actionLoading}>
                Delete branch
              </Button>
              <Button variant="ghost" size="sm" onClick={goToRoot}>
                Go to Root
              </Button>
            </div>
          </div>
          {selectedNode && (
            <div className="px-2 pb-2">
              <textarea
                className="w-full py-1 px-2 text-[0.8rem] font-sans border border-border rounded-sm bg-bg text-text resize-y min-h-[2.5rem] focus:outline-none focus:border-primary placeholder:text-text-muted"
                placeholder="Add a note for this position..."
                value={commentText}
                onChange={handleCommentChange}
                onBlur={handleCommentBlur}
                rows={2}
              />
            </div>
          )}
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

      <ExtractModal
        isOpen={extractConfirmOpen}
        onClose={() => setExtractConfirmOpen(false)}
        onConfirm={handleExtractBranch}
        defaultName={`${repertoire.name} - ${selectedNode?.move || ''}`}
        actionLoading={actionLoading}
      />

    </div>
  );
}
