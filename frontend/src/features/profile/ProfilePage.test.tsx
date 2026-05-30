import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { createUser } from '../../test/factories';
import type { User } from '../../types';

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  triggerSync: vi.fn(),
  navigate: vi.fn(),
  hasPassword: vi.fn(),
}));

let currentUser: User = createUser({ username: 'alice' });

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      user: currentUser,
      logout: mocks.logout,
      updateProfile: mocks.updateProfile,
      triggerSync: mocks.triggerSync,
      deleteAccount: mocks.deleteAccount,
    }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  authApi: {
    hasPassword: () => mocks.hasPassword(),
  },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { ProfilePage } from './ProfilePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

describe('ProfilePage – delete account flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    currentUser = createUser({ username: 'alice' });
    mocks.hasPassword.mockResolvedValue({ hasPassword: true });
  });

  it('opens an accessible dialog with a labelled confirmation input', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/delete your account/i);

    // Password account: input is labelled and accessible by its label.
    const input = screen.getByLabelText(/enter your password to confirm/i);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps the confirm button disabled until a valid confirmation is entered', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    await screen.findByRole('dialog');

    const confirm = screen.getByRole('button', { name: /delete permanently/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/enter your password to confirm/i), {
      target: { value: 'supersecret' },
    });

    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith('supersecret'));
  });

  it('closes the dialog on Escape', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('confirms via username for OAuth-only accounts', async () => {
    mocks.hasPassword.mockResolvedValue({ hasPassword: false });
    renderPage();

    // Wait for hasPassword() to resolve and switch the confirmation mode.
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    await screen.findByRole('dialog');

    const input = await screen.findByLabelText(/type your username/i);
    fireEvent.change(input, { target: { value: 'alice' } });

    const confirm = screen.getByRole('button', { name: /delete permanently/i });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mocks.deleteAccount).toHaveBeenCalledWith(undefined, 'alice'),
    );
  });
});
