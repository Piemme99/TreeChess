import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../../shared/components/UI';
import { fadeUp } from '../../../shared/utils/animations';
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
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center text-center py-12 px-6 bg-bg-card rounded-2xl shadow-sm border border-primary/10"
    >
      <div className="text-5xl mb-4 leading-none">
        <span>&#9812;</span>{' '}<span>&#9818;</span>
      </div>
      <h3 className="text-2xl font-semibold font-display mb-2">Start building your repertoire</h3>
      <p className="text-text-muted mb-6 max-w-[400px]">
        A repertoire is your personal playbook of opening moves.
      </p>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button variant="primary" onClick={() => handleCreate('white')} disabled={creating}>
          Create White Repertoire
        </Button>
        <Button variant="secondary" onClick={() => handleCreate('black')} disabled={creating}>
          Create Black Repertoire
        </Button>
      </div>
      <TemplatePicker onDone={handleTemplateDone} />
    </motion.div>
  );
}
