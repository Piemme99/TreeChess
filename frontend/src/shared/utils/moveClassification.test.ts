import { describe, it, expect } from 'vitest';
import {
  cpToWinPercent,
  mateToCp,
  evalToWinPercent,
  classifyMove,
  classifyMoveFromEvals,
  getMoveQualityDisplay,
  formatCpScore,
  formatEval,
  normalizeEvalForWhite,
} from './moveClassification';

describe('cpToWinPercent', () => {
  it('returns 50% for 0 centipawns (equal position)', () => {
    expect(cpToWinPercent(0)).toBeCloseTo(50, 1);
  });

  it('returns ~59% for +100cp', () => {
    const wp = cpToWinPercent(100);
    expect(wp).toBeGreaterThan(57);
    expect(wp).toBeLessThan(62);
  });

  it('returns ~41% for -100cp', () => {
    const wp = cpToWinPercent(-100);
    expect(wp).toBeGreaterThan(38);
    expect(wp).toBeLessThan(43);
  });

  it('returns ~68% for +200cp', () => {
    const wp = cpToWinPercent(200);
    expect(wp).toBeGreaterThan(65);
    expect(wp).toBeLessThan(71);
  });

  it('returns >85% for +500cp', () => {
    expect(cpToWinPercent(500)).toBeGreaterThan(85);
  });

  it('returns >97% for +1000cp', () => {
    expect(cpToWinPercent(1000)).toBeGreaterThan(97);
  });

  it('clamps at ±1000cp', () => {
    // Very large values should be clamped
    expect(cpToWinPercent(5000)).toBeCloseTo(cpToWinPercent(1000), 1);
    expect(cpToWinPercent(-5000)).toBeCloseTo(cpToWinPercent(-1000), 1);
  });

  it('is symmetric around 50%', () => {
    expect(cpToWinPercent(100) + cpToWinPercent(-100)).toBeCloseTo(100, 5);
    expect(cpToWinPercent(300) + cpToWinPercent(-300)).toBeCloseTo(100, 5);
  });
});

describe('mateToCp', () => {
  it('converts mate in 1 to high cp', () => {
    expect(mateToCp(1)).toBe(2000);
    expect(mateToCp(-1)).toBe(-2000);
  });

  it('converts mate in 5 to proportional cp', () => {
    expect(mateToCp(5)).toBe(1600);
    expect(mateToCp(-5)).toBe(-1600);
  });

  it('clamps at distance 10', () => {
    // Mate in 10 and beyond use distance 10
    expect(mateToCp(10)).toBe(1100);
    expect(mateToCp(15)).toBe(1100);
  });
});

describe('evalToWinPercent', () => {
  it('returns 50% when no data', () => {
    expect(evalToWinPercent(null, null)).toBe(50);
    expect(evalToWinPercent(undefined, undefined)).toBe(50);
  });

  it('uses mate score when present', () => {
    // Mate for white = very high Win%
    expect(evalToWinPercent(null, 3)).toBeGreaterThan(95);
    expect(evalToWinPercent(null, -3)).toBeLessThan(5);
  });

  it('uses cp score when no mate', () => {
    expect(evalToWinPercent(200, null)).toBeCloseTo(cpToWinPercent(200), 1);
  });
});

describe('classifyMove', () => {
  it('classifies a move with 0% drop as "best"', () => {
    const result = classifyMove(50, 50);
    expect(result.category).toBe('best');
    expect(result.winPercentDrop).toBe(0);
  });

  it('classifies explicitly best move', () => {
    const result = classifyMove(50, 48, { isBestMove: true });
    expect(result.category).toBe('best');
  });

  it('classifies < 2% drop as "excellent"', () => {
    const result = classifyMove(50, 49);
    expect(result.category).toBe('excellent');
  });

  it('classifies 2-5% drop as "good"', () => {
    const result = classifyMove(50, 47);
    expect(result.category).toBe('good');
  });

  it('classifies 5-8% drop as "inaccuracy"', () => {
    const result = classifyMove(50, 43); // 7% drop
    expect(result.category).toBe('inaccuracy');
  });

  it('classifies 8-15% drop as "mistake"', () => {
    const result = classifyMove(50, 40); // 10% drop
    expect(result.category).toBe('mistake');
  });

  it('classifies > 15% drop as "blunder"', () => {
    const result = classifyMove(50, 30); // 20% drop
    expect(result.category).toBe('blunder');
  });

  it('treats improving positions as "best" (no negative drop)', () => {
    const result = classifyMove(40, 60);
    expect(result.category).toBe('best');
    expect(result.winPercentDrop).toBe(0);
  });
});

