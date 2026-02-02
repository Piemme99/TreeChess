import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '../../shared/components/UI';
import { RepertoireTree } from './shared/components/RepertoireTree';
import { MoveHistory } from './shared/components/MoveHistory';
import { TopMovesPanel } from './edit/components/TopMovesPanel';
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

type TabId = 'tree' | 'moves' | 'engine';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'moves', label: 'Moves' },
  { id: 'engine', label: 'Engine' },
];

export function RepertoireEdit() {
  // All hooks must be called first, before any conditions
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('tree');

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
      // If clicking a transposition node, navigate to the canonical node
      if (node.transpositionOf) {
        selectNode(node.transpositionOf);
      } else {
        selectNode(node.id);
      }
      setPossibleMoves([]);
    },
    [selectNode, setPossibleMoves]
  );

  const [mergeLoading, setMergeLoading] = useState(false);
  const handleMergeTranspositions = useCallback(async () => {
    if (!id) return;
    setMergeLoading(true);
    try {
      const updated = await repertoireApi.mergeTranspositions(id);
      setRepertoire(updated);
      toast.success('Transpositions merged');
    } catch {
      toast.error('Failed to merge transpositions');
    } finally {
      setMergeLoading(false);
    }
  }, [id, setRepertoire]);

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

        <div className={`flex-1 min-w-0 min-h-0 bg-bg-card overflow-hidden flex flex-col border-l border-border${activeTab === 'tree' && treeExpanded ? ' fixed inset-0 w-full h-full z-100' : ''}`}>
          {/* Action bar */}
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleMergeTranspositions} disabled={mergeLoading} title="Merge transpositions">
                {mergeLoading ? 'Merging...' : 'Merge'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExtractConfirmOpen(true)} disabled={isRootNode || actionLoading} title="Extract branch into new repertoire">
                Extract
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} disabled={isRootNode || actionLoading} title="Delete this branch">
                <span className="text-danger">Delete</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={goToRoot} title="Go to starting position">
                Root
              </Button>
            </div>
          </div>

          {/* Comment textarea */}
          {selectedNode && (
            <div className="px-3 py-2">
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

          {/* Tab bar */}
          <div className="flex border-b border-border px-3">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {activeTab === 'tree' && (
              <RepertoireTree
                repertoire={repertoire.treeData}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
                color={repertoire.color}
                isExpanded={treeExpanded}
                onToggleExpand={() => setTreeExpanded((prev) => !prev)}
              />
            )}
            {activeTab === 'moves' && (
              <div className="p-4">
                <MoveHistory
                  rootNode={repertoire.treeData}
                  selectedNodeId={selectedNodeId}
                />
              </div>
            )}
            {activeTab === 'engine' && (
              <div className="p-4">
                <TopMovesPanel
                  evaluation={engine.currentEvaluation}
                  fen={currentFEN}
                />
              </div>
            )}
          </div>
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
