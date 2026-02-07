import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { authApi } from '../../services/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || 'Failed to reset password');
      } else {
        setError('Failed to reset password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  const cardClass = "bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px]";
  const submitClass = "py-2.5 px-4 bg-gradient-to-r from-primary to-primary-hover text-white border-none rounded-xl text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 font-sans shadow-md shadow-primary/20 hover:not-disabled:shadow-lg hover:not-disabled:shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`${cardClass} text-center`}
        >
          <div className="flex justify-center mb-2">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
              <Crown size={22} className="text-white" />
            </div>
          </div>
          <h1 className="text-center text-2xl font-bold mb-1 font-display tracking-tight">
            TreeChess
          </h1>
          <h2 className="text-center text-base text-text-muted mb-8 font-medium">
            Invalid Link
          </h2>
          <p className="text-sm text-text-muted mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="text-primary hover:underline text-sm font-medium"
          >
            Request a new reset link
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={cardClass}
      >
        <div className="flex justify-center mb-2">
          <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
            <Crown size={22} className="text-white" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold mb-1 font-display tracking-tight">
          TreeChess
        </h1>
        <h2 className="text-center text-base text-text-muted mb-8 font-medium">
          Set New Password
        </h2>

        {success ? (
          <div className="text-center">
            <div className="bg-success-light text-success py-3 px-4 rounded-xl text-sm mb-6">
              Your password has been reset successfully.
            </div>
            <button
              onClick={() => navigate('/login')}
              className={submitClass}
            >
              Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-danger-light text-danger py-2 px-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-1"
            >
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
                required
                minLength={8}
                className={inputClass}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col gap-1"
            >
              <label htmlFor="confirmPassword" className="text-sm font-medium text-text">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                minLength={8}
                className={inputClass}
              />
            </motion.div>

            <button
              type="submit"
              disabled={submitting}
              className={`${submitClass} mt-2`}
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
