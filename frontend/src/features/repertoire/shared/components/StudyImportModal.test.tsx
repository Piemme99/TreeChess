import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

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

vi.mock('../hooks/useStudyImport', async () => {
  const { useState } = await import('react');

  const fakeStudyData = {
    studyId: 'abc123',
    studyName: 'Test Study',
    chapters: [
      { index: 0, name: 'Chapter 1', orientation: 'white', moveCount: 10 },
      { index: 1, name: 'Chapter 2', orientation: 'white', moveCount: 8 },
      { index: 2, name: 'Chapter 3', orientation: 'black', moveCount: 12 },
    ],
  };

  return {
    useStudyImport: () => {
      const [studyInfo, setStudyInfo] = useState<typeof fakeStudyData | null>(null);
      return {
        previewing: false,
        importing: false,
        studyInfo,
        previewError: null,
        handlePreview: async () => {
          setStudyInfo(fakeStudyData);
          return true;
        },
        handleImport: async () => null,
        reset: () => { setStudyInfo(null); },
      };
    },
  };
});

import { StudyImportModal } from './StudyImportModal';

async function renderAndLoadStudy() {
  render(<StudyImportModal isOpen onClose={vi.fn()} />);
  fireEvent.click(screen.getByTestId('select-study-btn'));
  await waitFor(() => expect(screen.getByText('Chapter 1')).toBeInTheDocument());
}

function getChapterCheckbox(name: string): HTMLInputElement {
  const label = screen.getByText(name).closest('label') as HTMLElement;
  return within(label).getByRole('checkbox') as HTMLInputElement;
}

describe('StudyImportModal – chapter toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
