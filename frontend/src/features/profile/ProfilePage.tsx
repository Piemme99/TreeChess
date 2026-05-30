import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../shared/components/UI';
import { toast } from '../../stores/toastStore';
import { authApi } from '../../services/api';
import { fadeUp } from '../../shared/utils/animations';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { getApiErrorMessage } from '../../shared/utils/apiError';
import type { TimeFormat } from '../../types';

export function ProfilePage() {
  usePageTitle('Profile');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const triggerSync = useAuthStore((s) => s.triggerSync);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

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

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // For password accounts, confirmation = password; for OAuth, confirmation = username
  const isOAuthOnly = hasPassword === false;
  const deleteConfirmationValid = isOAuthOnly
    ? deleteConfirmation === user?.username
    : deleteConfirmation.length >= 8;

  const handleDeleteAccount = useCallback(async () => {
    if (!deleteConfirmationValid || deleteLoading) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      if (isOAuthOnly) {
        await deleteAccount(undefined, deleteConfirmation);
      } else {
        await deleteAccount(deleteConfirmation);
      }
      toast.success('Your account has been deleted.');
      navigate('/');
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Failed to delete account'));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteConfirmation, deleteConfirmationValid, deleteLoading, isOAuthOnly, deleteAccount, navigate]);

  // Check if user has a password set
  useEffect(() => {
    authApi.hasPassword()
      .then(({ hasPassword }) => setHasPassword(hasPassword))
      .catch(() => setHasPassword(false)); // Default to hiding password section on error
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

      const currentPrefs = new Set(user?.timeFormatPrefs || []);
      const newFormats = Array.from(timeFormats);
      const timeFormatsAdded = newFormats.some((f) => !currentPrefs.has(f));

      await updateProfile({
        lichessUsername: lichessUsername || undefined,
        chesscomUsername: chesscomUsername || undefined,
        timeFormatPrefs: newFormats,
      });

      toast.success('Profile updated');

      // Trigger sync if usernames or time formats changed and at least one username is set
      if ((usernamesChanged || timeFormatsAdded) && (lichessUsername || chesscomUsername)) {
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
      setPasswordError(getApiErrorMessage(err, 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const canChangePassword = currentPassword && newPassword && confirmNewPassword;

  return (
    <div className="max-w-[600px] mx-auto w-full">
      <div className="flex flex-col gap-6">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-display">Profile</h2>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!hasChanges}
          >
            Save
          </Button>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="bg-bg-card rounded-2xl p-6 border border-primary/10 shadow-sm shadow-primary/10">
          <h3 className="text-base font-semibold font-display mb-1">Chess Usernames</h3>
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
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light disabled:opacity-60 disabled:cursor-not-allowed"
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
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
              />
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="bg-bg-card rounded-2xl p-6 border border-primary/10 shadow-sm shadow-primary/10">
          <h3 className="text-base font-semibold font-display mb-1">Time Formats</h3>
          <p className="text-sm text-text-muted mb-4">
            Select which time controls to sync from Lichess/Chess.com.
          </p>
          <div className="flex gap-2 flex-wrap">
            {(['rapid', 'blitz', 'bullet'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => toggleTimeFormat(format)}
                className={`py-2 px-4 rounded-xl text-sm font-medium transition-all duration-150 border-2 ${
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
        </motion.div>

        {hasPassword !== null && hasPassword && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="bg-bg-card rounded-2xl p-6 border border-primary/10 shadow-sm shadow-primary/10">
            <h3 className="text-base font-semibold font-display mb-1">Change Password</h3>
            <p className="text-sm text-text-muted mb-4">
              Update your account password.
            </p>
            {passwordError && (
              <div className="bg-danger-light text-danger py-2 px-4 rounded-xl text-sm mb-4">
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
                  className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
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
                  className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
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
                  className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
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
          </motion.div>
        )}
        {/* Logout */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Button
            variant="secondary"
            onClick={logout}
            className="w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>

        {/* Danger Zone */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="bg-bg-card rounded-2xl p-6 border border-danger/20 shadow-sm text-center">
          <h3 className="text-base font-semibold font-display mb-1 text-danger">Danger Zone</h3>
          <p className="text-sm text-text-muted mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              setShowDeleteDialog(true);
              setDeleteConfirmation('');
              setDeleteError('');
            }}
          >
            Delete my account
          </Button>
        </motion.div>
      </div>

      {/* Delete account confirmation dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !deleteLoading && setShowDeleteDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-card rounded-2xl p-6 border border-danger/20 shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold font-display text-danger mb-2">
                Delete your account?
              </h3>
              <p className="text-sm text-text-muted mb-2">
                This will permanently delete:
              </p>
              <ul className="text-sm text-text-muted mb-4 list-disc list-inside space-y-1">
                <li>Your profile and credentials</li>
                <li>All your repertoires and categories</li>
                <li>All your imported games and analyses</li>
                <li>All your preferences and settings</li>
              </ul>
              <p className="text-sm text-text mb-4 font-medium">
                {isOAuthOnly
                  ? <>Type your username <span className="font-mono text-danger">{user?.username}</span> to confirm:</>
                  : 'Enter your password to confirm:'}
              </p>

              {deleteError && (
                <div className="bg-danger-light text-danger py-2 px-4 rounded-xl text-sm mb-4">
                  {deleteError}
                </div>
              )}

              <input
                type={isOAuthOnly ? 'text' : 'password'}
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={isOAuthOnly ? 'Type your username' : 'Enter your password'}
                autoComplete={isOAuthOnly ? 'off' : 'current-password'}
                data-form-type="other"
                data-lpignore="true"
                className="w-full py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans focus:outline-none focus:border-danger focus:ring-3 focus:ring-danger/20 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmationValid && !deleteLoading) {
                    handleDeleteAccount();
                  }
                }}
              />

              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  loading={deleteLoading}
                  disabled={!deleteConfirmationValid}
                >
                  Delete permanently
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
