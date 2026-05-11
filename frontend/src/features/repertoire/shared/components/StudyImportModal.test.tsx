import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  handleImportSpy: vi.fn(),
}));

vi.mock('../../../../shared/components/UI/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock('./StudyBrowser', () => ({
  StudyBrowser: ({ onSelectStudy }: { onSelectStudy: (id: string) => void }) => (
    <button data-testid="select-study-btn" onClick={() => onSelectStudy('test-study')}>
      Select Study
    </button>
  ),
}));

vi.mock('../../../../stores/repertoireStore', () => ({
  useRepertoireStore: (selector: (s: { addCategory: () => void }) => unknown) =>
    selector({ addCategory: vi.fn() }),
}));

type FakeChapter = {
  index: number;
  name: string;
  orientation: string;
  moveCount: number;
  importable: boolean;
  skipReason?: string;
};

type FakeStudy = {
  studyId: string;
  studyName: string;
  chapters: FakeChapter[];
};

const defaultStudy: FakeStudy = {
  studyId: 'abc123',
  studyName: 'Test Study',
  chapters: [
    { index: 0, name: 'Chapter 1', orientation: 'white', moveCount: 10, importable: true },
    { index: 1, name: 'Chapter 2', orientation: 'white', moveCount: 8, importable: true },
    { index: 2, name: 'Chapter 3', orientation: 'black', moveCount: 12, importable: true },
  ],
};

let nextStudy: FakeStudy = defaultStudy;

vi.mock('../hooks/useStudyImport', async () => {
  const { useState } = await import('react');

  return {
    useStudyImport: () => {
      const [studyInfo, setStudyInfo] = useState<FakeStudy | null>(null);
      return {
        previewing: false,
        importing: false,
        studyInfo,
        previewError: null,
        handlePreview: async () => {
          setStudyInfo(nextStudy);
          return true;
        },
        handleImport: mocks.handleImportSpy,
        reset: () => { setStudyInfo(null); },
      };
    },
  };
});

import { StudyImportModal } from './StudyImportModal';