describe('classifyMoveFromEvals', () => {
  it('correctly classifies small loss from white perspective', () => {
    // White plays, eval goes from +100cp to +50cp (50cp loss)
    // Win% drop ~3.2% → "good" (between 2% and 5% thresholds)
    const result = classifyMoveFromEvals(100, null, 50, null, 'w');
    expect(['good', 'excellent']).toContain(result.category);
    expect(result.winPercentDrop).toBeGreaterThan(2);
    expect(result.winPercentDrop).toBeLessThan(5);
  });

  it('correctly classifies from black perspective', () => {
    // Black plays, eval from white's POV goes from -100cp to -50cp
    // cpLoss = 50, same as above from black's side
    const result = classifyMoveFromEvals(-100, null, -50, null, 'b');
    expect(['good', 'excellent']).toContain(result.category);
  });

  it('noise floor: normal opening moves stay "good" even with small fluctuations', () => {
    // Simulating minor eval fluctuation: +20cp to -3cp (23cp loss)
    // cpLoss = 23 < 25 noise floor → capped at "good" regardless of Win% drop
    const result = classifyMoveFromEvals(20, null, -3, null, 'w');
    expect(result.category).not.toBe('inaccuracy');
    expect(result.category).not.toBe('mistake');
    expect(result.category).not.toBe('blunder');
    expect(['best', 'excellent', 'good']).toContain(result.category);
  });

  it('noise floor: loss above threshold allows inaccuracy classification', () => {
    // Position goes from +50cp to -10cp (60cp loss, well above 25cp floor)
    // Win% drop ~5.5%, cpLoss = 60 > 25 noise floor → "inaccuracy" allowed
    const result = classifyMoveFromEvals(50, null, -10, null, 'w');
    expect(['good', 'inaccuracy']).toContain(result.category);
  });

  it('classifies a losing move from +800cp to +500cp as not blunder', () => {
    // 300cp loss in a winning position
    // Win% drop from ~94.6% to ~86.3% ≈ 8.3% → "mistake" (threshold 8-15%)
    // Key: NOT a blunder despite 300cp loss, because Win% compression
    const result = classifyMoveFromEvals(800, null, 500, null, 'w');
    expect(result.category).not.toBe('blunder');
    expect(['inaccuracy', 'mistake']).toContain(result.category);
  });

  it('classifies a moderate cp loss in equal position as mistake', () => {
    // 100cp loss in an equal position: Win% from 50% to ~40.9% ≈ 9.1%
    // cpLoss = 100 (above noise floor), 9.1% > 8% threshold → "mistake"
    const result = classifyMoveFromEvals(0, null, -100, null, 'w');
    expect(result.category).toBe('mistake');
  });

  it('classifies a large cp loss in equal position as blunder', () => {
    // 200cp loss: Win% from 50% to ~32.4% ≈ 17.6% → "blunder" (threshold > 15%)
    const result = classifyMoveFromEvals(0, null, -200, null, 'w');
    expect(result.category).toBe('blunder');
  });

  it('classifies a huge cp loss in equal position as blunder', () => {
    // 400cp loss: Win% from 50% to ~18.7% ≈ 31.3% → "blunder"
    const result = classifyMoveFromEvals(0, null, -400, null, 'w');
    expect(result.category).toBe('blunder');
  });

  it('key insight: same cp loss is less severe when already winning', () => {
    // 200cp loss when already at +500cp
    const resultFromWinning = classifyMoveFromEvals(500, null, 300, null, 'w');
    // 200cp loss from equal position
    const resultFromEqual = classifyMoveFromEvals(0, null, -200, null, 'w');

    // The loss from a winning position should be classified less severely
    const severityOrder = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
    expect(severityOrder.indexOf(resultFromWinning.category))
      .toBeLessThanOrEqual(severityOrder.indexOf(resultFromEqual.category));
  });
});

describe('getMoveQualityDisplay', () => {
  it('returns correct display for "best" category', () => {
    const classification = classifyMove(50, 50);
    const display = getMoveQualityDisplay(classification);
    expect(display.category).toBe('best');
    expect(display.dotColor).toContain('cyan');
    expect(display.symbol).toBe('!!');
    expect(display.lossDisplay).toBeNull();
  });

  it('returns loss display for "inaccuracy"', () => {
    const classification = classifyMove(50, 43);
    const display = getMoveQualityDisplay(classification);
    expect(display.category).toBe('inaccuracy');
    expect(display.lossDisplay).not.toBeNull();
    expect(display.dotColor).toContain('warning');
    expect(display.symbol).toBe('?!');
  });

  it('returns loss display for "blunder"', () => {
    const classification = classifyMove(50, 30); // 20% drop → blunder
    const display = getMoveQualityDisplay(classification);
    expect(display.category).toBe('blunder');
    expect(display.lossDisplay).toContain('20');
    expect(display.dotColor).toContain('danger');
    expect(display.symbol).toBe('??');
  });
});

describe('formatCpScore', () => {
  it('formats positive score with + sign', () => {
    expect(formatCpScore(150)).toBe('+1.5');
  });

  it('formats negative score with - sign', () => {
    expect(formatCpScore(-200)).toBe('-2.0');
  });

  it('formats zero as 0.0', () => {
    expect(formatCpScore(0)).toBe('0.0');
  });

  it('handles null/undefined', () => {
    expect(formatCpScore(null)).toBe('0.0');
    expect(formatCpScore(undefined)).toBe('0.0');
  });
});

describe('formatEval', () => {
  it('formats cp score', () => {
    expect(formatEval(150, null)).toBe('+1.5');
  });

  it('formats mate score', () => {
    expect(formatEval(null, 3)).toBe('+M3');
    expect(formatEval(null, -5)).toBe('-M5');
  });

  it('prefers mate over cp when both present', () => {
    expect(formatEval(150, 3)).toBe('+M3');
  });
});

describe('normalizeEvalForWhite', () => {
  it('returns as-is when white to move', () => {
    const result = normalizeEvalForWhite(100, null, 'w');
    expect(result.score).toBe(100);
  });

  it('flips when black to move', () => {
    const result = normalizeEvalForWhite(100, null, 'b');
    expect(result.score).toBe(-100);
  });

  it('flips mate correctly', () => {
    const result = normalizeEvalForWhite(null, 3, 'b');
    expect(result.mate).toBe(-3);
  });
});
