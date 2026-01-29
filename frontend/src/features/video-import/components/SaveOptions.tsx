import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';
import { videoApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { RepertoireNode, Color } from '../../../types';

interface SaveOptionsProps {
  importId: string;
  treeData: RepertoireNode;
  color: Color;
  onColorChange: (color: Color) => void;
}

export function SaveOptions({ importId, treeData, color, onColorChange }: SaveOptionsProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the repertoire');
      return;
    }

    setSaving(true);
    try {
      const repertoire = await videoApi.save(importId, {
        name: name.trim(),
        color,
        treeData,
      });
      toast.success(`Repertoire "${repertoire.name}" created!`);
      navigate(`/repertoire/${repertoire.id}/edit`);
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || 'Failed to save repertoire');
    } finally {
      setSaving(false);
    }
  }, [importId, name, color, treeData, navigate]);

  return (
    <div className="save-options">
      <h3>Save as Repertoire</h3>

      <div className="form-group">
        <label htmlFor="rep-name">Name</label>
        <input
          id="rep-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sicilian Defense"
          disabled={saving}
        />
      </div>

      <div className="form-group">
        <label htmlFor="rep-color">Color</label>
        <select
          id="rep-color"
          value={color}
          onChange={(e) => onColorChange(e.target.value as Color)}
          disabled={saving}
        >
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </div>

      <Button
        variant="primary"
        onClick={handleSave}
        disabled={saving || !name.trim()}
        loading={saving}
      >
        Save Repertoire
      </Button>
    </div>
  );
}
