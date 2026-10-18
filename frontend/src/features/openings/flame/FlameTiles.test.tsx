import { MotionGlobalConfig } from 'framer-motion';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import { FlameTiles } from './FlameTiles';

const games: PlayedGame[] = [
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'e5', 'Nf3'], score: 1, playedAt: '2026-01-01' })),
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'c5'], score: 0, playedAt: '2026-01-01' })),
  ...Array.from({ length: 40 }, (): PlayedGame => ({ side: 'w', moves: ['d4', 'd5'], score: 0.5, playedAt: '2026-01-01' })),
];

const tree = buildOpeningTree(games, 'w', 16);

function ZoomableTiles({ onPoint = () => {} }: { onPoint?: (path: readonly string[] | null) => void }) {
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  return <FlameTiles tree={tree} focusPath={focusPath} onFocusChange={setFocusPath} onPoint={onPoint} />;
}

const breadcrumb = () => screen.getByRole('navigation', { name: 'Zoom path' });

describe('FlameTiles', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  it('draws one tile per line, named after its move', () => {
    render(<ZoomableTiles />);

    expect(screen.getByRole('button', { name: '1.e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1…c5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2.Nf3' })).toBeInTheDocument();
  });

  it('reports the line under the pointer, and when the pointer leaves', () => {
    const onPoint = vi.fn();
    render(<ZoomableTiles onPoint={onPoint} />);
    const tile = screen.getByRole('button', { name: '1…c5' });

    fireEvent.mouseEnter(tile);
    fireEvent.mouseLeave(tile.parentElement!.parentElement!);

    expect(onPoint.mock.calls).toEqual([[['e4', 'c5']], [null]]);
  });

  it('names the tones in the legend', () => {
    render(<ZoomableTiles />);

    const tones = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem').map((item) => item.textContent);
    expect(tones).toEqual(['leaking', 'shaky', 'par', 'solid']);
  });

  it('zooms into a line when its tile is clicked', async () => {
    render(<ZoomableTiles />);

    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: '1.d4' })).not.toBeInTheDocument());
    expect(breadcrumb()).toHaveTextContent('all1.e4');
  });

  it('zooms back out from the breadcrumb', async () => {
    render(<ZoomableTiles />);
    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));
    fireEvent.click(screen.getByRole('button', { name: '1…e5' }));

    fireEvent.click(within(breadcrumb()).getByRole('button', { name: 'all' }));

    expect(await screen.findByRole('button', { name: '1.d4' })).toBeInTheDocument();
  });
});
