import { describe, expect, it } from 'vitest';
import type { Priority } from '../domain/priorities';
import { weakRedirect } from './weakTask';

const weak = (side: Priority['side'], path: string, leak?: string): Priority => ({
  side,
  path: path.split(' '),
  games: 40,
  score: 0.4,
  average: 0.52,
  pointsToGain: 5,
  leak,
});

const morra = weak('w', 'e4 c5 d4');
const caroKann = weak('b', 'e4 c6 d4 d5 Nc3 dxe4', 'Nxe4');
const asked = (side: Priority['side'], line: string) => ({ side, line: line.split(' ') });

describe('the address of a Weak opening task', () => {
  it('a link to a line that is no longer a weak opening opens the first weak opening', () => {
    expect(weakRedirect([morra, caroKann], asked('w', 'd4 d5 c4'))).toBe(1);
  });

  it('a weak opening now shown after its costly reply is opened there, at its own rank', () => {
    expect(weakRedirect([morra, caroKann], asked('b', 'e4 c6 d4 d5 Nc3 dxe4'))).toBe(2);
    expect(weakRedirect([morra, caroKann], asked('b', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4'))).toBeNull();
  });
});
