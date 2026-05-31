import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StaticBoard } from './StaticBoard';
import { STARTING_FEN } from '../../utils/chess';

const DEFAULT_ARROW_COLOR = 'rgb(255,170,0)';

function renderArrowSVG(color: string): string {
  const { container } = render(
    <StaticBoard fen={STARTING_FEN} arrows={[['e2', 'e4', color]]} />
  );
  const svg = container.querySelector('svg');
  return svg?.innerHTML ?? '';
}

describe('StaticBoard arrow color escaping', () => {
  it('keeps a valid hex color in the arrow markup', () => {
    const html = renderArrowSVG('#ff8800');
    expect(html).toContain('#ff8800');
  });

  it('keeps a valid rgb() color in the arrow markup', () => {
    const html = renderArrowSVG('rgb(0,128,255)');
    expect(html).toContain('rgb(0,128,255)');
  });

  it('keeps a valid named color in the arrow markup', () => {
    const html = renderArrowSVG('red');
    // fill="red" / stroke="red" should be present
    expect(html).toContain('red');
  });

  it('falls back to the default color when an injection payload is passed', () => {
    const payload = '"/><script>alert(1)</script>';
    const html = renderArrowSVG(payload);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain(DEFAULT_ARROW_COLOR);
  });

  it('falls back to the default color for an attribute-break payload', () => {
    const payload = 'red" onload="alert(1)';
    const html = renderArrowSVG(payload);
    expect(html).not.toContain('onload=');
    expect(html).toContain(DEFAULT_ARROW_COLOR);
  });

  it('falls back to the default color for a url() payload', () => {
    const html = renderArrowSVG('url(#evil)');
    expect(html).not.toContain('url(#evil)');
    expect(html).toContain(DEFAULT_ARROW_COLOR);
  });
});
