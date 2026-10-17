import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Priority } from '../domain/priorities';
import { PriorityList } from './PriorityList';

const scandinavian: Priority = { kind: 'weak-line', side: 'w', path: ['e4', 'd5', 'exd5'], games: 207, pointsToGain: 12.34 };
const versusD4: Priority = { kind: 'unsettled', side: 'b', path: ['d4'], games: 662, pointsToGain: 11.8 };

describe('PriorityList', () => {
  it('lists each priority with its side, line, signal, games and points to gain', () => {
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={() => {}} />);

    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveTextContent('1White1.e4 d5 2.exd5Weak line20712.3');
    expect(second).toHaveTextContent('2Black1.d4No settled reply66211.8');
  });

  it('explains what points to gain are', () => {
    render(<PriorityList priorities={[scandinavian]} isSelected={() => false} onSelect={() => {}} />);

    expect(screen.getByRole('img', { name: /Game points you would have scored on top/ })).toBeInTheDocument();
  });

  it('hands the clicked priority over', () => {
    const onSelect = vi.fn();
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4/ }));

    expect(onSelect).toHaveBeenCalledWith(versusD4);
  });

  it('marks the priority currently shown', () => {
    render(<PriorityList priorities={[scandinavian]} isSelected={(p) => p === scandinavian} onSelect={() => {}} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
