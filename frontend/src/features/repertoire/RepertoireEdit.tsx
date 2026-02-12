import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { ensureFullFEN } from '../../shared/utils/chess';
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
import { RepertoireSettingsPanel } from './edit/components/RepertoireSettingsPanel';
import { repertoireApi } from '../../services/api';
import { useExploreStore } from '../../stores/exploreStore';
import { toast } from '../../stores/toastStore';
import { BRANCH_COLORS } from './shared/components/RepertoireTree/constants';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { Download, Settings } from 'lucide-react';

type TabId = 'tree' | 'moves' | 'engine';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'moves', label: 'Moves' },
  { id: 'engine', label: 'Engine' },
];

const READ_ONLY_TABS: { id: TabId; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'moves', label: 'Moves' },
];

export function RepertoireEdit() {
  // All hooks must be called first, before any conditions
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [treeExpanded, setTreeExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('tree');

  // Resizable split state
  const [boardWidthPercent, setBoardWidthPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setBoardWidthPercent(Math.min(75, Math.max(25, percent)));
    };
    const handlePointerUp = () => setIsDragging(false);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  // Close settings panel on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const { id, color, repertoire, selectedNodeId, loading, selectNode, setRepertoire, readOnly } = useRepertoireLoader();
  usePageTitle(readOnly ? 'View Repertoire' : 'Edit Repertoire');
  const engine = useEngine();
  const [importingFromView, setImportingFromView] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [branchNameText, setBranchNameText] = useState('');
  const branchNameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [branchColorValue, setBranchColorValue] = useState<string | null>(null);

  const selectedNode = repertoire && selectedNodeId ? findNode(repertoire.treeData, selectedNodeId) : null;
  const currentFEN = selectedNode?.fen || STARTING_FEN;

  // Sync comment text, branch name, and branch color when selected node changes
  useEffect(() => {
    setCommentText(selectedNode?.comment || '');
    setBranchNameText(selectedNode?.branchName || '');
    setBranchColorValue(selectedNode?.branchColor || null);
  }, [selectedNodeId, selectedNode?.comment, selectedNode?.branchName, selectedNode?.branchColor]);

  useEffect(() => {
    engine.analyze(currentFEN);
  }, [currentFEN, engine]);
  const isRootNode = selectedNode?.id === repertoire?.treeData?.id;

  // Read pending move arrow from sessionStorage synchronously at mount.
  // This avoids timing issues with effects and React batching.
  const pendingArrowFenRef = useRef<string | null>(null);
  const [pendingMoveArrow, setPendingMoveArrow] = useState<[string, string, string][]>(() => {
    const raw = sessionStorage.getItem('pendingAddNode');
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if ('moves' in data) return [];
      const chess = new Chess(ensureFullFEN(data.parentFEN));
      const move = chess.move(data.moveSAN);
      if (!move) return [];
      pendingArrowFenRef.current = data.parentFEN.split(' ')[0];
      return [[move.from, move.to, 'rgba(220, 53, 69, 0.8)']];
    } catch {
      return [];
    }
  });

  // Clear the pending arrow once the board moves away from the parent position
  useEffect(() => {
    if (!pendingArrowFenRef.current || pendingMoveArrow.length === 0) return;
    const currentBoard = currentFEN.split(' ')[0];
    if (currentBoard !== pendingArrowFenRef.current && currentBoard !== STARTING_FEN.split(' ')[0]) {
      pendingArrowFenRef.current = null;
      setPendingMoveArrow([]);
    }
  }, [currentFEN, pendingMoveArrow.length]);

  // Only use pending add node and edit-specific hooks when not in read-only mode
  usePendingAddNode(readOnly ? null : repertoire, readOnly ? undefined : id, selectNode, setRepertoire);
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

  const saveBranchName = useCallback((text: string) => {
    if (!id || !selectedNodeId) return;
    const currentBranchName = selectedNode?.branchName || '';
    if (text === currentBranchName) return;

    repertoireApi.updateNodeBranchName(id, selectedNodeId, text)
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save branch name'));
  }, [id, selectedNodeId, selectedNode?.branchName, setRepertoire]);

  const handleBranchNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setBranchNameText(text);
    if (branchNameSaveTimer.current) clearTimeout(branchNameSaveTimer.current);
    branchNameSaveTimer.current = setTimeout(() => saveBranchName(text), 800);
  }, [saveBranchName]);

  const handleBranchNameBlur = useCallback(() => {
    if (branchNameSaveTimer.current) {
      clearTimeout(branchNameSaveTimer.current);
      branchNameSaveTimer.current = null;
    }
    saveBranchName(branchNameText);
  }, [saveBranchName, branchNameText]);

  const handleBranchColorChange = useCallback((hex: string | null) => {
    if (!id || !selectedNodeId) return;
    setBranchColorValue(hex);
    repertoireApi.updateNodeBranchColor(id, selectedNodeId, hex || '')
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save branch color'));
  }, [id, selectedNodeId, setRepertoire]);

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

  const handleToggleCollapsed = useCallback(async (nodeId: string) => {
    if (!id) return;
    try {
      const updated = await repertoireApi.toggleNodeCollapsed(id, nodeId);
      setRepertoire(updated);
    } catch {
      toast.error('Failed to toggle collapsed state');
    }
  }, [id, setRepertoire]);

  const handleExpandToNode = useCallback(async (nodeId: string) => {
    if (!id) return;
    const updated = await repertoireApi.expandToNode(id, nodeId);
    setRepertoire(updated);
  }, [id, setRepertoire]);

  const [mainLineLoading, setMainLineLoading] = useState(false);

  const hasMainLine = useCallback((node: RepertoireNode): boolean => {
    if (node.isMainLine) return true;
    return node.children.some(hasMainLine);
  }, []);

  const handleSetMainLine = useCallback(async () => {
    if (!id || !selectedNodeId) return;
    setMainLineLoading(true);
    try {
      const updated = await repertoireApi.setMainLine(id, selectedNodeId);
      setRepertoire(updated);
      toast.success('Main line set');
    } catch {
      toast.error('Failed to set main line');
    } finally {
      setMainLineLoading(false);
    }
  }, [id, selectedNodeId, setRepertoire]);

  const handleClearMainLine = useCallback(async () => {
    if (!id) return;
    setMainLineLoading(true);
    try {
      const updated = await repertoireApi.clearMainLine(id);
      setRepertoire(updated);
      toast.success('Main line cleared');
    } catch {
      toast.error('Failed to clear main line');
    } finally {
      setMainLineLoading(false);
    }
  }, [id, setRepertoire]);

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
      <div className="py-1 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(readOnly ? '/explore' : (location.state?.from || '/repertoires'))}>
            &larr; Back
          </Button>
          {!readOnly && repertoire && (
            <div className="relative" ref={settingsRef}>
              <button
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-primary/10 hover:border-primary/30 transition-colors cursor-pointer bg-transparent text-text-muted hover:text-text"
                title="Repertoire settings"
                onClick={() => setSettingsOpen((prev) => !prev)}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              {settingsOpen && (
                <RepertoireSettingsPanel
                  repertoire={repertoire}
                  onUpdate={(updated) => {
                    setRepertoire(updated);
                  }}
                  onClose={() => setSettingsOpen(false)}
                />
              )}
            </div>
          )}
        </div>
        {readOnly && repertoire && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-text-muted">
              <span className="font-semibold text-text">{repertoire.name}</span>
              {repertoire.authorName && <span className="ml-2">by {repertoire.authorName}</span>}
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={importingFromView}
              onClick={async () => {
                if (!id) return;
                setImportingFromView(true);
                try {
                  await useExploreStore.getState().importRepertoire(id);
                } finally {
                  setImportingFromView(false);
                }
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {importingFromView ? 'Importing...' : 'Import'}
            </Button>
          </div>
        )}
      </div>
      <div ref={containerRef} className={`flex-1 flex gap-0 min-h-0 overflow-hidden max-md:flex-col${isDragging ? ' select-none' : ''}`}>
        <div className="h-full max-md:!w-full" style={{ width: `${boardWidthPercent}%` }}>
          <BoardSection
            selectedNode={selectedNode}
            repertoire={repertoire}
            currentFEN={currentFEN}
            color={color}
            possibleMoves={readOnly ? [] : possibleMoves}
            setPossibleMoves={readOnly ? (() => {}) : setPossibleMoves}
            onMove={readOnly ? (() => {}) : handleBoardMove}
            engineEvaluation={readOnly ? null : engine.currentEvaluation}
            pendingMoveArrow={readOnly ? [] : pendingMoveArrow}
          />
        </div>

        {/* Resize handle */}
        <div
          className="hidden md:flex items-center justify-center w-1.5 cursor-col-resize group shrink-0"
          onPointerDown={(e) => { e.preventDefault(); setIsDragging(true); }}
        >
          <div className="w-0.5 h-8 rounded-full bg-primary/20 group-hover:bg-primary/40 transition-colors" />
        </div>

        <div className={`min-w-0 min-h-0 bg-bg-card overflow-hidden flex flex-col border-l border-primary/10 max-md:!w-full${activeTab === 'tree' && treeExpanded ? ' fixed inset-0 w-full h-full z-100' : ''}`} style={{ width: `${100 - boardWidthPercent}%` }}>
          {/* Action bar */}
          <div className="flex items-center justify-between py-2 px-4 border-b border-primary/10 gap-2">
            <div className="flex items-center gap-2">
              {selectedNode && (
                <span className="font-mono text-sm text-text font-medium">
                  {selectedNode.move
                    ? `${selectedNode.moveNumber}${selectedNode.colorToMove === 'w' ? '.' : '...'} ${selectedNode.move}`
                    : 'Starting Position'}
                </span>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleSetMainLine} disabled={isRootNode || mainLineLoading} title="Set main line to this node">
                  Main Line
                </Button>
                {repertoire && hasMainLine(repertoire.treeData) && (
                  <Button variant="ghost" size="sm" onClick={handleClearMainLine} disabled={mainLineLoading} title="Clear main line">
                    Clear ML
                  </Button>
                )}
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
            )}
            {readOnly && (
              <Button variant="ghost" size="sm" onClick={goToRoot} title="Go to starting position">
                Root
              </Button>
            )}
          </div>

          {/* Branch name and comment */}
          {selectedNode && !readOnly && (
            <div className="px-3 py-2 flex flex-col gap-2">
              <input
                type="text"
                className="w-full py-1 px-2 text-[0.8rem] font-sans border border-primary/10 rounded-md bg-bg text-text focus:outline-none focus:border-primary placeholder:text-text-muted"
                placeholder="Branch name (e.g., Italian Game)"
                value={branchNameText}
                onChange={handleBranchNameChange}
                onBlur={handleBranchNameBlur}
              />
              {(branchNameText || branchColorValue) && (
                <div className="flex items-center gap-1.5">
                  {BRANCH_COLORS.map((c) => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => handleBranchColorChange(branchColorValue === c.hex ? null : c.hex)}
                      className="rounded-full border-2 transition-transform"
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: c.hex,
                        borderColor: branchColorValue === c.hex ? c.hex : 'transparent',
                        transform: branchColorValue === c.hex ? 'scale(1.25)' : 'scale(1)',
                      }}
                    />
                  ))}
                  {branchColorValue && (
                    <button
                      title="Clear color"
                      onClick={() => handleBranchColorChange(null)}
                      className="ml-1 text-text-muted hover:text-text text-xs leading-none"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
              <textarea
                className="w-full py-1 px-2 text-[0.8rem] font-sans border border-primary/10 rounded-md bg-bg text-text resize-y min-h-[2.5rem] focus:outline-none focus:border-primary placeholder:text-text-muted"
                placeholder="Add a note for this position..."
                value={commentText}
                onChange={handleCommentChange}
                onBlur={handleCommentBlur}
                rows={2}
              />
            </div>
          )}

          {/* Read-only: show comment and branch name (non-editable) */}
          {selectedNode && readOnly && (selectedNode.branchName || selectedNode.comment) && (
            <div className="px-3 py-2 flex flex-col gap-1.5">
              {selectedNode.branchName && (
                <div className="flex items-center gap-1.5">
                  {selectedNode.branchColor && (
                    <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedNode.branchColor }} />
                  )}
                  <span className="text-xs font-semibold text-text">{selectedNode.branchName}</span>
                </div>
              )}
              {selectedNode.comment && (
                <p className="text-xs text-text-muted whitespace-pre-wrap m-0">{selectedNode.comment}</p>
              )}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-primary/10 px-3">
            {(readOnly ? READ_ONLY_TABS : TABS).map((tab) => (
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
                onToggleCollapsed={readOnly ? undefined : handleToggleCollapsed}
                onExpandToNode={readOnly ? undefined : handleExpandToNode}
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

      {!readOnly && (
        <>
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
        </>
      )}

    </div>
  );
}
