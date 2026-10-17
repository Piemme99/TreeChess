import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Priority } from '../domain/priorities';
import { PriorityList } from './PriorityList';

const scandinavian: Priority = { kind: 'weak-line', side: 'w', path: ['e4', 'd5', 'exd5'], games: 207, pointsToGain: 12.34 };
const versusD4: Priority = { kind: 'unsettled', side: 'b', path: ['d4'], games: 662, pointsToGain: 11.8 };

describe('PriorityList', () => {
  it('lists each priority with its side, line, signal and games', () => {
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={() => {}} onPoint={() => {}} />);

    const [first, second] = screen.getAllByRole('button');
    for (const text of ['White', '1.e4 d5 2.exd5', 'Weak line', '207']) expect(first).toHaveTextContent(text);
    for (const text of ['Black', '1.d4', 'No settled reply', '662']) expect(second).toHaveTextContent(text);
  });

  it('shows each impact relative to the heaviest priority', () => {
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={() => {}} onPoint={() => {}} />);

    const impacts = screen.getAllByRole('meter', { name: 'Impact' }).map((meter) => meter.getAttribute('aria-valuenow'));
    expect(impacts).toEqual(['100', '96']);
  });

  it('names the opening of each line when it has one', async () => {
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={() => {}} onPoint={() => {}} />);

    expect(await screen.findByText('Scandinavian Defense')).toBeInTheDocument();
    expect(screen.getByText("Queen's Pawn Game")).toBeInTheDocument();
  });

  it('hands the clicked priority over', () => {
    const onSelect = vi.fn();
    render(<PriorityList priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={onSelect} onPoint={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4/ }));

    expect(onSelect).toHaveBeenCalledWith(versusD4);
  });

  it('reports the priority under the pointer', () => {
    const onPoint = vi.fn();
    render(<PriorityList priorities={[scandinavian]} isSelected={() => false} onSelect={() => {}} onPoint={onPoint} />);

    fireEvent.mouseEnter(screen.getByRole('button'));

    expect(onPoint).toHaveBeenCalledWith(scandinavian);
  });

  it('marks the priority currently shown', () => {
    render(<PriorityList priorities={[scandinavian]} isSelected={(p) => p === scandinavian} onSelect={() => {}} onPoint={() => {}} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
