import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { buildOpeningTree } from '../domain/openingTree';
import type { PlayedGame } from '../domain/playedGame';
import { LineView } from './LineView';

const games = (count: number, moves: string, score: PlayedGame['score']): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'w', moves: moves.split(' '), score, playedAt: '2026-01-01' }));

const tree = buildOpeningTree(
  [
    ...games(6, 'e4 d5 exd5 Qxd5 Nc3', 0),
    ...games(3, 'e4 d5 exd5 Nf6', 1),
    ...games(1, 'e4 d5 e5', 1),
    ...games(10, 'e4 e5 Nf3', 1),
  ],
  'w',
  16,
);

const profile = () => screen.getByRole('region', { name: 'Score along the line' });
const movesHere = () => screen.getByRole('region', { name: /moves here/ });

describe('LineView', () => {
  it('scores the line move after move, then its most played continuation', () => {
    render(<LineView tree={tree} path={['e4', 'd5']} onBack={() => {}} onOpen={() => {}} />);

    const rows = within(profile()).getAllByRole('button').map((row) => row.textContent);
    expect(rows).toEqual(['Start', '1.e42070%', '1…d51040%', '2.exd5933%', '2…Qxd560%', '3.Nc360%']);
    expect(profile()).toHaveTextContent('Most played continuation');
  });

  it('starts on the studied position, with the player moves from there', () => {
    render(<LineView tree={tree} path={['e4', 'd5']} onBack={() => {}} onOpen={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Your moves here' })).toBeInTheDocument();
    expect(within(profile()).getByRole('button', { name: /1…d5/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(movesHere()).getByRole('button', { name: /2\.exd5/ })).toHaveAttribute('aria-current', 'step');
    expect(movesHere()).toHaveTextContent('+1 played fewer than 3 times');
  });

  it('shows the moves of another position of the line when it is picked', () => {
    render(<LineView tree={tree} path={['e4', 'd5']} onBack={() => {}} onOpen={() => {}} />);

    fireEvent.click(within(profile()).getByRole('button', { name: /2\.exd5/ }));

    expect(screen.getByRole('heading', { name: 'Opponent moves here' })).toBeInTheDocument();
    const moves = within(movesHere()).getAllByRole('button').map((move) => move.textContent);
    expect(moves).toEqual(['2…Qxd5667%0%', '2…Nf6333%100%']);
  });

  it('opens a branch off the line as a line of its own', () => {
    const onOpen = vi.fn();
    render(<LineView tree={tree} path={['e4', 'd5']} onBack={() => {}} onOpen={onOpen} />);
    fireEvent.click(within(profile()).getByRole('button', { name: /2\.exd5/ }));

    fireEvent.click(within(movesHere()).getByRole('button', { name: /2…Nf6/ }));

    expect(onOpen).toHaveBeenCalledWith(['e4', 'd5', 'exd5', 'Nf6']);
  });

  it('follows the line when its own move is picked', () => {
    render(<LineView tree={tree} path={['e4', 'd5']} onBack={() => {}} onOpen={() => {}} />);

    fireEvent.click(within(movesHere()).getByRole('button', { name: /2\.exd5/ }));

    expect(within(profile()).getByRole('button', { name: /2\.exd5/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
