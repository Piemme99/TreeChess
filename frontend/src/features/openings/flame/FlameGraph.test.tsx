import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import { FlameGraph } from './FlameGraph';

const games: PlayedGame[] = [
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'e5', 'Nf3'], score: 1 })),
  ...Array.from({ length: 30 }, (): PlayedGame => ({ side: 'w', moves: ['e4', 'c5'], score: 0 })),
  ...Array.from({ length: 40 }, (): PlayedGame => ({ side: 'w', moves: ['d4', 'd5'], score: 0.5 })),
];

const renderGraph = () => render(<FlameGraph tree={buildOpeningTree(games, 'w', 16)} />);
const breadcrumb = () => screen.getByRole('navigation', { name: 'Position affichée' });

describe('FlameGraph', () => {
  it('draws one bar per line, labelled with its move', () => {
    renderGraph();

    expect(screen.getByRole('button', { name: '1.e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1…c5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2.Nf3' })).toBeInTheDocument();
  });

  it('describes the hovered line against the player average', () => {
    renderGraph();

    fireEvent.mouseEnter(screen.getByRole('button', { name: '1…c5' }));

    expect(screen.getByText('1.e4 c5')).toBeInTheDocument();
    expect(screen.getByText('30 parties · tu y marques 0 % · ta moyenne 50 %')).toBeInTheDocument();
    expect(screen.getByText('Tu y marques nettement moins que d’habitude.')).toBeInTheDocument();
  });

  it('zooms into a line when its bar is clicked', () => {
    renderGraph();

    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));

    expect(screen.queryByRole('button', { name: '1.d4' })).not.toBeInTheDocument();
    expect(breadcrumb()).toHaveTextContent('Toutes les parties›1.e4');
  });

  it('zooms back out from the breadcrumb', () => {
    renderGraph();
    fireEvent.click(screen.getByRole('button', { name: '1.e4' }));
    fireEvent.click(screen.getByRole('button', { name: '1…e5' }));

    fireEvent.click(within(breadcrumb()).getByRole('button', { name: 'Toutes les parties' }));

    expect(screen.getByRole('button', { name: '1.d4' })).toBeInTheDocument();
  });
});
