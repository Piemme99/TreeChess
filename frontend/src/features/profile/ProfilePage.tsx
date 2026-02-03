import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../shared/components/UI';
import { toast } from '../../stores/toastStore';
import type { TimeFormat } from '../../types';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const triggerSync = useAuthStore((s) => s.triggerSync);

  const isLichessOAuth = user?.oauthProvider === 'lichess';

  const [lichessUsername, setLichessUsername] = useState('');
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [timeFormats, setTimeFormats] = useState<Set<TimeFormat>>(
    new Set(['rapid', 'blitz', 'bullet'])
  );
  const [loading, setLoading] = useState(false);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setLichessUsername(user.lichessUsername || '');
      setChesscomUsername(user.chesscomUsername || '');
      if (user.timeFormatPrefs && user.timeFormatPrefs.length > 0) {
        setTimeFormats(new Set(user.timeFormatPrefs));
      }
    }
  }, [user]);

  const toggleTimeFormat = (format: TimeFormat) => {
    setTimeFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        if (next.size > 1) {
          next.delete(format);
        }
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    if (!user) return false;
    const currentPrefs = new Set(user.timeFormatPrefs || []);
    return (
      lichessUsername !== (user.lichessUsername || '') ||
      chesscomUsername !== (user.chesscomUsername || '') ||
      timeFormats.size !== currentPrefs.size ||
      [...timeFormats].some((f) => !currentPrefs.has(f))
    );
  }, [lichessUsername, chesscomUsername, timeFormats, user]);

  const handleSubmit = async () => {
    if (!hasChanges) return;

    setLoading(true);
    try {
      const usernamesChanged =
        lichessUsername !== (user?.lichessUsername || '') ||
        chesscomUsername !== (user?.chesscomUsername || '');

      await updateProfile({
        lichessUsername: lichessUsername || undefined,
        chesscomUsername: chesscomUsername || undefined,
        timeFormatPrefs: Array.from(timeFormats),
      });

      toast.success('Profile updated');

      // Trigger sync if usernames changed and at least one is set
      if (usernamesChanged && (lichessUsername || chesscomUsername)) {
        triggerSync();
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto w-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Profile</h2>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!hasChanges}
          >
            Save
          </Button>
        </div>

        <div className="bg-bg-card rounded-lg p-6 border border-border">
          <h3 className="text-base font-semibold mb-1">Chess Usernames</h3>
          <p className="text-sm text-text-muted mb-4">
            Link your accounts to import games easily.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-lichess" className="text-sm font-medium text-text">
                Lichess
              </label>
              <input
                id="profile-lichess"
                type="text"
                value={lichessUsername}
                onChange={(e) => setLichessUsername(e.target.value)}
                placeholder="Lichess username"
                disabled={isLichessOAuth}
                maxLength={50}
                className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {isLichessOAuth && (
                <span className="text-xs text-text-muted">Linked via Lichess OAuth</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-chesscom" className="text-sm font-medium text-text">
                Chess.com
              </label>
              <input
                id="profile-chesscom"
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

        <div className="bg-bg-card rounded-lg p-6 border border-border">
          <h3 className="text-base font-semibold mb-1">Time Formats</h3>
          <p className="text-sm text-text-muted mb-4">
            Select which time controls to sync from Lichess/Chess.com.
          </p>
          <div className="flex gap-2 flex-wrap">
            {(['rapid', 'blitz', 'bullet'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => toggleTimeFormat(format)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all duration-150 border-2 ${
                  timeFormats.has(format)
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-transparent text-text hover:border-primary'
                }`}
              >
                {format.charAt(0).toUpperCase() + format.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">At least one format is required.</p>
        </div>
      </div>
    </div>
  );
}
