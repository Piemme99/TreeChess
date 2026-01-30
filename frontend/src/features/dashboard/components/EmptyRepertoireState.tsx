import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../../shared/components/UI';
import { useRepertoireStore } from '../../../stores/repertoireStore';
import { toast } from '../../../stores/toastStore';
import { TemplatePicker } from './TemplatePicker';

interface EmptyRepertoireStateProps {
  onRefresh: () => void;
}

export function EmptyRepertoireState({ onRefresh }: EmptyRepertoireStateProps) {
  const navigate = useNavigate();
  const { createRepertoire } = useRepertoireStore();
  const [creating, setCreating] = useState(false);

  const handleCreate = async (color: 'white' | 'black') => {
    setCreating(true);
    try {
      const name = color === 'white' ? 'My White Repertoire' : 'My Black Repertoire';
      const rep = await createRepertoire(name, color);
      toast.success('Repertoire created');
      if (rep) {
        navigate(`/repertoire/${rep.id}/edit`);
      }
    } catch {
      toast.error('Failed to create repertoire');
    } finally {
      setCreating(false);
    }
  };

  const handleTemplateDone = () => {
    onRefresh();
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <span>&#9812;</span>{' '}<span>&#9818;</span>
      </div>
      <h3 className="empty-state-title">Start building your repertoire</h3>
      <p className="empty-state-text">
        A repertoire is your personal playbook of opening moves.
      </p>
      <div className="empty-state-actions">
        <Button variant="primary" onClick={() => handleCreate('white')} disabled={creating}>
          Create White Repertoire
        </Button>
        <Button variant="secondary" onClick={() => handleCreate('black')} disabled={creating}>
          Create Black Repertoire
        </Button>
      </div>
      <TemplatePicker onDone={handleTemplateDone} />
    </div>
  );
}
