import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
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

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg p-4 animate-fade-in">
        <div className="bg-bg-card rounded-xl shadow-lg p-8 w-full max-w-[400px] text-center">
          <h1 className="text-center text-3xl font-bold mb-1">
            Tree<span className="text-primary">Chess</span>
          </h1>
          <h2 className="text-center text-lg text-text-muted mb-8 font-medium">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4 animate-fade-in">
      <div className="bg-bg-card rounded-xl shadow-lg p-8 w-full max-w-[400px]">
        <h1 className="text-center text-3xl font-bold mb-1">
          Tree<span className="text-primary">Chess</span>
        </h1>
        <h2 className="text-center text-lg text-text-muted mb-8 font-medium">
          Set New Password
        </h2>

        {success ? (
          <div className="text-center">
            <div className="bg-success-light text-success py-3 px-4 rounded-md text-sm mb-6">
              Your password has been reset successfully.
            </div>
            <button
              onClick={() => navigate('/login')}
              className="py-2 px-4 bg-primary text-white border-none rounded-md text-[0.9375rem] font-medium cursor-pointer transition-colors duration-150 font-sans hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-danger-light text-danger py-2 px-4 rounded-md text-sm">
                {error}
              </div>
            )}

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
                required
                minLength={8}
                className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
              />
            </div>

            <div className="flex flex-col gap-1">
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
                className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 bg-primary text-white border-none rounded-md text-[0.9375rem] font-medium cursor-pointer transition-colors duration-150 font-sans mt-2 hover:not-disabled:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
