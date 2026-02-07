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
    <div className="w-full mt-6">
      <div className="flex items-center mb-4 text-text-muted text-sm before:content-[''] before:flex-1 before:h-px before:bg-border after:content-[''] after:flex-1 after:h-px after:bg-border">
        <span className="px-4">or start from a template</span>
      </div>
      {error && <div className="bg-danger-light text-danger py-2 px-4 rounded-xl text-sm mb-4">{error}</div>}
      <div className="flex flex-col gap-2">
        {templates.map((tmpl) => (
          <label
            key={tmpl.id}
            className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-150 select-none hover:border-primary hover:bg-primary-light ${
              selected.has(tmpl.id) ? 'border-primary bg-primary-light' : 'border-border'
            }`}
            onClick={() => toggleTemplate(tmpl.id)}
          >
            <input
              type="checkbox"
              checked={selected.has(tmpl.id)}
              onChange={() => toggleTemplate(tmpl.id)}
              className="w-[18px] h-[18px] shrink-0 accent-primary cursor-pointer"
            />
            <span className={`py-1 px-2 rounded-full text-xs font-semibold shrink-0 ${
              tmpl.color === 'white'
                ? 'bg-[#f5f5f5] text-[#333] border border-border'
                : 'bg-[#333] text-[#f5f5f5]'
            }`}>
              {tmpl.color === 'white' ? 'White' : 'Black'}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-base">{tmpl.name}</span>
              <span className="font-mono text-[0.8125rem] text-text-muted">{tmpl.description}</span>
            </div>
          </label>
        ))}
      </div>
      <Button
        variant="primary"
        onClick={handleSubmit}
        loading={loading}
        disabled={selected.size === 0}
        className="w-full mt-4"
      >
        Add selected ({selected.size})
      </Button>
    </div>
  );
}
