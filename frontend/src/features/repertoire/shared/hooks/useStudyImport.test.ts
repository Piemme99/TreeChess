import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../../services/api', () => ({
  studyApi: {
    import: vi.fn(),
    preview: vi.fn(),
  },
}));

vi.mock('../../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { studyApi } from '../../../../services/api';
import { useStudyImport } from './useStudyImport';

const mockedImport = vi.mocked(studyApi.import);

describe('useStudyImport — handleImport', () => {
  beforeEach(() => {
    mockedImport.mockReset();
  });

  it('returns a conflict outcome on 409 name-conflict and skips the toast', async () => {
    const conflicts = [
      { chapterIndex: 0, chapterName: 'Najdorf', targetName: 'Najdorf', existingId: 'rep-1', existingColor: 'white' },
    ];
    mockedImport.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'A repertoire named "Najdorf" already exists', type: 'name-conflict', conflicts } },
    });

    const { result } = renderHook(() => useStudyImport());

    let outcome: Awaited<ReturnType<typeof result.current.handleImport>> | undefined;
    await act(async () => {
      outcome = await result.current.handleImport('https://lichess.org/study/abcdefgh', [0]);
    });

    expect(outcome).toEqual({ kind: 'conflict', conflicts });
  });

  it('passes renameStrategy through to the API on retry', async () => {
    mockedImport.mockResolvedValueOnce({ repertoires: [], count: 0 });

    const { result } = renderHook(() => useStudyImport());

    await act(async () => {
      await result.current.handleImport(
        'https://lichess.org/study/abcdefgh',
        [0],
        false,
        undefined,
        false,
        undefined,
        false,
        true,
        undefined,
        'auto-suffix',
      );
    });

    expect(mockedImport).toHaveBeenCalledWith(
      'https://lichess.org/study/abcdefgh',
      [0],
      false,
      undefined,
      false,
      undefined,
      false,
      true,
      undefined,
      'auto-suffix',
    );
  });

  it('returns an error outcome on non-409 failures', async () => {
    mockedImport.mockRejectedValueOnce({
      response: { status: 500, data: { error: 'boom' } },
    });

    const { result } = renderHook(() => useStudyImport());

    let outcome: Awaited<ReturnType<typeof result.current.handleImport>> | undefined;
    await act(async () => {
      outcome = await result.current.handleImport('https://lichess.org/study/abcdefgh', [0]);
    });

    expect(outcome?.kind).toBe('error');
  });
});
