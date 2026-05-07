import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { TrainingLichessGate } from './TrainingLichessGate';

function renderInRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TrainingLichessGate', () => {
  it('explains why Training requires a linked Lichess account', () => {
    renderInRouter(<TrainingLichessGate />);
    expect(screen.getByText(/connect your lichess account/i)).toBeInTheDocument();
  });

  it('exposes a link to the profile page where users can connect Lichess', () => {
    renderInRouter(<TrainingLichessGate />);
    const link = screen.getByRole('link', { name: /connect lichess|go to profile|connect your account/i });
    expect(link).toHaveAttribute('href', '/profile');
  });
});
