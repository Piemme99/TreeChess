import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_COLORS,
  colorFromModifiers,
  toggleArrow,
  toggleHighlight,
} from './annotations';
import type { ArrowAnnotation, SquareHighlightAnnotation } from '../../../../types';

const mods = (over: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  ...over,
});

describe('colorFromModifiers', () => {
  it('returns green with no modifiers', () => {
    expect(colorFromModifiers(mods())).toBe(ANNOTATION_COLORS.green);
  });

  it('maps shift -> red, alt -> blue, ctrl -> yellow', () => {
    expect(colorFromModifiers(mods({ shiftKey: true }))).toBe(ANNOTATION_COLORS.red);
    expect(colorFromModifiers(mods({ altKey: true }))).toBe(ANNOTATION_COLORS.blue);
    expect(colorFromModifiers(mods({ ctrlKey: true }))).toBe(ANNOTATION_COLORS.yellow);
  });

  it('prefers shift over alt/ctrl when multiple are held', () => {
    expect(colorFromModifiers(mods({ shiftKey: true, ctrlKey: true }))).toBe(ANNOTATION_COLORS.red);
  });
});

describe('toggleArrow', () => {
  const green = ANNOTATION_COLORS.green;
  const red = ANNOTATION_COLORS.red;

  it('adds a new arrow', () => {
    const result = toggleArrow([], 'e2', 'e4', green);
    expect(result).toEqual([{ from: 'e2', to: 'e4', color: green }]);
  });

  it('removes an identical arrow (same squares + colour)', () => {
    const arrows: ArrowAnnotation[] = [{ from: 'e2', to: 'e4', color: green }];
    expect(toggleArrow(arrows, 'e2', 'e4', green)).toEqual([]);
  });

  it('recolours an arrow drawn again with a different colour', () => {
    const arrows: ArrowAnnotation[] = [{ from: 'e2', to: 'e4', color: green }];
    expect(toggleArrow(arrows, 'e2', 'e4', red)).toEqual([{ from: 'e2', to: 'e4', color: red }]);
  });

  it('does not mutate the input array', () => {
    const arrows: ArrowAnnotation[] = [{ from: 'e2', to: 'e4', color: green }];
    toggleArrow(arrows, 'g1', 'f3', green);
    expect(arrows).toHaveLength(1);
  });
});

describe('toggleHighlight', () => {
  const green = ANNOTATION_COLORS.green;
  const blue = ANNOTATION_COLORS.blue;

  it('adds a new highlight', () => {
    expect(toggleHighlight([], 'd4', green)).toEqual([{ square: 'd4', color: green }]);
  });

  it('removes an identical highlight', () => {
    const highlights: SquareHighlightAnnotation[] = [{ square: 'd4', color: green }];
    expect(toggleHighlight(highlights, 'd4', green)).toEqual([]);
  });

  it('recolours a highlight clicked again with a different colour', () => {
    const highlights: SquareHighlightAnnotation[] = [{ square: 'd4', color: green }];
    expect(toggleHighlight(highlights, 'd4', blue)).toEqual([{ square: 'd4', color: blue }]);
  });
});
