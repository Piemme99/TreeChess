import { useState, useEffect } from 'react';
import { Modal } from '../../shared/components/UI/Modal';
import { Button } from '../../shared/components/UI/Button';
import { repertoireApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

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
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const triggerSync = useAuthStore((s) => s.triggerSync);

  const isLichessOAuth = user?.oauthProvider === 'lichess';

  const [lichessUsername, setLichessUsername] = useState('');
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      repertoireApi.listTemplates().then(setTemplates).catch(() => {});
      if (user?.lichessUsername) {
        setLichessUsername(user.lichessUsername);
      }
      if (user?.chesscomUsername) {
        setChesscomUsername(user.chesscomUsername);
      }
    }
  }, [isOpen, user?.lichessUsername, user?.chesscomUsername]);

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
    setLoading(true);
    setError('');
    try {
      const hasUsernameChanges =
        lichessUsername !== (user?.lichessUsername || '') ||
        chesscomUsername !== (user?.chesscomUsername || '');

      if (hasUsernameChanges) {
        await updateProfile({
          lichessUsername: lichessUsername || undefined,
          chesscomUsername: chesscomUsername || undefined,
        });
      }

      if (selected.size > 0) {
        await repertoireApi.seedFromTemplates(Array.from(selected));
      }

      // Trigger game sync now that the username and repertoires are set
      if (lichessUsername || chesscomUsername) {
        triggerSync();
      }

      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to TreeChess"
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Skip
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {selected.size > 0
              ? `Save & add repertoires (${selected.size})`
              : 'Save'}
          </Button>
        </div>
      }
    >
      {error && <div className="bg-danger-light text-danger py-2 px-4 rounded-md text-sm mb-4">{error}</div>}

      <div className="mb-6">
        <h3 className="text-base font-semibold mb-1">Chess Usernames</h3>
        <p className="text-sm text-text-muted mb-3">Link your accounts to import games easily.</p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="onboarding-lichess" className="text-sm font-medium text-text">Lichess</label>
            <input
              id="onboarding-lichess"
              type="text"
              value={lichessUsername}
              onChange={(e) => setLichessUsername(e.target.value)}
              placeholder="Lichess username"
              disabled={isLichessOAuth}
              maxLength={50}
              className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="onboarding-chesscom" className="text-sm font-medium text-text">Chess.com</label>
            <input
              id="onboarding-chesscom"
              type="text"
              value={chesscomUsername}
              onChange={(e) => setChesscomUsername(e.target.value)}
              placeholder="Chess.com username"
              maxLength={50}
              className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-1">Repertoire Templates</h3>
        <p className="text-sm text-text-muted mb-3">Pick openings to start with. You can always add more later.</p>
        <div className="flex flex-col gap-2">
          {templates.map((tmpl) => (
            <label
              key={tmpl.id}
              className={`flex items-center gap-4 p-4 border-2 rounded-md cursor-pointer transition-all duration-150 select-none ${selected.has(tmpl.id) ? 'border-primary bg-primary-light' : 'border-border hover:border-primary hover:bg-primary-light'}`}
              onClick={() => toggleTemplate(tmpl.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(tmpl.id)}
                onChange={() => toggleTemplate(tmpl.id)}
                className="w-[18px] h-[18px] shrink-0 accent-primary cursor-pointer"
              />
              <span className={`py-1 px-2 rounded-full text-xs font-semibold shrink-0 ${tmpl.color === 'white' ? 'bg-[#f5f5f5] text-[#333] border border-border' : 'bg-[#333] text-[#f5f5f5]'}`}>
                {tmpl.color === 'white' ? 'White' : 'Black'}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-base">{tmpl.name}</span>
                <span className="font-mono text-[0.8125rem] text-text-muted">{tmpl.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
