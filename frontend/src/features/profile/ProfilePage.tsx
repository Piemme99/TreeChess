import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../shared/components/UI';
import { toast } from '../../stores/toastStore';
import { authApi } from '../../services/api';
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

  // Password change state
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Check if user has a password set
  useEffect(() => {
    authApi.hasPassword()
      .then(({ hasPassword }) => setHasPassword(hasPassword))
      .catch(() => setHasPassword(false));
  }, []);

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

  const handleChangePassword = async () => {
    setPasswordError('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      if (err instanceof Error && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setPasswordError(axiosError.response?.data?.error || 'Failed to change password');
      } else {
        setPasswordError('Failed to change password');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const canChangePassword = currentPassword && newPassword && confirmNewPassword;

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

        {hasPassword && (
          <div className="bg-bg-card rounded-lg p-6 border border-border">
            <h3 className="text-base font-semibold mb-1">Change Password</h3>
            <p className="text-sm text-text-muted mb-4">
              Update your account password.
            </p>
            {passwordError && (
              <div className="bg-danger-light text-danger py-2 px-4 rounded-md text-sm mb-4">
                {passwordError}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="currentPassword" className="text-sm font-medium text-text">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="newPassword" className="text-sm font-medium text-text">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  minLength={8}
                  className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="confirmNewPassword" className="text-sm font-medium text-text">
                  Confirm New Password
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  minLength={8}
                  className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleChangePassword}
                loading={passwordLoading}
                disabled={!canChangePassword}
              >
                Change Password
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