async function renderAndLoadStudy() {
  render(
    <MemoryRouter>
      <StudyImportModal isOpen onClose={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTestId('select-study-btn'));
  const firstChapterName = nextStudy.chapters[0].name;
  await waitFor(() => expect(screen.getByText(firstChapterName)).toBeInTheDocument());
}

function getChapterCheckbox(name: string): HTMLInputElement {
  const label = screen.getByText(name).closest('label') as HTMLElement;
  return within(label).getByRole('checkbox') as HTMLInputElement;
}

describe('StudyImportModal – chapter toggle', () => {
  beforeEach(() => {
    mocks.handleImportSpy.mockReset();
    mocks.handleImportSpy.mockResolvedValue({ kind: 'error' });
    nextStudy = defaultStudy;
  });

  it('all chapters are initially checked when a study loads', async () => {
    await renderAndLoadStudy();

    expect(getChapterCheckbox('Chapter 1')).toBeChecked();
    expect(getChapterCheckbox('Chapter 2')).toBeChecked();
    expect(getChapterCheckbox('Chapter 3')).toBeChecked();
  });

  it('clicking a chapter unchecks only that chapter', async () => {
    await renderAndLoadStudy();

    fireEvent.click(getChapterCheckbox('Chapter 2'));

    expect(getChapterCheckbox('Chapter 1')).toBeChecked();
    expect(getChapterCheckbox('Chapter 2')).not.toBeChecked();
    expect(getChapterCheckbox('Chapter 3')).toBeChecked();
  });

  it('clicking an unchecked chapter re-checks it', async () => {
    await renderAndLoadStudy();

    fireEvent.click(getChapterCheckbox('Chapter 2'));
    expect(getChapterCheckbox('Chapter 2')).not.toBeChecked();

    fireEvent.click(getChapterCheckbox('Chapter 2'));
    expect(getChapterCheckbox('Chapter 2')).toBeChecked();
  });

  it('preserves study order when chapters are toggled off and back on', async () => {
    await renderAndLoadStudy();

    // Toggle Chapter 1 off then back on. Set insertion order would now be {1, 2, 0},
    // but the import payload must follow study order.
    fireEvent.click(getChapterCheckbox('Chapter 1'));
    fireEvent.click(getChapterCheckbox('Chapter 1'));

    fireEvent.click(screen.getByText(/Import 3 chapter\(s\)/i));

    await waitFor(() => expect(mocks.handleImportSpy).toHaveBeenCalled());
    const chaptersArg = mocks.handleImportSpy.mock.calls[0][1];
    expect(chaptersArg).toEqual([0, 1, 2]);
  });
});

describe('StudyImportModal – skipped chapters', () => {
  beforeEach(() => {
    mocks.handleImportSpy.mockReset();
    mocks.handleImportSpy.mockResolvedValue({ kind: 'error' });
    nextStudy = {
      studyId: 'abc123',
      studyName: 'Mixed Study',
      chapters: [
        { index: 0, name: 'Standard Start', orientation: 'white', moveCount: 8, importable: true },
        { index: 1, name: 'From Position A', orientation: 'white', moveCount: 6, importable: false, skipReason: 'custom-starting-position' },
        { index: 2, name: 'From Position B', orientation: 'white', moveCount: 4, importable: false, skipReason: 'custom-starting-position' },
      ],
    };
  });

  it('disables checkboxes for non-importable chapters and excludes them from initial selection', async () => {
    await renderAndLoadStudy();

    expect(getChapterCheckbox('Standard Start')).toBeChecked();
    expect(getChapterCheckbox('Standard Start')).not.toBeDisabled();

    expect(getChapterCheckbox('From Position A')).not.toBeChecked();
    expect(getChapterCheckbox('From Position A')).toBeDisabled();
    expect(getChapterCheckbox('From Position B')).toBeDisabled();
  });

  it('shows a banner counting non-importable chapters', async () => {
    await renderAndLoadStudy();

    expect(screen.getByText(/2 chapters cannot be imported/i)).toBeInTheDocument();
  });

  it('only imports the selected, importable chapters', async () => {
    await renderAndLoadStudy();

    fireEvent.click(screen.getByText(/Import 1 chapter\(s\)/i));

    await waitFor(() => expect(mocks.handleImportSpy).toHaveBeenCalled());
    const chaptersArg = mocks.handleImportSpy.mock.calls[0][1];
    expect(chaptersArg).toEqual([0]);
  });
});

describe('StudyImportModal – name conflicts', () => {
  beforeEach(() => {
    mocks.handleImportSpy.mockReset();
    nextStudy = defaultStudy;
  });

  it('renders the conflict panel with a link to the existing repertoire when handleImport returns a conflict', async () => {
    const conflicts = [
      { chapterIndex: 0, chapterName: 'Chapter 1', targetName: 'Chapter 1', existingId: 'existing-rep-id', existingColor: 'white' },
    ];
    mocks.handleImportSpy.mockResolvedValueOnce({ kind: 'conflict', conflicts });

    await renderAndLoadStudy();
    fireEvent.click(screen.getByText(/Import 3 chapter\(s\)/i));

    const conflictAlert = await screen.findByRole('alert', { name: /repertoire name conflicts/i });
    expect(within(conflictAlert).getByText(/already exists/i)).toBeInTheDocument();

    const openExistingLink = within(conflictAlert).getByRole('link', { name: /open existing/i });
    expect(openExistingLink).toHaveAttribute('href', '/repertoire/existing-rep-id/edit');
  });

  it('retries the import with renameStrategy=auto-suffix when the user clicks "Import with new names"', async () => {
    const conflicts = [
      { chapterIndex: 0, chapterName: 'Chapter 1', targetName: 'Chapter 1', existingId: 'existing-rep-id', existingColor: 'white' },
    ];
    mocks.handleImportSpy
      .mockResolvedValueOnce({ kind: 'conflict', conflicts })
      .mockResolvedValueOnce({ kind: 'success', result: { repertoires: [], count: 0 } });

    await renderAndLoadStudy();
    fireEvent.click(screen.getByText(/Import 3 chapter\(s\)/i));

    await screen.findByRole('alert', { name: /repertoire name conflicts/i });
    fireEvent.click(screen.getByText(/Import with new names/i));

    await waitFor(() => expect(mocks.handleImportSpy).toHaveBeenCalledTimes(2));
    const secondCallArgs = mocks.handleImportSpy.mock.calls[1];
    // renameStrategy is the 10th positional argument (index 9).
    expect(secondCallArgs[9]).toBe('auto-suffix');
  });

  it('dismisses the conflict panel when the user clicks Cancel', async () => {
    const conflicts = [
      { chapterIndex: 0, chapterName: 'Chapter 1', targetName: 'Chapter 1', existingId: 'existing-rep-id', existingColor: 'white' },
    ];
    mocks.handleImportSpy.mockResolvedValueOnce({ kind: 'conflict', conflicts });

    await renderAndLoadStudy();
    fireEvent.click(screen.getByText(/Import 3 chapter\(s\)/i));

    const alert = await screen.findByRole('alert', { name: /repertoire name conflicts/i });
    const cancelBtn = within(alert).getByText(/^Cancel$/);
    fireEvent.click(cancelBtn);

    await waitFor(() => expect(screen.queryByRole('alert', { name: /repertoire name conflicts/i })).not.toBeInTheDocument());
  });
});
