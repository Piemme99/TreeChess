import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OpeningsPage } from '../OpeningsPage';
import { GameChecksPage } from './GameChecksPage';

// Sans explorateur, la proposition se réduit au coup qui l'ouvre : le test ne dépend ni de Lichess ni du moteur.
vi.mock('../line/explorer', () => ({ explore: () => Promise.resolve(null), hasExplorer: () => false }));

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
const toDecide = () => dayGames().filter((card) => within(card).queryByRole('button', { name: /^Ignore/ }));

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
    expect(screen.getAllByText(/You played/).map((verdict) => verdict.textContent)).toEqual([
      'You played 3.c4, your repertoire has 3.♘f3',
      'You played 1…♘f6, your repertoire has 1…d5',
    ]);
    expect(screen.getAllByText(/first time, nothing to decide/)).toHaveLength(6);
    expect(screen.getAllByText('Followed')).toHaveLength(3);
  });

  it('carries the undecided games over to the next day, without the ignored ones', () => {
    page();
    nextDay();
    expect(toDecide()).toHaveLength(2);
    const [first] = toDecide();
    fireEvent.click(within(first).getByRole('button', { name: /^Ignore/ }));
    expect(first).toHaveTextContent('Ignored');

    nextDay();

    expect(within(earlier()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('forgets the ignored games when the replay is reset', () => {
    page();
    nextDay();
    fireEvent.click(within(toDecide()[0]).getByRole('button', { name: /^Ignore/ }));
    expect(toDecide()).toHaveLength(1);

    fireEvent.click(within(replayBar()).getByRole('button', { name: 'Reset' }));
    nextDay();

    expect(toDecide()).toHaveLength(2);
  });

  it('adds the move the player left the repertoire with, and checks the game again against it', async () => {
    page();
    nextDay();
    const indian = () => dayGames().find((card) => card.textContent?.includes('1.d4') || card.textContent?.includes('1…♘f6'))!;
    fireEvent.click(within(indian()).getByRole('button', { name: /^Add/ }));

    const panel = screen.getByRole('region', { name: 'Addition' });
    expect(panel).toHaveTextContent('Add 1…♘f6 to your repertoire');
    fireEvent.click(await within(panel).findByRole('button', { name: 'Add 1…♘f6 alone' }));

    expect(screen.queryByRole('region', { name: 'Addition' })).not.toBeInTheDocument();
    expect(toDecide()).toHaveLength(1);
    expect(screen.getAllByText(/Your repertoire held for 1 move$/)).toHaveLength(1);
  });

  it('shows the added move on the Openings page too', async () => {
    page();
    nextDay();
    const indian = dayGames().find((card) => card.textContent?.includes('1…♘f6'))!;
    fireEvent.click(within(indian).getByRole('button', { name: /^Add/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1…♘f6 alone' }));
    cleanup();

    render(
      <MemoryRouter>
        <OpeningsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Play as Black' }));
    fireEvent.click(screen.getByRole('button', { name: '1.d4' }));

    expect(screen.getByRole('complementary', { name: 'Position' })).toHaveTextContent('Repertoire 1…d5 · 1…♘f6');
  });
});
