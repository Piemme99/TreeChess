import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ExploreRepertoireCard } from './ExploreRepertoireCard';
import { createRepertoire } from '../../test/factories';
import type { RepertoireOrigin } from '../../types';

vi.mock('../../shared/components/Board', () => ({
  StaticBoard: () => <div data-testid="static-board" />,
}));

function renderCard(origin: RepertoireOrigin) {
  return render(
    <MemoryRouter>
      <ExploreRepertoireCard
        repertoire={createRepertoire({ origin, authorName: 'Author' })}
        onImport={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe('ExploreRepertoireCard origin links', () => {
  it('renders Lichess links for a safe https origin URL', () => {
    const { container } = renderCard({
      type: 'lichess',
      url: 'https://lichess.org/study/abcd1234',
      creator: 'thibault',
    });

    const links = container.querySelectorAll('a[href]');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('https://lichess.org/study/abcd1234');
    });
    expect(screen.getByText('thibault')).toBeInTheDocument();
  });

  it('does not render an anchor for a javascript: origin URL but keeps the creator text', () => {
    const { container } = renderCard({
      type: 'lichess',
      url: 'javascript:alert(1)',
      creator: 'evil',
    });

    expect(container.querySelector('a[href]')).toBeNull();
    // Creator name still shown as plain text
    expect(screen.getByText('evil')).toBeInTheDocument();
  });

  it('does not render an anchor when the origin URL is missing', () => {
    const { container } = renderCard({
      type: 'lichess',
      creator: 'someone',
    });

    expect(container.querySelector('a[href]')).toBeNull();
    expect(screen.getByText('someone')).toBeInTheDocument();
  });
});
