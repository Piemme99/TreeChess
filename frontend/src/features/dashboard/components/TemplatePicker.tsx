import { useState, useEffect } from 'react';
import { Button } from '../../../shared/components/UI';
import { repertoireApi } from '../../../services/api';

interface Template {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface TemplatePickerProps {
  onDone: () => void;
}

export function TemplatePicker({ onDone }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    repertoireApi.listTemplates().then(setTemplates).catch(() => {});
  }, []);

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
    if (selected.size === 0) return;

    setLoading(true);
    setError('');
    try {
      await repertoireApi.seedFromTemplates(Array.from(selected));
      onDone();
    } catch {
      setError('Failed to create repertoires. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (templates.length === 0) return null;

  return (
    <div className="template-picker">
      <div className="template-picker-divider">
        <span>or start from a template</span>
      </div>
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
      <Button
        variant="primary"
        onClick={handleSubmit}
        loading={loading}
        disabled={selected.size === 0}
        className="template-picker-submit"
      >
        Add selected ({selected.size})
      </Button>
    </div>
  );
}
