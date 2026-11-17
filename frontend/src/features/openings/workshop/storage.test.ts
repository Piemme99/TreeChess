import { describe, expect, it, vi } from 'vitest';
import { api } from '../../../services/api';
import { mergeSaved, setStorageScope, writeStored } from './storage';

vi.mock('../../../services/api', () => ({ api: { put: vi.fn(() => Promise.resolve()) }, getAccessToken: () => null }));

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

describe('writeStored', () => {
  it('sends a decision up even when the account reloads before it leaves', () => {
    vi.useFakeTimers();
    setStorageScope('lichess:pmg', new Map());
    writeStored('review', '{"w":[],"b":[]}');
    const reloaded = new Map<string, string>();
    setStorageScope('lichess:pmg', reloaded);
    vi.runAllTimers();
    expect(api.put).toHaveBeenCalledWith('/v2/state/review', '{"w":[],"b":[]}', expect.anything());
    expect(reloaded.get('review')).toBe('{"w":[],"b":[]}');
    vi.useRealTimers();
  });
});
