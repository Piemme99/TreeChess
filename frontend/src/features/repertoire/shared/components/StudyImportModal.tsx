import { useState, useCallback } from 'react';
import { Modal } from '../../../../shared/components/UI/Modal';
import { Button } from '../../../../shared/components/UI/Button';
import { useStudyImport } from '../hooks/useStudyImport';
import { useRepertoireStore } from '../../../../stores/repertoireStore';

interface StudyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StudyImportModal({ isOpen, onClose, onSuccess }: StudyImportModalProps) {
  const [url, setUrl] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [mergeAsOne, setMergeAsOne] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [createCategory, setCreateCategory] = useState(true);
  const addCategory = useRepertoireStore((state) => state.addCategory);

  const { previewing, importing, studyInfo, previewError, handlePreview, handleImport, reset } = useStudyImport(onSuccess);

  const handleClose = useCallback(() => {
    setUrl('');
    setSelectedChapters(new Set());
    setMergeAsOne(false);
    setMergeName('');
    setCreateCategory(true);
    reset();
    onClose();
  }, [onClose, reset]);

  const onPreview = useCallback(async () => {
    const success = await handlePreview(url);
    if (success) {
      setSelectedChapters(new Set());
      setMergeAsOne(false);
      setMergeName('');
      setCreateCategory(true);
    }
  }, [url, handlePreview]);

  const onImport = useCallback(async () => {
    const chapters = mergeAsOne
      ? studyInfo?.chapters.map(c => c.index) ?? []
      : selectedChapters.size > 0
        ? Array.from(selectedChapters)
        : studyInfo?.chapters.map(c => c.index) ?? [];
    const result = await handleImport(
      url,
      chapters,
      mergeAsOne,
      mergeAsOne ? (mergeName || studyInfo?.studyName) : undefined,
      !mergeAsOne && createCategory,
      !mergeAsOne && createCategory ? studyInfo?.studyName : undefined
    );
    if (result) {
      // Add the created category to the store
      if (result.category) {
        addCategory(result.category);
      }
      handleClose();
    }
  }, [url, selectedChapters, studyInfo, mergeAsOne, mergeName, createCategory, handleImport, handleClose, addCategory]);

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

  // Check if all chapters share the same color (needed for merge)
  const hasMixedColors = studyInfo
    ? new Set(studyInfo.chapters.map(c => c.orientation)).size > 1
    : false;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Lichess Study" size="md">
      {!studyInfo ? (
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-[0.9rem] m-0">
            Paste a Lichess study URL to import its chapters as repertoires.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 py-2 px-4 border border-border rounded-md text-[0.9rem] bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
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
            <p className="text-danger text-[0.85rem] m-0">{previewError}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 text-[1.1rem] font-semibold text-text">{studyInfo.studyName}</h3>
            <span className="text-text-muted text-[0.85rem] whitespace-nowrap">{studyInfo.chapters.length} chapter(s)</span>
          </div>

          <div className="flex flex-col border border-border rounded-md max-h-[320px] overflow-y-auto">
            <label className="flex items-center gap-2 py-2 px-4 border-b border-border cursor-pointer text-[0.9rem] bg-bg font-medium sticky top-0">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className="flex-1">Select all</span>
            </label>
            {studyInfo.chapters.map((ch) => (
              <label key={ch.index} className="flex items-center gap-2 py-2 px-4 border-b border-border last:border-b-0 cursor-pointer text-[0.9rem] hover:bg-bg">
                <input
                  type="checkbox"
                  checked={noneSelected || selectedChapters.has(ch.index)}
                  onChange={() => toggleChapter(ch.index)}
                />
                <span className="text-base shrink-0">
                  {ch.orientation === 'white' ? '\u2654' : '\u265A'}
                </span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{ch.name}</span>
                <span className="text-text-muted text-[0.8rem] whitespace-nowrap">{ch.moveCount} moves</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-[0.9rem]">
              <input
                type="checkbox"
                checked={mergeAsOne}
                onChange={(e) => {
                  setMergeAsOne(e.target.checked);
                  if (e.target.checked && !mergeName) {
                    setMergeName(studyInfo?.studyName ?? '');
                  }
                }}
                disabled={hasMixedColors}
              />
              <span className={hasMixedColors ? 'text-text-muted' : ''}>
                Merge all into one repertoire
              </span>
            </label>
            {hasMixedColors && (
              <p className="text-text-muted text-[0.8rem] m-0 ml-6">
                Cannot merge: chapters have different colors (white/black)
              </p>
            )}
            {mergeAsOne && (
              <input
                type="text"
                className="py-2 px-4 border border-border rounded-md text-[0.9rem] bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                placeholder="Repertoire name"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
              />
            )}
            {!mergeAsOne && (
              <label className="flex items-center gap-2 cursor-pointer text-[0.9rem] mt-2">
                <input
                  type="checkbox"
                  checked={createCategory}
                  onChange={(e) => setCreateCategory(e.target.checked)}
                />
                <span>
                  Group into category "{studyInfo?.studyName || 'Imported Study'}"
                </span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { reset(); setSelectedChapters(new Set()); setMergeAsOne(false); setMergeName(''); }}>
              Back
            </Button>
            <Button onClick={onImport} loading={importing}>
              {mergeAsOne
                ? `Import as 1 merged repertoire`
                : `Import ${importCount} chapter(s)`
              }
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
