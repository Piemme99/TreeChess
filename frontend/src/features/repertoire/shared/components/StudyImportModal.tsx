import { useState, useCallback, useEffect } from 'react';
import { Modal } from '../../../../shared/components/UI/Modal';
import { Button } from '../../../../shared/components/UI/Button';
import { ColorDot } from '../../../../shared/components/UI';
import { useStudyImport } from '../hooks/useStudyImport';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { StudyBrowser } from './StudyBrowser';

type ActiveView = 'browse' | 'paste-url' | 'preview';

interface StudyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StudyImportModal({ isOpen, onClose, onSuccess }: StudyImportModalProps) {
  const [activeView, setActiveView] = useState<ActiveView>('browse');
  const [previousTab, setPreviousTab] = useState<'browse' | 'paste-url'>('browse');
  const [url, setUrl] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [mergeAsOne, setMergeAsOne] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [createCategory, setCreateCategory] = useState(true);
  const [includeHints, setIncludeHints] = useState(true);
  const [includeComments, setIncludeComments] = useState(false);
  const addCategory = useRepertoireStore((state) => state.addCategory);

  const { previewing, importing, studyInfo, previewError, handlePreview, handleImport, reset } = useStudyImport(onSuccess);

  const handleClose = useCallback(() => {
    setActiveView('browse');
    setPreviousTab('browse');
    setUrl('');
    setSelectedChapters(new Set());
    setMergeAsOne(false);
    setMergeName('');
    setCreateCategory(true);
    setIncludeHints(true);
    setIncludeComments(false);
    reset();
    onClose();
  }, [onClose, reset]);

  const onPreview = useCallback(async () => {
    const success = await handlePreview(url);
    if (success) {
      setMergeAsOne(false);
      setMergeName('');
      setCreateCategory(true);
      setIncludeHints(true);
      setIncludeComments(false);
      setPreviousTab('paste-url');
      setActiveView('preview');
    }
  }, [url, handlePreview]);

  const handleSelectStudy = useCallback(async (studyId: string) => {
    const studyUrl = `https://lichess.org/study/${studyId}`;
    setUrl(studyUrl);
    const success = await handlePreview(studyUrl);
    if (success) {
      setMergeAsOne(false);
      setMergeName('');
      setCreateCategory(true);
      setIncludeHints(true);
      setIncludeComments(false);
      setPreviousTab('browse');
      setActiveView('preview');
    }
  }, [handlePreview]);

  const onImport = useCallback(async () => {
    const chapters = mergeAsOne
      ? studyInfo?.chapters.map(c => c.index) ?? []
      : studyInfo?.chapters.map(c => c.index).filter(i => selectedChapters.has(i)) ?? [];
    const result = await handleImport(
      url,
      chapters,
      mergeAsOne,
      mergeAsOne ? (mergeName || studyInfo?.studyName) : undefined,
      !mergeAsOne && createCategory,
      !mergeAsOne && createCategory ? studyInfo?.studyName : undefined,
      includeComments,
      includeHints,
      studyInfo?.ownerName
    );
    if (result) {
      if (result.category) {
        addCategory(result.category);
      }
      handleClose();
    }
  }, [url, selectedChapters, studyInfo, mergeAsOne, mergeName, createCategory, includeComments, includeHints, handleImport, handleClose, addCategory]);

  const handleBack = useCallback(() => {
    reset();
    setSelectedChapters(new Set());
    setMergeAsOne(false);
    setMergeName('');
    setActiveView(previousTab);
  }, [reset, previousTab]);

  useEffect(() => {
    if (studyInfo) {
      setSelectedChapters(new Set(studyInfo.chapters.map(c => c.index)));
    }
  }, [studyInfo]);

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
  const importCount = selectedChapters.size;

  const hasMixedColors = studyInfo
    ? new Set(studyInfo.chapters.map(c => c.orientation)).size > 1
    : false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-3">
          Import Lichess Study
          <a
            href="https://lichess.org/study"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.8rem] font-normal text-text-muted hover:text-primary transition-colors no-underline flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Browse on Lichess
          </a>
        </span>
      }
      size="lg"
    >
      {/* Tab bar - hidden in preview */}
      {activeView !== 'preview' && (
        <div className="flex border-b border-primary/10 mb-4 -mt-2">
          <button
            className={`px-4 py-2 text-[0.9rem] font-medium border-b-2 -mb-px transition-colors cursor-pointer bg-transparent ${
              activeView === 'browse'
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            onClick={() => setActiveView('browse')}
          >
            Browse Studies
          </button>
          <button
            className={`px-4 py-2 text-[0.9rem] font-medium border-b-2 -mb-px transition-colors cursor-pointer bg-transparent ${
              activeView === 'paste-url'
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            onClick={() => setActiveView('paste-url')}
          >
            Paste URL
          </button>
        </div>
      )}

      {/* Browse view */}
      {activeView === 'browse' && (
        <StudyBrowser onSelectStudy={handleSelectStudy} />
      )}

      {/* Paste URL view */}
      {activeView === 'paste-url' && (
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-[0.9rem] m-0">
            Paste a Lichess study URL to import its chapters as repertoires.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-[0.9rem] bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
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
      )}

      {/* Preview/import view */}
      {activeView === 'preview' && studyInfo && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 text-[1.1rem] font-semibold text-text">{studyInfo.studyName}</h3>
            <span className="text-text-muted text-[0.85rem] whitespace-nowrap">{studyInfo.chapters.length} chapter(s)</span>
          </div>

          <div className="flex flex-col border border-primary/10 rounded-xl max-h-[320px] overflow-y-auto">
            <label className="flex items-center gap-2 py-2 px-4 border-b border-primary/10 cursor-pointer text-[0.9rem] bg-bg font-medium sticky top-0">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className="flex-1">Select all</span>
            </label>
            {studyInfo.chapters.map((ch) => (
              <label key={ch.index} className="flex items-center gap-2 py-2 px-4 border-b border-primary/10 last:border-b-0 cursor-pointer text-[0.9rem] hover:bg-primary-light/20">
                <input
                  type="checkbox"
                  checked={selectedChapters.has(ch.index)}
                  onChange={() => toggleChapter(ch.index)}
                />
                <ColorDot color={ch.orientation as 'white' | 'black'} size="sm" />
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
                className="py-2 px-4 border border-primary/10 rounded-xl text-[0.9rem] bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
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

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-[0.9rem]">
              <input
                type="checkbox"
                checked={includeHints}
                onChange={(e) => setIncludeHints(e.target.checked)}
              />
              <span>Import hints (arrows & highlights)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[0.9rem]">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
              />
              <span>Import comments</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleBack}>
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

      {/* Loading state during preview from browse */}
      {activeView === 'preview' && !studyInfo && previewing && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted text-[0.9rem]">Loading study preview...</span>
        </div>
      )}

      {/* Error state during preview from browse */}
      {activeView === 'preview' && !studyInfo && !previewing && previewError && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-danger text-[0.85rem] m-0">{previewError}</p>
          <Button variant="ghost" onClick={handleBack}>
            Back
          </Button>
        </div>
      )}
    </Modal>
  );
}
