import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { LoginPage } from './LoginPage';

const completeOAuthLogin = vi.fn();

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    register: vi.fn(),
    completeOAuthLogin,
  }),
}));

describe('LoginPage OAuth login completion', () => {
  beforeEach(() => {
    completeOAuthLogin.mockReset();
    completeOAuthLogin.mockResolvedValue(undefined);
  });

  it('completes login via the refresh cookie for new users — no token in the URL', async () => {
    // The backend redirects first-time OAuth users to `/login?new=1` and NO
    // longer puts the access JWT in the URL (issue #124). LoginPage acts on
    // `?new=1` by exchanging the httpOnly refresh cookie via completeOAuthLogin.
    render(
      <MemoryRouter initialEntries={['/login?new=1']}>
        <LoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(completeOAuthLogin).toHaveBeenCalledWith(true);
    });
  });

  it('does not complete OAuth login when there are no OAuth params', async () => {
    // Returning users are authenticated by the app-level checkAuth on mount, so
    // a plain /login visit must not trigger an OAuth completion.
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(completeOAuthLogin).not.toHaveBeenCalled();
    });
  });
});
