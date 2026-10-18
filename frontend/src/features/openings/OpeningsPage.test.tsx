import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OpeningsPage } from './OpeningsPage';

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
  });

  it('ranks the lines that cost points now, leaving out those fixed or abandoned', () => {
    render(<OpeningsPage />);

    const lines = tickets().map((ticket) => ticket.textContent);
    expect(lines[0]).toMatch(/1\.e4 c5 2\.d4 cxd4 3\.c3/);
    expect(lines.join()).not.toMatch(/1\.e4 d5 2\.exd5|1\.d4 d5 2\.Nc3 Nc6 3\.Bf4/);
  });

  it('previews a clicked priority without leaving the page', async () => {
    render(<OpeningsPage />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('button', { name: /1\.d4 Nf6/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('switch', { name: 'Play as Black' })).toBeChecked();
    expect(zoomPath()).toHaveTextContent('all1.d41…Nf6');
    expect(await findOpeningName('Indian Defense')).toBeInTheDocument();
    expect(period('All time')).toHaveTextContent('124games');
    expect(period('Last 12 months')).toHaveTextContent('28games');
    expect(screen.queryByRole('region', { name: 'Line' })).not.toBeInTheDocument();
  });

  it('studies the previewed line over the last 12 months, then comes back zoomed on it', () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('button', { name: /Study this line/ }));
    expect(screen.getByRole('region', { name: 'Line' })).toHaveTextContent('Black · 28 games');

    fireEvent.click(screen.getByRole('button', { name: /Openings/ }));
    expect(zoomPath()).toHaveTextContent('all1.d41…Nf6');
  });

  it('offers no line to study before one is picked', () => {
    render(<OpeningsPage />);

    expect(screen.queryByRole('button', { name: /Study this line/ })).not.toBeInTheDocument();
  });

  it('shows the position under the pointer, then falls back to the previewed one', async () => {
    render(<OpeningsPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.e4 e5 2\.Nf3 d6 3\.d4/ }));
    expect(await findOpeningName('Philidor Defense')).toBeInTheDocument();

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
