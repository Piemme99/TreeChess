import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

import { useAuthStore } from '../../../stores/authStore';
import type { User } from '../../../types';

// OnboardingModal pulls repertoire templates on open; stub the API so the
// component can mount without hitting the network. authStore imports a few
// helpers from this module at eval time, so provide harmless stubs for them.
vi.mock('../../../services/api', () => ({
  repertoireApi: {
    listTemplates: vi.fn(() => Promise.resolve([])),
    seedFromTemplates: vi.fn(() => Promise.resolve()),
  },
  authApi: {},
  syncApi: { sync: vi.fn(() => Promise.resolve({})) },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

vi.mock('../ReanalysisIndicator', () => ({
  ReanalysisIndicator: () => null,
}));

import { MainLayout } from './MainLayout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<div>Dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const newUser: User = {
  id: 'u-1',
  username: 'newbie',
  email: 'newbie@example.com',
  lichessLinked: false,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('MainLayout – onboarding surface (#183)', () => {
  beforeEach(() => {
    // jsdom does not implement matchMedia, which MainLayout's responsive
    // hooks rely on. Provide a minimal stub.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    useAuthStore.setState({
      user: newUser,
      isAuthenticated: true,
      loading: false,
      needsOnboarding: false,
    });
  });

  afterEach(() => {
    useAuthStore.setState({ needsOnboarding: false });
  });

  it('renders the OnboardingModal when a new user still needs onboarding', () => {
    useAuthStore.setState({ needsOnboarding: true });

    renderLayout();

    expect(screen.getByText('Welcome to Kumquat')).toBeInTheDocument();
  });

  it('does not render the OnboardingModal for returning users', () => {
    useAuthStore.setState({ needsOnboarding: false });

    renderLayout();

    expect(screen.queryByText('Welcome to Kumquat')).not.toBeInTheDocument();
  });

  it('clears onboarding state so the modal stays dismissed', () => {
    useAuthStore.setState({ needsOnboarding: true });

    renderLayout();
    expect(screen.getByText('Welcome to Kumquat')).toBeInTheDocument();

    act(() => {
      useAuthStore.getState().clearOnboarding();
    });

    expect(useAuthStore.getState().needsOnboarding).toBe(false);
    expect(screen.queryByText('Welcome to Kumquat')).not.toBeInTheDocument();
  });
});
