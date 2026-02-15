import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button, ConfirmModal } from '../../../../shared/components/UI';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Category, Repertoire } from '../../../../types';
import { RepertoireCard } from './RepertoireCard';

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
  const location = useLocation();
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

      {/* Repertoires grid */}
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
            <div className="p-3 bg-bg">
              {repertoires.length === 0 ? (
                <div className="text-text-muted italic p-2 text-center text-sm">
                  {isOver ? (
                    <span className="text-primary font-medium">Drop here to add</span>
                  ) : (
                    'No repertoires in this category'
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repertoires.map((rep, i) => (
                    <DraggableCategoryItem key={rep.id} repertoire={rep}>
                      {(dragAttributes, dragListeners) => (
                        <RepertoireCard
                          repertoire={rep}
                          selected={selectedIds.has(rep.id)}
                          editing={editingId === rep.id}
                          editName={editName}
                          loading={loading}
                          index={i}
                          onOpen={() => navigate(`/repertoire/${rep.id}/edit`, { state: { from: location.pathname } })}
                          onDelete={() => onDelete(rep.id, rep.name)}
                          onToggleSelection={() => onToggleSelection(rep.id)}
                          onStartEditing={() => onStartEditing(rep.id, rep.name)}
                          onEditNameChange={onEditNameChange}
                          onRename={() => onRename(rep.id)}
                          onCancelEditing={onCancelEditing}
                          dragAttributes={dragAttributes}
                          dragListeners={dragListeners}
                        />
                      )}
                    </DraggableCategoryItem>
                  ))}
                </div>
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
