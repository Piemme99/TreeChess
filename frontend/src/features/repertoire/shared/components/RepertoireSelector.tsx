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
  const { createRepertoire, deleteRepertoire, renameRepertoire } = useRepertoireStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  const isWhite = color === 'white';

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

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className={`repertoire-selector ${isWhite ? 'repertoire-selector-white' : 'repertoire-selector-black'}`}>
      <div className="repertoire-selector-header">
        <span className="repertoire-selector-icon">{isWhite ? '♔' : '♚'}</span>
        <h3 className="repertoire-selector-title">{isWhite ? 'White' : 'Black'} Repertoires</h3>
      </div>

      <div className="repertoire-selector-list">
        {repertoires.length === 0 ? (
          <div className="repertoire-selector-empty">
            No repertoires yet. Create one to get started.
          </div>
        ) : (
          repertoires.map((rep) => (
            <div key={rep.id} className="repertoire-selector-item">
              {editingId === rep.id ? (
                <div className="repertoire-selector-edit-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Repertoire name"
                    className="repertoire-selector-input"
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
                  <div className="repertoire-selector-item-info">
                    <span className="repertoire-selector-item-name">{rep.name}</span>
                    <span className="repertoire-selector-item-stats">
                      {rep.metadata.totalMoves} moves, depth {rep.metadata.deepestDepth}
                    </span>
                  </div>
                  <div className="repertoire-selector-item-actions">
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
        <div className="repertoire-selector-create-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Repertoire name"
            className="repertoire-selector-input"
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
          className="repertoire-selector-add-btn"
        >
          + Add {isWhite ? 'White' : 'Black'} Repertoire
        </Button>
      )}
    </div>
  );
}
