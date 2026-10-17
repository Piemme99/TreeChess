import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import { FlameGraph } from './FlameGraph';

const games: PlayedGame[] = [
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'e5', 'Nf3'], score: 1, playedAt: '2026-01-01' })),
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'c5'], score: 0, playedAt: '2026-01-01' })),
  ...Array.from({ length: 40 }, (): PlayedGame => ({ side: 'w', moves: ['d4', 'd5'], score: 0.5, playedAt: '2026-01-01' })),
];

const tree = buildOpeningTree(games, 'w', 16);

function ZoomableFlameGraph({ onPoint = () => {} }: { onPoint?: (path: readonly string[] | null) => void }) {
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  return <FlameGraph tree={tree} focusPath={focusPath} onFocusChange={setFocusPath} onPoint={onPoint} />;
}

const renderGraph = (onPoint?: (path: readonly string[] | null) => void) =>
  render(<ZoomableFlameGraph onPoint={onPoint} />);
const breadcrumb = () => screen.getByRole('navigation', { name: 'Zoom path' });

describe('FlameGraph', () => {
  it('draws one bar per line, labelled with its move', () => {
    renderGraph();

    expect(screen.getByRole('button', { name: '1.e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1…c5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2.Nf3' })).toBeInTheDocument();
  });

  it('reports the line under the pointer, and when the pointer leaves', () => {
    const onPoint = vi.fn();
    renderGraph(onPoint);
    const bar = screen.getByRole('button', { name: '1…c5' });

    fireEvent.mouseEnter(bar);
    fireEvent.mouseLeave(bar.parentElement!);

    expect(onPoint.mock.calls).toEqual([[['e4', 'c5']], [null]]);
  });

  it('shows the player average once, in the legend', () => {
    renderGraph();

    expect(screen.getByText('Average (50%) or < 20 games')).toBeInTheDocument();
  });

  it('zooms into a line when its bar is clicked', () => {
    renderGraph();

    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));

    expect(screen.queryByRole('button', { name: '1.d4' })).not.toBeInTheDocument();
    expect(breadcrumb()).toHaveTextContent('All games›1.e4');
  });

  it('zooms back out from the breadcrumb', () => {
    renderGraph();
    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));
    fireEvent.click(screen.getByRole('button', { name: '1…e5' }));

    fireEvent.click(within(breadcrumb()).getByRole('button', { name: 'All games' }));

    expect(screen.getByRole('button', { name: '1.d4' })).toBeInTheDocument();
  });
});
