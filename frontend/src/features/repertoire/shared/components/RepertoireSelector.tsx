import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../../../shared/components/UI';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Color, Repertoire, Category } from '../../../../types';
import { CategorySection } from './CategorySection';

interface RepertoireSelectorProps {
  color: Color;
  repertoires: Repertoire[];
  categories: Category[];
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
        cursor: isDragging ? 'grabbing' : 'grab'
      }
    : { cursor: 'grab' };

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
      {children}
    </div>
  );
}

export function RepertoireSelector({ color, repertoires, categories }: RepertoireSelectorProps) {
  const navigate = useNavigate();
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
      const rep = await createRepertoire(newName.trim(), color);
      setNewName('');
      setIsCreating(false);
      navigate(`/repertoire/${rep.id}/edit`);
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteRepertoire(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Repertoire deleted');
    } catch {
      toast.error('Failed to delete repertoire');
    } finally {
      setLoading(false);
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
          <div className="flex flex-col gap-2 p-4 bg-primary-light rounded-md mb-2">
            <span className="text-[0.85rem] text-text-muted">
              Merging {selectedIds.size} repertoires into a new one. All originals will be deleted.
            </span>
            <input
              type="text"
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              placeholder="Name for merged repertoire"
              className="flex-1 py-2 px-4 border border-border rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
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

        <div className="flex flex-col gap-2 mb-6">
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
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onRename={handleRename}
              onDelete={handleDelete}
              onEditNameChange={setEditName}
              loading={loading}
            />
          ))}

          {/* Uncategorized repertoires */}
          <DroppableUncategorized hasCategories={colorCategories.length > 0}>
            {uncategorizedRepertoires.map((rep) => (
              <DraggableRepertoireItem key={rep.id} repertoire={rep}>
                {(_isDragging, dragAttributes, dragListeners) => (
                  <div className={`flex items-center justify-between p-4 bg-bg rounded-md gap-4 mb-1${selectedIds.has(rep.id) ? ' outline-2 outline-primary outline-offset-[-2px]' : ''}`}>
                    {editingId === rep.id ? (
                      <div className="flex gap-2 flex-1 items-center">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Repertoire name"
                          className="flex-1 py-2 px-4 border border-border rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(rep.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <Button variant="primary" size="sm" onClick={() => handleRename(rep.id)} disabled={loading}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={loading}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex items-center shrink-0 cursor-grab active:cursor-grabbing p-1 text-text-muted hover:text-text"
                          {...dragAttributes}
                          {...dragListeners}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="5" cy="4" r="1.5" />
                            <circle cx="11" cy="4" r="1.5" />
                            <circle cx="5" cy="8" r="1.5" />
                            <circle cx="11" cy="8" r="1.5" />
                            <circle cx="5" cy="12" r="1.5" />
                            <circle cx="11" cy="12" r="1.5" />
                          </svg>
                        </div>
                        <label className="flex items-center shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(rep.id)}
                            onChange={() => toggleSelection(rep.id)}
                            className="w-4 h-4 cursor-pointer accent-primary"
                          />
                        </label>
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{rep.name}</span>
                          <span className="text-xs text-text-muted">
                            {rep.metadata.totalMoves} moves, depth {rep.metadata.deepestDepth}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/repertoire/${rep.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(rep.id, rep.name)}
                            disabled={loading}
                          >
                            Rename
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(rep.id, rep.name)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
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
              className="flex-1 py-2 px-4 border border-border rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
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
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Repertoire name"
              className="flex-1 py-2 px-4 border border-border rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewName('');
                }
              }}
            />
            <Button variant="primary" onClick={handleCreate} disabled={loading}>
              Create
            </Button>
            <Button variant="ghost" onClick={() => { setIsCreating(false); setNewName(''); }} disabled={loading}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setIsCreating(true)}
            disabled={loading}
            className="w-full text-center"
          >
            + Add Repertoire
          </Button>
        )}
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {draggedRepertoire ? (
          <div className="flex items-center gap-3 p-4 bg-bg-card rounded-md shadow-lg border-2 border-primary opacity-90">
            <span className="font-medium">{draggedRepertoire.name}</span>
            <span className="text-xs text-text-muted">
              {draggedRepertoire.metadata.totalMoves} moves
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
