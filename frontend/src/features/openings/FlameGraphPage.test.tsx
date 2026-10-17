import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FlameGraphPage } from './FlameGraphPage';

describe('FlameGraphPage', () => {
  it('shows a priority in the flame graph when it is clicked', () => {
    render(<FlameGraphPage />);

    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    expect(screen.getByRole('tab', { name: 'Black' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent('All games›1.d4›1…Nf6');
  });

  it('shows the position under the pointer, then falls back to the zoomed one', async () => {
    render(<FlameGraphPage />);
    const panel = screen.getByRole('complementary', { name: 'Position' });
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: /1\.e4 d5 2\.exd5/ }));
    expect(await within(panel).findByText('Scandinavian Defense')).toBeInTheDocument();
    expect(panel).toHaveTextContent('Games207');

    fireEvent.mouseLeave(screen.getByRole('list'));
    expect(await within(panel).findByText('Indian Defense')).toBeInTheDocument();
    expect(panel).toHaveTextContent('Games124');
  });

  it('resets the zoom when switching side', () => {
    render(<FlameGraphPage />);
    fireEvent.click(screen.getByRole('button', { name: /1\.d4 Nf6/ }));

    fireEvent.click(screen.getByRole('tab', { name: 'White' }));

    expect(screen.getByRole('navigation', { name: 'Zoom path' })).toHaveTextContent(/^All games$/);
  });
});
