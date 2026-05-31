import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { LoginPage } from './LoginPage';

const handleOAuthToken = vi.fn();

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    register: vi.fn(),
    handleOAuthToken,
    needsOnboarding: false,
    clearOnboarding: vi.fn(),
  }),
}));

vi.mock('./OnboardingModal', () => ({
  OnboardingModal: () => null,
}));

describe('LoginPage OAuth token handling', () => {
  beforeEach(() => {
    handleOAuthToken.mockReset();
    handleOAuthToken.mockResolvedValue(undefined);
    window.history.replaceState(null, '', '/login?token=secret-token&new=1');
  });

  it('scrubs the token from window.location synchronously before exchanging it', async () => {
    render(
      <MemoryRouter initialEntries={['/login?token=secret-token&new=1']}>
        <LoginPage />
      </MemoryRouter>
    );

    // The live browser URL must no longer carry the token.
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('secret-token');

    // The token is still handed to the exchange.
    await waitFor(() => {
      expect(handleOAuthToken).toHaveBeenCalledWith('secret-token', true);
    });
  });
});
