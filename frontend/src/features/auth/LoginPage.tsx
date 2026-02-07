import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { OnboardingModal } from './OnboardingModal';
import { fadeUp, staggerContainer } from '../../shared/utils/animations';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register, handleOAuthToken, needsOnboarding, clearOnboarding } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setIsRegister(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('error');
    const isNew = searchParams.get('new') === '1';

    if (token) {
      setSearchParams({}, { replace: true });
      handleOAuthToken(token, isNew)
        .then(() => {
          if (!isNew) {
            navigate('/dashboard', { replace: true });
          }
        })
        .catch((err) => {
          if (err instanceof Error) {
            setError(err.message);
          }
        });
    } else if (oauthError) {
      setSearchParams({}, { replace: true });
      setError(oauthError);
    }
  }, [searchParams, setSearchParams, handleOAuthToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, username, password);
        // Don't navigate yet — onboarding modal will show
      } else {
        await login(email, password);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setConfirmPassword('');
    if (!isRegister) {
      // Switching to register mode - clear username as it will be a separate field
      setUsername('');
    }
  };

  const inputClass = "py-2 px-4 border border-border rounded-xl text-[0.9375rem] font-sans transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

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
          <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">TreeChess</span>
        </h1>
        <h2 className="text-center text-base text-text-muted mb-8 font-medium">{isRegister ? 'Create Account' : 'Sign In'}</h2>

        {!isRegister && (
          <>
            <a href={`${API_BASE}/auth/lichess/login`} className="block w-full py-2.5 px-4 bg-bg border border-primary/15 rounded-xl text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 font-sans text-center no-underline text-text hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
              Sign in with Lichess
            </a>
            <div className="flex items-center my-4 text-text-muted text-[0.8125rem] before:content-[''] before:flex-1 before:border-b before:border-primary/10 after:content-[''] after:flex-1 after:border-b after:border-primary/10">
              <span className="px-2">or</span>
            </div>
          </>
        )}

        <motion.form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {error && <div className="bg-danger-light text-danger py-2 px-4 rounded-xl text-sm">{error}</div>}

          <motion.div
            variants={fadeUp}
            custom={0}
            className="flex flex-col gap-1"
          >
            <label htmlFor="email" className="text-sm font-medium text-text">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </motion.div>

          {isRegister && (
            <motion.div
              variants={fadeUp}
              custom={1}
              className="flex flex-col gap-1"
            >
              <label htmlFor="username" className="text-sm font-medium text-text">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a display name"
                autoComplete="username"
                required
                minLength={3}
                maxLength={50}
                className={inputClass}
              />
            </motion.div>
          )}

          <motion.div
            variants={fadeUp}
            custom={2}
            className="flex flex-col gap-1"
          >
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-medium text-text">Password</label>
              {!isRegister && (
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={8}
              className={inputClass}
            />
          </motion.div>

          {isRegister && (
            <motion.div
              variants={fadeUp}
              custom={3}
              className="flex flex-col gap-1"
            >
              <label htmlFor="confirmPassword" className="text-sm font-medium text-text">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                minLength={8}
                className={inputClass}
              />
            </motion.div>
          )}

          <motion.button
            variants={fadeUp}
            custom={4}
            whileHover={submitting ? undefined : { scale: 1.04, boxShadow: '0 20px 40px -12px rgba(230, 126, 34, 0.3)' }}
            whileTap={submitting ? undefined : { scale: 0.97 }}
            type="submit"
            className="py-2.5 px-4 bg-gradient-to-r from-primary to-primary-hover text-white border-none rounded-xl text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 font-sans mt-2 shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            disabled={submitting}
          >
            {submitting ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
          </motion.button>
        </motion.form>

        <div className="text-center mt-6 text-sm text-text-muted">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="bg-transparent border-none text-primary cursor-pointer text-sm font-medium font-sans hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm" onClick={toggleMode}>
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </motion.div>

      <OnboardingModal
        isOpen={needsOnboarding}
        onClose={() => {
          clearOnboarding();
          navigate('/dashboard', { replace: true });
        }}
      />
    </div>
  );
}
