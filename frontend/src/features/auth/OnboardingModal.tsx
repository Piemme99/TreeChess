import { useState, useEffect } from 'react';
import { Modal } from '../../shared/components/UI/Modal';
import { Button } from '../../shared/components/UI/Button';
import { repertoireApi } from '../../services/api';

interface Template {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      repertoireApi.listTemplates().then(setTemplates).catch(() => {});
    }
  }, [isOpen]);

  const toggleTemplate = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      onClose();
      return;
    }

    setLoading(true);
    setError('');
    try {
      await repertoireApi.seedFromTemplates(Array.from(selected));
      onClose();
    } catch {
      setError('Failed to create repertoires. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome! Add repertoires to get started"
      size="lg"
      footer={
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Skip
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {selected.size > 0
              ? `Add selected (${selected.size})`
              : 'Skip'}
          </Button>
        </div>
      }
    >
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="onboarding-templates">
        {templates.map((tmpl) => (
          <label
            key={tmpl.id}
            className={`onboarding-template-card${selected.has(tmpl.id) ? ' selected' : ''}`}
            onClick={() => toggleTemplate(tmpl.id)}
          >
            <input
              type="checkbox"
              checked={selected.has(tmpl.id)}
              onChange={() => toggleTemplate(tmpl.id)}
              className="onboarding-checkbox"
            />
            <span className={`onboarding-color-badge onboarding-color-${tmpl.color}`}>
              {tmpl.color === 'white' ? 'White' : 'Black'}
            </span>
            <div className="onboarding-template-info">
              <span className="onboarding-template-name">{tmpl.name}</span>
              <span className="onboarding-template-desc">{tmpl.description}</span>
            </div>
          </label>
        ))}
      </div>
    </Modal>
  );
}
