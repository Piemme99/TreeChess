import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FlameGraphPage } from './FlameGraphPage';

const choose = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

// La table des noms d'ouvertures (~480 Ko) est chargée à la demande : sous la charge de
// la suite complète, le délai par défaut d'1 s ne suffit pas.
const openPriorityThenBack = (line: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: line }));
  fireEvent.click(screen.getByRole('button', { name: 'Openings' }));
};

const findOpeningName = (container: HTMLElement, name: string) =>
  within(container).findByText(name, undefined, { timeout: 5000 });

describe('FlameGraphPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ranks the lines that cost points now, leaving out those fixed or abandoned', () => {
    render(<FlameGraphPage />);

    const lines = within(screen.getByRole('list')).getAllByRole('button').map((row) => row.textContent);
    expect(lines[0]).toMatch(/1\.e4 c5 2\.d4 cxd4 3\.c3/);
    expect(screen.queryByRole('button', { name: /1\.e4 d5 2\.exd5/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1\.d4 d5 2\.Nc3 Nc6 3\.Bf4/ })).not.toBeInTheDocument();
  });

  it('opens a clicked priority in the line view, over the last 12 months', () => {
    render(<FlameGraphPage />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    const line = screen.getByRole('region', { name: 'Line' });
    expect(line).toHaveTextContent('Black · 28 games');
    expect(screen.queryByRole('heading', { name: /Priorities/ })).not.toBeInTheDocument();
  });

  it('comes back from the line view zoomed on the studied line', () => {
    render(<FlameGraphPage />);

    openPriorityThenBack(/1\.d4 Nf6/);

    expect(screen.getByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent('All games›1.d4›1…Nf6');
  });

  it('shows the position under the pointer, then falls back to the zoomed one', async () => {
    render(<FlameGraphPage />);
    openPriorityThenBack(/1\.d4 Nf6/);
    const panel = screen.getByRole('complementary', { name: 'Position' });

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.e4 e5 2\.Nf3 d6 3\.d4/ }));
    expect(await findOpeningName(panel, 'Philidor Defense')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole('list'));
    expect(await findOpeningName(panel, 'Indian Defense')).toBeInTheDocument();
    expect(within(panel).getByRole('row', { name: /All time/ })).toHaveTextContent('124');
    expect(within(panel).getByRole('row', { name: /Last 12 months/ })).toHaveTextContent('28');
  });

  it('counts the games of a priority over the same period in the list and in the panel', () => {
    render(<FlameGraphPage />);

    const indian = screen.getByRole('button', { name: /1\.d4 Nf6/ });
    fireEvent.mouseEnter(indian);

    const panel = screen.getByRole('complementary', { name: 'Position' });
    expect(indian).toHaveTextContent('28');
    expect(within(panel).getByRole('row', { name: /Last 12 months/ })).toHaveTextContent('28');
  });

  it('resets the zoom when switching side', () => {
    render(<FlameGraphPage />);
    openPriorityThenBack(/1\.d4 Nf6/);

    choose('Side', 'White');

    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent(/^All games$/);
  });
});
