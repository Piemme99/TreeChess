import { describe, expect, it } from 'vitest';
import { mergeSaved } from './storage';

describe('mergeSaved', () => {
  it('keeps what the server has over what the browser kept', () => {
    const { values, upload } = mergeSaved({ worked: [{ side: 'w', path: ['d4'], since: '2026-11-17' }] }, () => '[]');
    expect(JSON.parse(values.get('worked')!)).toEqual([{ side: 'w', path: ['d4'], since: '2026-11-17' }]);
    expect(upload).not.toContain('worked');
  });

  it('sends up the decisions the browser took before the server kept them, once', () => {
    const local: Record<string, string> = { 'ignored-checks': '[3,14]', 'replay-day': '2026-01-04' };
    const { values, upload } = mergeSaved({}, (key) => local[key] ?? null);
    expect(upload).toEqual(['ignored-checks']);
    expect(values.get('ignored-checks')).toBe('[3,14]');
    expect(values.has('replay-day')).toBe(false);
  });
});
