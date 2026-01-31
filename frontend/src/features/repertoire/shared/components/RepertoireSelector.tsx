import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../../shared/components/UI';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Color, Repertoire } from '../../../../types';

interface RepertoireSelectorProps {
  color: Color;
  repertoires: Repertoire[];
}

export function RepertoireSelector({ color, repertoires }: RepertoireSelectorProps) {
  const navigate = useNavigate();
  const { createRepertoire, deleteRepertoire, renameRepertoire, mergeRepertoires } = useRepertoireStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const [mergeName, setMergeName] = useState('');

  const isWhite = color === 'white';

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
      await createRepertoire(newName.trim(), color);
      setNewName('');
      setIsCreating(false);
      toast.success('Repertoire created');
    } catch {
      toast.error('Failed to create repertoire');
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

  return (
    <div className={`flex-1 bg-bg-card rounded-lg p-6 shadow-md ${isWhite ? 'border-t-4 border-t-[#f5f5f5]' : 'border-t-4 border-t-[#333]'}`}>
      <div className="flex items-center gap-4 mb-6">
        <span className="text-[2rem]">{isWhite ? '\u2654' : '\u265A'}</span>
        <h3 className="text-xl font-semibold">{isWhite ? 'White' : 'Black'} Repertoires</h3>
        {selectedIds.size >= 2 && !isMerging && (
          <Button variant="primary" size="sm" onClick={() => setIsMerging(true)} disabled={loading}>
            Merge Selected ({selectedIds.size})
          </Button>
        )}
      </div>

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
        {repertoires.length === 0 ? (
          <div className="text-text-muted italic p-4 text-center">
            No repertoires yet. Create one to get started.
          </div>
        ) : (
          repertoires.map((rep) => (
            <div key={rep.id} className={`flex items-center justify-between p-4 bg-bg rounded-md gap-4${selectedIds.has(rep.id) ? ' outline-2 outline-primary outline-offset-[-2px]' : ''}`}>
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
          ))
        )}
      </div>

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
          + Add {isWhite ? 'White' : 'Black'} Repertoire
        </Button>
      )}
    </div>
  );
}
