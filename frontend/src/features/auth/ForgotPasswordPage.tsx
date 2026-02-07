import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
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
    <div className="flex items-center justify-center min-h-screen bg-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px]"
      >
        <div className="flex justify-center mb-2">
          <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
            <Crown size={22} className="text-white" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold mb-1 font-display tracking-tight">
          TreeChess
        </h1>
        <h2 className="text-center text-base text-text-muted mb-8 font-medium">Reset Password</h2>

        {submitted ? (
          <div className="text-center">
            <div className="bg-success-light text-success py-3 px-4 rounded-xl text-sm mb-6">
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
                  className="py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </motion.div>

              <button
                type="submit"
                disabled={submitting}
                className="py-2.5 px-4 bg-gradient-to-r from-primary to-primary-hover text-white border-none rounded-xl text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 font-sans mt-2 shadow-md shadow-primary/20 hover:not-disabled:shadow-lg hover:not-disabled:shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
      </motion.div>
    </div>
  );
}
