import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { HomePage } from './HomePage';
import { SessionPage } from './SessionPage';

vi.mock('../line/explorer', () => ({ explore: () => Promise.resolve(null), hasExplorer: () => false, LEVEL_LABEL: 'level' }));

const app = () =>
  render(
    <MemoryRouter initialEntries={['/dev/home']}>
      <Routes>
        <Route path="/dev/home" element={<HomePage />} />
        <Route path="/dev/session" element={<SessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
const progress = () => screen.getByLabelText('Progress').textContent;
const title = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('the session after games', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
    vi.restoreAllMocks();
  });

  afterEach(() => localStorage.clear());

  it('has nothing to settle before the first game', () => {
    app();

    expect(screen.queryByRole('link', { name: 'I just played' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'I just played' })).toHaveTextContent('No game yet');
  });

  it('opens the positions the games left, one at a time, the most frequent first', () => {
    localStorage.setItem('kumquat.v2.replay-day', '2026-04-10');
    app();
    const door = screen.getByRole('link', { name: 'I just played' });
    expect(door).toHaveTextContent('38 games today');

    fireEvent.click(door);

    expect(progress()).toMatch(/^1 \/ \d+$/);
    expect(title()).toMatch(/^You played 1…♘f6in 17 games, your repertoire has 1…d5$/);
    expect(within(screen.getByRole('list', { name: 'Facts' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('stays on the repertoire or skips, and moves on', () => {
    localStorage.setItem('kumquat.v2.replay-day', '2026-04-10');
    app();
    fireEvent.click(screen.getByRole('link', { name: 'I just played' }));

    fireEvent.click(screen.getByRole('button', { name: 'Stay on 1…d5' }));
    expect(progress()).toMatch(/^2 \//);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(progress()).toMatch(/^3 \//);

    fireEvent.click(screen.getByRole('link', { name: '← Home' }));
    fireEvent.click(screen.getByRole('link', { name: 'I just played' }));
    expect(title()).not.toMatch(/1…♘f6/);
  });

  it('keeps the move played: it joins the repertoire and the position is settled', () => {
    localStorage.setItem('kumquat.v2.replay-day', '2026-04-10');
    app();
    fireEvent.click(screen.getByRole('link', { name: 'I just played' }));

    fireEvent.click(screen.getByRole('button', { name: 'Keep 1…♘f6' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add to my repertoire · 1 move/ }));

    expect(progress()).toMatch(/^2 \//);
    expect(JSON.parse(localStorage.getItem('kumquat.v2.additions')!)).toHaveLength(1);
  });
});
