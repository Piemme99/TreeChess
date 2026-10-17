import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FlameGraphPage } from './FlameGraphPage';

const choose = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

const renderWholeHistory = () => {
  render(<FlameGraphPage />);
  choose('Period', 'All');
};

describe('FlameGraphPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('covers the last year by default', () => {
    render(<FlameGraphPage />);

    expect(screen.getByRole('radio', { name: '1 year' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: /1\.d4 Nf6/ })).not.toBeInTheDocument();
  });

  it('says so when no line stands out over the period', () => {
    render(<FlameGraphPage />);

    choose('Period', '3 months');

    expect(screen.getByText('None over this period')).toBeInTheDocument();
  });

  it('shows a priority in the flame graph when it is clicked', () => {
    renderWholeHistory();

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent('All games›1.d4›1…Nf6');
  });

  it('shows the position under the pointer, then falls back to the zoomed one', async () => {
    renderWholeHistory();
    const panel = screen.getByRole('complementary', { name: 'Position' });
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.e4 d5 2\.exd5/ }));
    expect(await within(panel).findByText('Scandinavian Defense')).toBeInTheDocument();
    expect(panel).toHaveTextContent('Games207');

    fireEvent.mouseLeave(screen.getByRole('list'));
    expect(await within(panel).findByText('Indian Defense')).toBeInTheDocument();
    expect(panel).toHaveTextContent('Games124');
  });

  it('resets the zoom when switching side', () => {
    renderWholeHistory();
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    choose('Side', 'White');

    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent(/^All games$/);
  });

  it('resets the zoom when switching period', () => {
    renderWholeHistory();
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    choose('Period', '1 year');

    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent(/^All games$/);
  });
});
