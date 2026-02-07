import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button, ConfirmModal } from '../../../../shared/components/UI';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Category, Repertoire } from '../../../../types';

// Draggable repertoire item wrapper for category items
function DraggableCategoryItem({
  repertoire,
  children
}: {
  repertoire: Repertoire;
  children: (dragAttributes: React.HTMLAttributes<HTMLElement>, dragListeners: React.DOMAttributes<HTMLElement> | undefined) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: repertoire.id,
    data: { repertoire }
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1
      }
    : {};

  return (
    <div ref={setNodeRef} style={style}>
      {children(attributes, listeners)}
    </div>
  );
}

interface CategorySectionProps {
  category: Category;
  repertoires: Repertoire[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  editingId: string | null;
  editName: string;
  onStartEditing: (id: string, name: string) => void;
  onCancelEditing: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onEditNameChange: (name: string) => void;
  loading: boolean;
}

export function CategorySection({
  category,
  repertoires,
  isExpanded,
  onToggle,
  selectedIds,
  onToggleSelection,
  editingId,
  editName,
  onStartEditing,
  onCancelEditing,
  onRename,
  onDelete,
  onEditNameChange,
  loading
}: CategorySectionProps) {
  const navigate = useNavigate();
  const { renameCategory, deleteCategory } = useRepertoireStore();
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Make category header a drop zone
  const { setNodeRef, isOver } = useDroppable({
    id: category.id
  });

  const handleRenameCategory = async () => {
    if (!categoryName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setCategoryLoading(true);
    try {
      await renameCategory(category.id, categoryName.trim());
      setIsEditingCategory(false);
      toast.success('Category renamed');
    } catch {
      toast.error('Failed to rename category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    setCategoryLoading(true);
    try {
      await deleteCategory(category.id);
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setCategoryLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`border rounded-xl overflow-hidden mb-2 transition-colors ${
        isOver ? 'border-2 border-primary bg-primary-light' : 'border-primary/10'
      }`}
    >
      {/* Category header */}
      <div
        className={`flex items-center gap-2 p-3 cursor-pointer transition-colors ${
          isOver ? 'bg-primary-light' : 'bg-bg-card hover:bg-bg'
        }`}
        onClick={onToggle}
      >
        <span className="text-text-muted text-sm">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        {isEditingCategory ? (
          <div className="flex gap-2 flex-1 items-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Category name"
              className="flex-1 py-1 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameCategory();
                if (e.key === 'Escape') {
                  setIsEditingCategory(false);
                  setCategoryName(category.name);
                }
              }}
            />
            <Button variant="primary" size="sm" onClick={handleRenameCategory} disabled={categoryLoading}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setIsEditingCategory(false); setCategoryName(category.name); }} disabled={categoryLoading}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <span className="font-medium flex-1">{category.name}</span>
            <span className="text-xs text-text-muted bg-bg px-2 py-0.5 rounded-full">
              {repertoires.length}
            </span>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingCategory(true)}
                disabled={categoryLoading}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={categoryLoading}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7v5M9.5 7v5M3.5 4l.5 9a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 13l.5-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Repertoires list */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="category-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-1 p-2 bg-bg">
              {repertoires.length === 0 ? (
                <div className="text-text-muted italic p-2 text-center text-sm">
                  {isOver ? (
                    <span className="text-primary font-medium">Drop here to add</span>
                  ) : (
                    'No repertoires in this category'
                  )}
                </div>
              ) : (
                repertoires.map((rep) => (
                  <DraggableCategoryItem key={rep.id} repertoire={rep}>
                    {(dragAttributes, dragListeners) => (
                      <div
                        className={`flex items-center justify-between p-3 bg-bg-card rounded-xl gap-3${selectedIds.has(rep.id) ? ' outline-2 outline-primary outline-offset-[-2px]' : ''}`}
                      >
                        {editingId === rep.id ? (
                          <div className="flex gap-2 flex-1 items-center">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => onEditNameChange(e.target.value)}
                              placeholder="Repertoire name"
                              className="flex-1 py-1 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onRename(rep.id);
                                if (e.key === 'Escape') onCancelEditing();
                              }}
                            />
                            <Button variant="primary" size="sm" onClick={() => onRename(rep.id)} disabled={loading}>
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={onCancelEditing} disabled={loading}>
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
                                onChange={() => onToggleSelection(rep.id)}
                                className="w-4 h-4 cursor-pointer accent-primary"
                              />
                            </label>
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span
                                className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis cursor-text"
                                onDoubleClick={() => onStartEditing(rep.id, rep.name)}
                              >
                                {rep.name}
                              </span>
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
                                Open
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(rep.id, rep.name)}
                                disabled={loading}
                              >
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7v5M9.5 7v5M3.5 4l.5 9a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 12 13l.5-9" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </DraggableCategoryItem>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Category"
        message={
          repertoires.length > 0
            ? `Are you sure you want to delete "${category.name}"? This will also delete ${repertoires.length} repertoire(s) inside. This cannot be undone.`
            : `Are you sure you want to delete "${category.name}"? This cannot be undone.`
        }
        variant="danger"
        confirmText="Delete"
        loading={categoryLoading}
        onConfirm={handleDeleteCategory}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
