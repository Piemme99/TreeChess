import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuthStore();
  const navigate = useNavigate();

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
      } else {
        await login(username, password);
      }
      navigate('/', { replace: true });
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
    </div>
  );
}
