import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      // Always show success to prevent email enumeration
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4 animate-fade-in">
      <div className="bg-bg-card rounded-xl shadow-lg p-8 w-full max-w-[400px]">
        <h1 className="text-center text-3xl font-bold mb-1">
          Tree<span className="text-primary">Chess</span>
        </h1>
        <h2 className="text-center text-lg text-text-muted mb-8 font-medium">Reset Password</h2>

        {submitted ? (
          <div className="text-center">
            <div className="bg-success-light text-success py-3 px-4 rounded-md text-sm mb-6">
              If an account with that email exists, we've sent a password reset link.
            </div>
            <p className="text-sm text-text-muted mb-4">
              Check your email and follow the link to reset your password.
            </p>
            <Link
              to="/login"
              className="text-primary hover:underline text-sm font-medium"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-muted mb-6 text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="bg-danger-light text-danger py-2 px-4 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="py-2 px-4 bg-primary text-white border-none rounded-md text-[0.9375rem] font-medium cursor-pointer transition-colors duration-150 font-sans mt-2 hover:not-disabled:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="text-center mt-6 text-sm text-text-muted">
              Remember your password?{' '}
              <Link
                to="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
