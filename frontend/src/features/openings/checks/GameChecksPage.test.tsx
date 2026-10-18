import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { GameChecksPage } from './GameChecksPage';

const page = () =>
  render(
    <MemoryRouter>
      <GameChecksPage />
    </MemoryRouter>,
  );
const replayBar = () => screen.getByRole('region', { name: 'Replay' });
const nextDay = () => fireEvent.click(within(replayBar()).getByRole('button', { name: /Next day/ }));
const dayGames = () => within(screen.getByRole('region', { name: 'Games of the day' })).queryAllByRole('listitem');
const earlier = () => screen.getByRole('region', { name: /Still to decide/ });

describe('GameChecksPage', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts on the day the repertoire is created, with no game yet', () => {
    page();

    expect(replayBar()).toHaveTextContent('Wed, 31 Dec 2025repertoire created');
    expect(dayGames()).toHaveLength(0);
  });

  it('checks each game of the day against the repertoire', () => {
    page();
    nextDay();

    expect(replayBar()).toHaveTextContent('Sun, 4 Jan 2026day 1 of 49 · 11 games');
    expect(dayGames()).toHaveLength(11);
    expect(screen.getByText(/You played/)).toHaveTextContent('You played 1…♘f6, your repertoire has 1…d5');
  });

  it('carries the undecided games over to the next day, without the ignored ones', () => {
    page();
    nextDay();
    const [first] = dayGames();
    fireEvent.click(within(first).getByRole('button', { name: /^Ignore/ }));
    expect(first).toHaveTextContent('Ignored');

    nextDay();

    expect(within(earlier()).getAllByRole('listitem')).toHaveLength(10);
  });

  it('forgets the ignored games when the replay is reset', () => {
    page();
    nextDay();
    fireEvent.click(within(dayGames()[0]).getByRole('button', { name: /^Ignore/ }));

    fireEvent.click(within(replayBar()).getByRole('button', { name: 'Reset' }));
    nextDay();

    expect(within(dayGames()[0]).getByRole('button', { name: /^Ignore/ })).toBeInTheDocument();
  });
});
