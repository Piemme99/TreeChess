import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OpeningsPage as Page } from './OpeningsPage';

const OpeningsPage = () => (
  <MemoryRouter>
    <Page />
  </MemoryRouter>
);

const tickets = () => within(screen.getByRole('region', { name: /Fix these first/ })).getAllByRole('button');
const panel = () => screen.getByRole('complementary', { name: 'Position' });
const period = (name: string) => within(panel()).getByRole('region', { name });
const zoomPath = () => screen.getByRole('navigation', { name: 'Zoom path' });

// La table des noms d'ouvertures (~480 Ko) est chargée à la demande : sous la charge de
// la suite complète, le délai par défaut d'1 s ne suffit pas.
const findOpeningName = (name: string) => within(panel()).findByText(name, undefined, { timeout: 5000 });

describe('OpeningsPage', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('ranks the lines that cost points on the replay day', () => {
    render(<OpeningsPage />);

    const lines = tickets().map((ticket) => ticket.textContent);
    expect(lines[0]).toMatch(/White.*1\.d4$/);
    expect(lines.join()).toMatch(/1\.e4 c5 2\.d4/);
    expect(lines.join()).not.toMatch(/1\.e4 e5 2\.Nf3 d6 3\.d4/);
  });

  it('reads the games known on the replay day, which the Games page moves on', async () => {
    localStorage.setItem('kumquat.v2.replay-day', '2026-01-04');
    render(<OpeningsPage />);

    expect(screen.getByRole('banner')).toHaveTextContent('as of Sun, 4 Jan 2026');
    await waitFor(() => expect(period('All time')).toHaveTextContent('2562games'));
  });

  it('shows the repertoire created from the games before the replay starts', () => {
    render(<OpeningsPage />);

    expect(panel()).toHaveTextContent('Repertoire 1.e4 · 1.d4');

    fireEvent.click(screen.getByRole('switch', { name: 'Play as Black' }));
    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));

    expect(panel()).toHaveTextContent('Repertoire 1…c6 · 1…c5');
  });

  it('previews a clicked priority without leaving the page', async () => {
    render(<OpeningsPage />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('button', { name: /1\.d4 Nf6/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('switch', { name: 'Play as Black' })).toBeChecked();
    expect(zoomPath()).toHaveTextContent('all1.d41…♘f6');
    expect(await findOpeningName('Indian Defense')).toBeInTheDocument();
    expect(period('All time')).toHaveTextContent('103games');
    expect(period('Last 12 months')).toHaveTextContent('33games');
    expect(screen.queryByRole('region', { name: 'Line' })).not.toBeInTheDocument();
  });

  it('drops the preview back to the whole tree when the selected priority is clicked again', async () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('button', { name: /1\.d4 Nf6/ })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(zoomPath()).toHaveTextContent(/^all$/));
    expect(screen.queryByRole('button', { name: /Study this line/ })).not.toBeInTheDocument();
  });

  it('studies the previewed line over the last 12 months, then comes back zoomed on it', () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('button', { name: /Study this line/ }));
    expect(screen.getByRole('region', { name: 'Line' })).toHaveTextContent('33games · as Black');

    fireEvent.click(screen.getByRole('button', { name: /Openings/ }));
    expect(zoomPath()).toHaveTextContent('all1.d41…♘f6');
  });

  it('offers no line to study before one is picked', () => {
    render(<OpeningsPage />);

    expect(screen.queryByRole('button', { name: /Study this line/ })).not.toBeInTheDocument();
  });

  it('shows the position under the pointer, then falls back to the previewed one', async () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.e4 c5 2\.d4/ }));
    expect(await findOpeningName('Sicilian Defense: Smith-Morra Gambit')).toBeInTheDocument();

    fireEvent.mouseLeave(within(screen.getByRole('region', { name: /Fix these first/ })).getByRole('list'));
    expect(await findOpeningName('Indian Defense')).toBeInTheDocument();
  });

  it('resets the zoom when switching side', async () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('switch', { name: 'Play as Black' }));

    expect(screen.getByRole('switch', { name: 'Play as Black' })).not.toBeChecked();
    await waitFor(() => expect(zoomPath()).toHaveTextContent(/^all$/));
  });
});
