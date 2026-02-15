import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../../../shared/components/UI';
import { ConfirmModal } from '../../../../shared/components/UI';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Color, Repertoire, Category } from '../../../../types';
import { CategorySection } from './CategorySection';
import { RepertoireCard } from './RepertoireCard';

interface RepertoireSelectorProps {
  color: Color;
  repertoires: Repertoire[];
  categories: Category[];
  onImportStudy: () => void;
}

// Draggable repertoire item wrapper
function DraggableRepertoireItem({
  repertoire,
  children
}: {
  repertoire: Repertoire;
  children: (isDragging: boolean, dragAttributes: React.HTMLAttributes<HTMLElement>, dragListeners: React.DOMAttributes<HTMLElement> | undefined) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: repertoire.id,
    data: { repertoire }
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  return (
    <div ref={setNodeRef} style={style}>
      {children(isDragging, attributes, listeners)}
    </div>
  );
}

// Droppable uncategorized zone
function DroppableUncategorized({
  children,
  hasCategories
}: {
  children: React.ReactNode;
  hasCategories: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'uncategorized'
  });

  return (
    <div ref={setNodeRef}>
      {hasCategories && (
        <div
          className={`text-xs text-text-muted uppercase tracking-wider mt-2 mb-1 p-2 rounded transition-colors ${
            isOver ? 'bg-primary-light border-2 border-dashed border-primary' : ''
          }`}
        >
          Uncategorized
          {isOver && <span className="ml-2 text-primary">Drop here</span>}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

export function RepertoireSelector({ color, repertoires, categories, onImportStudy }: RepertoireSelectorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    createRepertoire,
    deleteRepertoire,
    renameRepertoire,
    mergeRepertoires,
    createCategory,
    toggleCategoryExpanded,
    expandedCategories,
    assignRepertoireToCategory
  } = useRepertoireStore();
  const [draggedRepertoire, setDraggedRepertoire] = useState<Repertoire | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Filter categories and repertoires by color
  const colorCategories = useMemo(
    () => categories.filter((c) => c.color === color),
    [categories, color]
  );

  const uncategorizedRepertoires = useMemo(
    () => repertoires.filter((r) => !r.categoryId),
    [repertoires]
  );

  const getRepertoiresForCategory = (categoryId: string) => {
    return repertoires.filter((r) => r.categoryId === categoryId);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      const rep = await createRepertoire(newName.trim(), color, newIsPublic, newDescription.trim() || undefined);
      setNewName('');
      setNewDescription('');
      setNewIsPublic(false);
      setIsCreating(false);
      navigate(`/repertoire/${rep.id}/edit`, { state: { from: location.pathname } });
    } catch {
      toast.error('Failed to create repertoire');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      await createCategory(newCategoryName.trim(), color);
      setNewCategoryName('');
      setIsCreatingCategory(false);
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setLoading(true);
    try {
      await deleteRepertoire(deleteTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast.success('Repertoire deleted');
    } catch {
      toast.error('Failed to delete repertoire');
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      await renameRepertoire(id, editName.trim());
      setEditingId(null);
      setEditName('');
      toast.success('Repertoire renamed');
    } catch {
      toast.error('Failed to rename repertoire');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeName.trim()) {
      toast.error('Please enter a name for the merged repertoire');
      return;
    }

    setLoading(true);
    try {
      await mergeRepertoires(Array.from(selectedIds), mergeName.trim());
      setSelectedIds(new Set());
      setIsMerging(false);
      setMergeName('');
      toast.success('Repertoires merged successfully');
    } catch {
      toast.error('Failed to merge repertoires');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDragStart = (event: { active: { data: { current?: { repertoire?: Repertoire } } } }) => {
    const repertoire = event.active.data.current?.repertoire;
    if (repertoire) {
      setDraggedRepertoire(repertoire);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedRepertoire(null);

    if (!over) return;

    const repertoireId = active.id as string;
    const targetCategoryId = over.id === 'uncategorized' ? null : (over.id as string);

    // Find the repertoire being dragged
    const repertoire = repertoires.find((r) => r.id === repertoireId);
    if (!repertoire) return;

    // Don't reassign if already in target category
    if (repertoire.categoryId === targetCategoryId) return;

    // For null (uncategorized), only skip if also null
    if (repertoire.categoryId === null && targetCategoryId === null) return;

    try {
      await assignRepertoireToCategory(repertoireId, targetCategoryId);
      toast.success(
        targetCategoryId
          ? 'Repertoire moved to category'
          : 'Repertoire removed from category'
      );
    } catch {
      toast.error('Failed to move repertoire');
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1">
        {/* Merge banner */}
        {selectedIds.size >= 2 && !isMerging && (
          <div className="flex items-center justify-between p-3 mb-4 bg-primary-light rounded-lg">
            <span className="text-sm text-text-muted">{selectedIds.size} repertoires selected</span>
            <Button variant="primary" size="sm" onClick={() => setIsMerging(true)} disabled={loading}>
              Merge Selected
            </Button>
          </div>
        )}

        {isMerging && (
          <div className="flex flex-col gap-2 p-4 bg-primary-light rounded-xl mb-2">
            <span className="text-[0.85rem] text-text-muted">
              Merging {selectedIds.size} repertoires into a new one. All originals will be deleted.
            </span>
            <input
              type="text"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              placeholder="Name for merged repertoire"
              className="flex-1 py-2 px-4 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMerge();
                if (e.key === 'Escape') {
                  setIsMerging(false);
                  setMergeName('');
                }
              }}
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleMerge} disabled={loading}>
                Merge
              </Button>
              <Button variant="ghost" onClick={() => { setIsMerging(false); setMergeName(''); }} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {/* Categories */}
          {colorCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              repertoires={getRepertoiresForCategory(category.id)}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => toggleCategoryExpanded(category.id)}
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
              editingId={editingId}
              editName={editName}
              onCancelEditing={cancelEditing}
              onRename={handleRename}
              onDelete={handleDelete}
              onEditNameChange={setEditName}
              onStartEditing={startEditing}
              loading={loading}
            />
          ))}

          {/* Uncategorized repertoires */}
          <DroppableUncategorized hasCategories={colorCategories.length > 0}>
            {uncategorizedRepertoires.map((rep, i) => (
              <DraggableRepertoireItem key={rep.id} repertoire={rep}>
                {(_isDragging, dragAttributes, dragListeners) => (
                  <RepertoireCard
                    repertoire={rep}
                    selected={selectedIds.has(rep.id)}
                    editing={editingId === rep.id}
                    editName={editName}
                    loading={loading}
                    index={i}
                    onOpen={() => navigate(`/repertoire/${rep.id}/edit`, { state: { from: location.pathname } })}
                    onDelete={() => handleDelete(rep.id, rep.name)}
                    onToggleSelection={() => toggleSelection(rep.id)}
                    onStartEditing={() => startEditing(rep.id, rep.name)}
                    onEditNameChange={setEditName}
                    onRename={() => handleRename(rep.id)}
                    onCancelEditing={cancelEditing}
                    dragAttributes={dragAttributes}
                    dragListeners={dragListeners}
                  />
                )}
              </DraggableRepertoireItem>
            ))}
          </DroppableUncategorized>

          {/* Empty state */}
          {repertoires.length === 0 && colorCategories.length === 0 && (
            <div className="text-text-muted italic p-4 text-center">
              No repertoires yet. Create one to get started.
            </div>
          )}
        </div>

        {/* Create category input */}
        {isCreatingCategory ? (
          <div className="flex gap-2 items-center mb-4">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="flex-1 py-2 px-4 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
                if (e.key === 'Escape') {
                  setIsCreatingCategory(false);
                  setNewCategoryName('');
                }
              }}
            />
            <Button variant="primary" onClick={handleCreateCategory} disabled={loading}>
              Create
            </Button>
            <Button variant="ghost" onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); }} disabled={loading}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsCreatingCategory(true)}
            disabled={loading}
            className="w-full text-center mb-4 text-sm"
          >
            + Add Category
          </Button>
        )}

        {/* Create repertoire input */}
        {isCreating ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Repertoire name"
                className="flex-1 py-2 px-4 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                    setNewDescription('');
                    setNewIsPublic(false);
                  }
                }}
              />
              <Button variant="primary" onClick={handleCreate} disabled={loading}>
                Create
              </Button>
              <Button variant="ghost" onClick={() => { setIsCreating(false); setNewName(''); setNewDescription(''); setNewIsPublic(false); }} disabled={loading}>
                Cancel
              </Button>
            </div>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              rows={2}
              className="py-2 px-4 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light resize-y min-h-[2.5rem]"
            />
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none pl-1">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
                className="accent-primary w-3.5 h-3.5"
              />
              Public (visible in Explore)
            </label>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsCreating(true)}
              disabled={loading}
              className="flex-1 text-center"
            >
              + Add Repertoire
            </Button>
            <Button
              variant="secondary"
              onClick={onImportStudy}
              disabled={loading}
              className="flex-1 text-center"
            >
              Import Lichess Study
            </Button>
          </div>
        )}
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {draggedRepertoire ? (
          <div className="flex items-center gap-3 p-4 bg-bg-card rounded-xl shadow-lg border-2 border-primary opacity-90">
            <span className="font-medium">{draggedRepertoire.name}</span>
            <span className="text-xs text-text-muted">
              {draggedRepertoire.metadata.totalMoves} moves
            </span>
          </div>
        ) : null}
      </DragOverlay>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Repertoire"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        loading={loading}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </DndContext>
  );
}
