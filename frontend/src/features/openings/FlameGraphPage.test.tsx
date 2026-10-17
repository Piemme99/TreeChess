import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlameGraphPage } from './FlameGraphPage';

describe('FlameGraphPage', () => {
  it('shows a priority in the flame graph when it is clicked', () => {
    render(<FlameGraphPage />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('tab', { name: 'Black' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent('All games›1.d4›1…Nf6');
  });

  it('resets the zoom when switching side', () => {
    render(<FlameGraphPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('tab', { name: 'White' }));

    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent(/^All games$/);
  });
});
