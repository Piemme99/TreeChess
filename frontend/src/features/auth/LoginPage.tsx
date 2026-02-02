import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { OnboardingModal } from './OnboardingModal';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register, handleOAuthToken, needsOnboarding, clearOnboarding } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('error');
    const isNew = searchParams.get('new') === '1';

    if (token) {
      setSearchParams({}, { replace: true });
      handleOAuthToken(token, isNew)
        .then(() => {
          if (!isNew) {
            navigate('/', { replace: true });
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
        await register(username, password);
        // Don't navigate yet — onboarding modal will show
      } else {
        await login(username, password);
        navigate('/', { replace: true });
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
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4 animate-fade-in">
      <div className="bg-bg-card rounded-xl shadow-lg p-8 w-full max-w-[400px]">
        <h1 className="text-center text-3xl font-bold mb-1">
          Tree<span className="text-primary">Chess</span>
        </h1>
        <h2 className="text-center text-lg text-text-muted mb-8 font-medium">{isRegister ? 'Create Account' : 'Sign In'}</h2>

        {!isRegister && (
          <>
            <a href={`${API_BASE}/auth/lichess/login`} className="block w-full py-2 px-4 bg-bg border border-border rounded-md text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 font-sans text-center no-underline text-text hover:border-border-dark hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
              Sign in with Lichess
            </a>
            <div className="flex items-center my-4 text-text-muted text-[0.8125rem] before:content-[''] before:flex-1 before:border-b before:border-border after:content-[''] after:flex-1 after:border-b after:border-border">
              <span className="px-2">or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="bg-danger-light text-danger py-2 px-4 rounded-md text-sm">{error}</div>}

          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm font-medium text-text">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={50}
              className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-text">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={8}
              className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
            />
          </div>

          {isRegister && (
            <div className="flex flex-col gap-1">
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
                className="py-2 px-4 border border-border rounded-md text-[0.9375rem] font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
              />
            </div>
          )}

          <button type="submit" className="py-2 px-4 bg-primary text-white border-none rounded-md text-[0.9375rem] font-medium cursor-pointer transition-colors duration-150 font-sans mt-2 hover:not-disabled:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2" disabled={submitting}>
            {submitting ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-text-muted">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="bg-transparent border-none text-primary cursor-pointer text-sm font-medium font-sans hover:underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm" onClick={toggleMode}>
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>

      <OnboardingModal
        isOpen={needsOnboarding}
        onClose={() => {
          clearOnboarding();
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}
