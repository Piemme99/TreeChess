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
      title="Welcome! Set up your profile"
      size="lg"
      footer={
        <div className="modal-actions">
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
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="onboarding-section">
        <h3 className="onboarding-section-title">Chess Usernames</h3>
        <p className="onboarding-section-desc">Link your accounts to import games easily.</p>
        <div className="onboarding-usernames">
          <div className="onboarding-username-field">
            <label htmlFor="onboarding-lichess">Lichess</label>
            <input
              id="onboarding-lichess"
              type="text"
              value={lichessUsername}
              onChange={(e) => setLichessUsername(e.target.value)}
              placeholder="Lichess username"
              disabled={isLichessOAuth}
              maxLength={50}
            />
          </div>
          <div className="onboarding-username-field">
            <label htmlFor="onboarding-chesscom">Chess.com</label>
            <input
              id="onboarding-chesscom"
              type="text"
              value={chesscomUsername}
              onChange={(e) => setChesscomUsername(e.target.value)}
              placeholder="Chess.com username"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      <div className="onboarding-section">
        <h3 className="onboarding-section-title">Repertoire Templates</h3>
        <p className="onboarding-section-desc">Pick openings to start with. You can always add more later.</p>
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
      </div>
    </Modal>
  );
}
