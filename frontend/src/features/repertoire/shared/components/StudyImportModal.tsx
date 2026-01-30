import { useState, useCallback } from 'react';
import { Modal } from '../../../../shared/components/UI/Modal';
import { Button } from '../../../../shared/components/UI/Button';
import { useStudyImport } from '../hooks/useStudyImport';

interface StudyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StudyImportModal({ isOpen, onClose, onSuccess }: StudyImportModalProps) {
  const [url, setUrl] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());

  const { previewing, importing, studyInfo, previewError, handlePreview, handleImport, reset } = useStudyImport(onSuccess);

  const handleClose = useCallback(() => {
    setUrl('');
    setSelectedChapters(new Set());
    reset();
    onClose();
  }, [onClose, reset]);

  const onPreview = useCallback(async () => {
    const success = await handlePreview(url);
    if (success) {
      // Auto-select all chapters
      setSelectedChapters(new Set());
    }
  }, [url, handlePreview]);

  const onImport = useCallback(async () => {
    const chapters = selectedChapters.size > 0
      ? Array.from(selectedChapters)
      : studyInfo?.chapters.map(c => c.index) ?? [];
    const result = await handleImport(url, chapters);
    if (result) {
      handleClose();
    }
  }, [url, selectedChapters, studyInfo, handleImport, handleClose]);

  const toggleChapter = (index: number) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!studyInfo) return;
    if (selectedChapters.size === studyInfo.chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(studyInfo.chapters.map(c => c.index)));
    }
  };

  const allSelected = studyInfo ? selectedChapters.size === studyInfo.chapters.length : false;
  const noneSelected = selectedChapters.size === 0;
  const importCount = noneSelected ? (studyInfo?.chapters.length ?? 0) : selectedChapters.size;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Lichess Study" size="md">
      {!studyInfo ? (
        <div className="study-import-step">
          <p className="study-import-hint">
            Paste a Lichess study URL to import its chapters as repertoires.
          </p>
          <div className="study-import-url-row">
            <input
              type="text"
              className="study-import-input"
              placeholder="https://lichess.org/study/abcdef12"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onPreview()}
              autoFocus
            />
            <Button onClick={onPreview} loading={previewing} disabled={!url.trim()}>
              Preview
            </Button>
          </div>
          {previewError && (
            <p className="study-import-error">{previewError}</p>
          )}
        </div>
      ) : (
        <div className="study-import-step">
          <div className="study-import-header">
            <h3 className="study-import-name">{studyInfo.studyName}</h3>
            <span className="study-import-count">{studyInfo.chapters.length} chapter(s)</span>
          </div>

          <div className="study-import-chapters">
            <label className="study-chapter-row study-chapter-row--header">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className="study-chapter-label">Select all</span>
            </label>
            {studyInfo.chapters.map((ch) => (
              <label key={ch.index} className="study-chapter-row">
                <input
                  type="checkbox"
                  checked={noneSelected || selectedChapters.has(ch.index)}
                  onChange={() => toggleChapter(ch.index)}
                />
                <span className="study-chapter-color">
                  {ch.orientation === 'white' ? '\u2654' : '\u265A'}
                </span>
                <span className="study-chapter-name">{ch.name}</span>
                <span className="study-chapter-moves">{ch.moveCount} moves</span>
              </label>
            ))}
          </div>

          <div className="study-import-actions">
            <Button variant="ghost" onClick={() => { reset(); setSelectedChapters(new Set()); }}>
              Back
            </Button>
            <Button onClick={onImport} loading={importing}>
              Import {importCount} chapter(s)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
