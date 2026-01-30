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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-logo">TreeChess</h1>
        <h2 className="login-title">{isRegister ? 'Create Account' : 'Sign In'}</h2>

        {!isRegister && (
          <>
            <a href={`${API_BASE}/auth/lichess/login`} className="login-oauth-btn lichess-btn">
              Sign in with Lichess
            </a>
            <div className="login-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="username">Username</label>
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
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={8}
            />
          </div>

          {isRegister && (
            <div className="login-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          )}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="login-toggle-btn" onClick={toggleMode}>
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
