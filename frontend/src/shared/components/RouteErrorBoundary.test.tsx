import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Boom({ error }: { error: Error }): never {
  throw error;
}

describe('RouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <RouteErrorBoundary>
        <div>healthy page</div>
      </RouteErrorBoundary>
    );
    expect(screen.getByText('healthy page')).toBeInTheDocument();
  });

  it('renders a degraded fallback (not a full-page blank) when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary>
        <Boom error={new Error('render failed')} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText(/this page ran into a problem/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('logs the error with component stack via componentDidCatch', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary>
        <Boom error={new Error('render failed')} />
      </RouteErrorBoundary>
    );
    expect(spy).toHaveBeenCalled();
    const loggedWithStack = spy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('Boom'))
    );
    expect(loggedWithStack).toBe(true);
  });

  it('offers a reload CTA when a lazy chunk fails to load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/x.js');

    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    try {
      render(
        <RouteErrorBoundary>
          <Boom error={chunkError} />
        </RouteErrorBoundary>
      );

      expect(screen.getByText(/new version is available/i)).toBeInTheDocument();
      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      fireEvent.click(reloadButton);
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
