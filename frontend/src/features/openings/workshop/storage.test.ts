import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../services/api';
import { mergeSaved, readStored, setStorageScope, writeStored } from './storage';

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
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(api.put).mockReset();
  });

  it('sends a decision up even when the account reloads before it leaves', () => {
    vi.useFakeTimers();
    vi.mocked(api.put).mockResolvedValue(undefined);
    setStorageScope('lichess:pmg', new Map());
    writeStored('review', '{"w":[],"b":[]}');
    setStorageScope('lichess:pmg', new Map());
    vi.runAllTimers();
    expect(api.put).toHaveBeenCalledWith('/v2/state/review', '{"w":[],"b":[]}', expect.anything());
  });

  it('keeps a decision already sent when the account reloads what the server had before it', () => {
    vi.useFakeTimers();
    vi.mocked(api.put).mockResolvedValue(undefined);
    setStorageScope('lichess:pmg', new Map());
    writeStored('worked', '["d4"]');
    vi.runAllTimers();
    setStorageScope('lichess:pmg', new Map([['worked', '[]']]));
    expect(readStored('worked')).toBe('["d4"]');
  });

  it('does not send an older answer again over a newer one', async () => {
    vi.useFakeTimers();
    let fail: (error: Error) => void = () => undefined;
    vi.mocked(api.put).mockImplementationOnce(() => new Promise((_, reject) => (fail = reject))).mockResolvedValue(undefined);
    setStorageScope('lichess:pmg', new Map());
    writeStored('review', '"old"');
    vi.advanceTimersByTime(300);
    writeStored('review', '"new"');
    vi.advanceTimersByTime(300);
    fail(new Error('timeout'));
    await vi.runAllTimersAsync();
    const sent = vi.mocked(api.put).mock.calls.map(([, value]) => value);
    expect(sent.at(-1)).toBe('"new"');
  });
});
