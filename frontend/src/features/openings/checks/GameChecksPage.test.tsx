import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OpeningsPage } from '../OpeningsPage';
import { GameChecksPage } from './GameChecksPage';

// Sans explorateur, la proposition se réduit au coup qui l'ouvre : le test ne dépend ni de Lichess ni du moteur.
vi.mock('../line/explorer', () => ({ explore: () => Promise.resolve(null), hasExplorer: () => false, LEVEL_LABEL: 'level' }));

const page = () =>
  render(
    <MemoryRouter>
      <GameChecksPage />
    </MemoryRouter>,
  );
const replayBar = () => screen.getByRole('region', { name: 'Replay' });
const square = (name: string) => document.querySelector(`[data-square="${name}"]`)!;
const playOnBoard = (from: string, to: string) => {
  fireEvent.click(square(from));
  fireEvent.click(square(to));
};
const nextDay = () => fireEvent.click(within(replayBar()).getByRole('button', { name: /Next day/ }));
const toDecide = () => within(screen.getByRole('region', { name: /^To decide/ })).queryAllByRole('listitem');
const rest = () => {
  const region = screen.queryByRole('region', { name: 'Rest of the day' });
  return region ? within(region).queryAllByRole('listitem') : [];
};
const dayGames = () => [...toDecide(), ...rest()];
const actionable = () => toDecide().filter((card) => within(card).queryByRole('button', { name: /^Ignore/ }));
const deviations = () => actionable().filter((card) => card.textContent?.includes('You played'));

describe('GameChecksPage', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
    vi.restoreAllMocks();
  });

  // react-chessboard mesure ses cases pour animer un coup ; jsdom les donne de largeur nulle.
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 50, 50));
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
    expect(screen.getAllByText('Not covered')).toHaveLength(6);
    expect(screen.getAllByText('Followed')).toHaveLength(3);
  });

  it('puts every game that left the repertoire at the top, with its actions', () => {
    page();
    nextDay();

    expect(actionable()).toHaveLength(8);
    expect(rest().map((card) => card.textContent)).toEqual([
      expect.stringContaining('Followed'),
      expect.stringContaining('Followed'),
      expect.stringContaining('Followed'),
    ]);
  });

  it("carries over to the next day the player's own deviations, not the ignored ones nor a first unknown reply", () => {
    page();
    nextDay();
    expect(deviations()).toHaveLength(2);
    fireEvent.click(within(deviations()[0]).getByRole('button', { name: /^Ignore/ }));
    expect(rest().some((card) => card.textContent?.includes('Ignored'))).toBe(true);

    nextDay();

    expect(toDecide().filter((card) => card.textContent?.includes('Sun, 4 Jan 2026'))).toHaveLength(1);
  });

  it('forgets the ignored games when the replay is reset', () => {
    page();
    nextDay();
    fireEvent.click(within(actionable()[0]).getByRole('button', { name: /^Ignore/ }));
    expect(actionable()).toHaveLength(7);

    fireEvent.click(within(replayBar()).getByRole('button', { name: 'Reset' }));
    nextDay();

    expect(actionable()).toHaveLength(8);
  });

  it('lets the player build the addition by playing the moves on the board', () => {
    page();
    nextDay();
    const indian = () => dayGames().find((card) => card.textContent?.includes('1…♘f6'))!;
    fireEvent.click(within(indian()).getByRole('button', { name: /^Add/ }));

    const panel = screen.getByRole('region', { name: 'Addition' });
    expect(panel).toHaveTextContent('You played 1…♘f6: what do you want to play here?');
    playOnBoard('g8', 'f6');
    expect(within(panel).getByRole('list', { name: 'To add' })).toHaveTextContent('1…♘f6');
    fireEvent.click(within(panel).getByRole('button', { name: 'Add to my repertoire · 1 move' }));

    expect(screen.queryByRole('region', { name: 'Addition' })).not.toBeInTheDocument();
    expect(deviations()).toHaveLength(1);
    expect(screen.getAllByText(/Your repertoire held for 1 move$/)).toHaveLength(1);
  });

  it("starts from the opponent's unexpected move, which goes in with the answer", () => {
    page();
    nextDay();
    const philidor = dayGames().find((card) => card.textContent?.includes('3…b6'))!;
    fireEvent.click(within(philidor).getByRole('button', { name: /^Add/ }));

    const panel = screen.getByRole('region', { name: 'Addition' });
    expect(panel).toHaveTextContent('Prepare your answer to 3…b6');
    playOnBoard('d4', 'e5');

    expect(within(panel).getByRole('list', { name: 'To add' })).toHaveTextContent('3…b6 4.dxe5');
    expect(within(panel).getByRole('button', { name: 'Add to my repertoire · 2 moves' })).toBeInTheDocument();
  });

  it('takes back the last move played', () => {
    page();
    nextDay();
    fireEvent.click(within(dayGames().find((card) => card.textContent?.includes('1…♘f6'))!).getByRole('button', { name: /^Add/ }));
    playOnBoard('g8', 'f6');

    fireEvent.click(screen.getByRole('button', { name: 'Undo last move' }));

    expect(screen.queryByRole('list', { name: 'To add' })).not.toBeInTheDocument();
  });

  it('shows the added move on the Openings page too', () => {
    page();
    nextDay();
    fireEvent.click(within(dayGames().find((card) => card.textContent?.includes('1…♘f6'))!).getByRole('button', { name: /^Add/ }));
    playOnBoard('g8', 'f6');
    fireEvent.click(screen.getByRole('button', { name: /^Add to my repertoire/ }));
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
