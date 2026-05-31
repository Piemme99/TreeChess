import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

import { MistakesList } from './MistakesList';
import type { InsightsResponse, OpeningMistake } from '../../types';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makeMistake(overrides: Partial<OpeningMistake> = {}): OpeningMistake {
  return {
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    playedMove: 'Nc6',
    bestMove: 'd5',
    winrateDrop: 0.12,
    frequency: 3,
    score: -50,
    games: [
      { analysisId: 'a1', gameIndex: 0, plyNumber: 4, white: 'W', black: 'B', result: '1-0', date: '2026-01-01' },
    ],
    ...overrides,
  };
}

function makeInsights(mistakes: OpeningMistake[]): InsightsResponse {
  return {
    worstMistakes: mistakes,
    engineAnalysisDone: true,
    engineAnalysisTotal: 1,
    engineAnalysisCompleted: 1,
  };
}

describe('MistakesList thumbnail accessibility', () => {
  it('renders the board thumbnail as a labelled button', () => {
    renderInRouter(<MistakesList insights={makeInsights([makeMistake()])} />);
    expect(screen.getByRole('button', { name: 'View Nc6 mistake on the board' })).toBeInTheDocument();
  });

  it('navigates to the game when the thumbnail is activated via the keyboard', () => {
    navigate.mockClear();
    renderInRouter(<MistakesList insights={makeInsights([makeMistake()])} />);
    const thumb = screen.getByRole('button', { name: 'View Nc6 mistake on the board' });

    fireEvent.keyDown(thumb, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith(
      '/analyse/a1/game/0?ply=4',
      expect.objectContaining({ state: expect.any(Object) })
    );
  });

  it('exposes an accessible name on the dismiss control', () => {
    renderInRouter(<MistakesList insights={makeInsights([makeMistake()])} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
