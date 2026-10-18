import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Priority } from '../domain/priorities';
import { PriorityTickets } from './PriorityTickets';

const scandinavian: Priority = {
  side: 'w', path: ['e4', 'd5', 'exd5'], games: 207, pointsToGain: 12.34,
};
const versusD4: Priority = {
  side: 'b', path: ['d4', 'Nf6'], games: 124, pointsToGain: 11.8,
};

const renderTickets = (props: Partial<Parameters<typeof PriorityTickets>[0]> = {}) =>
  render(
    <PriorityTickets priorities={[scandinavian, versusD4]} isSelected={() => false} onSelect={() => {}} onPoint={() => {}} {...props} />,
  );

// La table des noms d'ouvertures (~480 Ko) est chargée à la demande : sous la charge de
// la suite complète, le délai par défaut d'1 s ne suffit pas.
const findOpeningName = (name: string) => screen.findByText(name, undefined, { timeout: 5000 });

describe('PriorityTickets', () => {
  it('gives each priority a ticket with its rank, side and last move', () => {
    renderTickets();

    const [first, second] = screen.getAllByRole('button');
    for (const text of ['1', 'White', '2.exd5']) expect(first).toHaveTextContent(text);
    for (const text of ['2', 'Black', '1…Nf6']) expect(second).toHaveTextContent(text);
  });

  it('shows each impact relative to the heaviest priority', () => {
    renderTickets();

    const impacts = screen.getAllByRole('meter', { name: 'Impact' }).map((meter) => meter.getAttribute('aria-valuenow'));
    expect(impacts).toEqual(['100', '96']);
  });

  it('names the opening of each line', async () => {
    renderTickets();

    expect(await findOpeningName('Scandinavian Defense')).toBeInTheDocument();
    expect(screen.getByText('Indian Defense')).toBeInTheDocument();
  });

  it('hands the clicked priority over', () => {
    const onSelect = vi.fn();
    renderTickets({ onSelect });

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(onSelect).toHaveBeenCalledWith(versusD4);
  });

  it('reports the priority under the pointer, and when the pointer leaves', () => {
    const onPoint = vi.fn();
    renderTickets({ onPoint });

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.d4 Nf6/ }));
    fireEvent.mouseLeave(screen.getByRole('list'));

    expect(onPoint.mock.calls).toEqual([[versusD4], [null]]);
  });

  it('marks the priority currently shown', () => {
    renderTickets({ isSelected: (priority) => priority === versusD4 });

    expect(screen.getByRole('button', { name: /1\.d4 Nf6/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when there is nothing to fix', () => {
    renderTickets({ priorities: [] });

    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
