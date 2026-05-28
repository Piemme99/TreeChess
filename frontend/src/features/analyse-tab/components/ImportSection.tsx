import { useRef, useState, useCallback } from 'react';
import { Button, Loading, LichessLogo, ChessComLogo } from '../../../shared/components/UI';
import type { UseFileUploadReturn } from '../hooks/useFileUpload';
import type { UseLichessImportReturn } from '../hooks/useLichessImport';
import type { UseChesscomImportReturn } from '../hooks/useChesscomImport';
import type { LichessImportOptions, ChesscomImportOptions } from '../../../types';

type Platform = 'lichess' | 'chesscom';

const inputClass =
  'w-full py-2 px-4 border border-primary/10 rounded-xl bg-bg text-base font-sans focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export interface ImportSectionProps {
  username: string;
  onUsernameChange: (username: string) => void;
  fileUploadState: UseFileUploadReturn;
  lichessImportState: UseLichessImportReturn;
  chesscomImportState: UseChesscomImportReturn;
}

export function ImportSection({ username, onUsernameChange, fileUploadState, lichessImportState, chesscomImportState }: ImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, handleFileUpload } = fileUploadState;
  const { importing, handleLichessImport } = lichessImportState;
  const { importing: chesscomImporting, handleChesscomImport } = chesscomImportState;

  const [platform, setPlatform] = useState<Platform>('lichess');
  const [dragOver, setDragOver] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<LichessImportOptions>({
    max: 20,
    rated: undefined,
    perfType: undefined,
  });
  const [chesscomOptions, setChesscomOptions] = useState<ChesscomImportOptions>({
    max: 20,
    timeClass: undefined,
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleQuickImport = useCallback(() => {
    if (platform === 'lichess') {
      handleLichessImport({ max: 20 });
    } else {
      handleChesscomImport({ max: 20 });
    }
  }, [platform, handleLichessImport, handleChesscomImport]);

  const handleCustomImport = useCallback(() => {
    const cleanedOptions: LichessImportOptions = { max: options.max };
    if (options.rated !== undefined) cleanedOptions.rated = options.rated;
    if (options.perfType) cleanedOptions.perfType = options.perfType;
    handleLichessImport(cleanedOptions);
  }, [handleLichessImport, options]);

  const handleCustomChesscomImport = useCallback(() => {
    const cleanedOptions: ChesscomImportOptions = { max: chesscomOptions.max };
    if (chesscomOptions.timeClass) cleanedOptions.timeClass = chesscomOptions.timeClass;
    handleChesscomImport(cleanedOptions);
  }, [handleChesscomImport, chesscomOptions]);

  const isLoading = uploading || importing || chesscomImporting;
  const platformImporting = platform === 'lichess' ? importing : chesscomImporting;
  const platformLabel = platform === 'lichess' ? 'Lichess' : 'Chess.com';

  const handleSelectPlatform = useCallback((next: Platform) => {
    if (isLoading) return;
    setPlatform(next);
    setShowOptions(false);
  }, [isLoading]);

  const segmentClass = (active: boolean) =>
    `flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-bg-card text-primary shadow-sm' : 'text-text-muted hover:text-text'
    }`;

  return (
    <section className="bg-bg-card rounded-2xl p-6 border border-primary/10 shadow-sm shadow-primary/5">
      <h2 className="text-xl font-display font-semibold mb-4">Import games</h2>

      {/* Platform selector */}
      <div className="flex gap-1 p-1 bg-bg rounded-xl border border-primary/10 mb-4">
        <button
          type="button"
          onClick={() => handleSelectPlatform('lichess')}
          disabled={isLoading}
          aria-pressed={platform === 'lichess'}
          className={segmentClass(platform === 'lichess')}
        >
          <LichessLogo size={18} />
          Lichess
        </button>
        <button
          type="button"
          onClick={() => handleSelectPlatform('chesscom')}
          disabled={isLoading}
          aria-pressed={platform === 'chesscom'}
          className={segmentClass(platform === 'chesscom')}
        >
          <ChessComLogo size={18} />
          Chess.com
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="username" className="block mb-2 font-medium text-text-muted">
          Your {platformLabel} username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder={`Enter your ${platformLabel} username`}
          disabled={isLoading}
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleQuickImport}
            loading={platformImporting}
            disabled={isLoading}
          >
            {`Import from ${platformLabel} (20 games)`}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowOptions(!showOptions)}
            disabled={isLoading}
          >
            {showOptions ? 'Hide options' : 'Options'}
          </Button>
        </div>

        {showOptions && platform === 'lichess' && (
          <div className="mt-4 p-4 bg-bg rounded-xl border border-primary/10 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label htmlFor="max-games" className="min-w-[140px] font-medium text-text-muted">Number of games</label>
              <input
                id="max-games"
                type="number"
                min={1}
                max={100}
                value={options.max || 20}
                onChange={(e) => setOptions({ ...options, max: parseInt(e.target.value) || 20 })}
                disabled={isLoading}
                className={`${inputClass} max-w-[100px]`}
              />
            </div>

            <div className="flex items-center gap-4">
              <label htmlFor="rated-only" className="min-w-[140px] font-medium text-text-muted">Game type</label>
              <select
                id="rated-only"
                value={options.rated === undefined ? '' : options.rated ? 'rated' : 'casual'}
                onChange={(e) => setOptions({
                  ...options,
                  rated: e.target.value === '' ? undefined : e.target.value === 'rated'
                })}
                disabled={isLoading}
                className={inputClass}
              >
                <option value="">All games</option>
                <option value="rated">Rated only</option>
                <option value="casual">Casual only</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label htmlFor="perf-type" className="min-w-[140px] font-medium text-text-muted">Time control</label>
              <select
                id="perf-type"
                value={options.perfType || ''}
                onChange={(e) => setOptions({
                  ...options,
                  perfType: e.target.value as LichessImportOptions['perfType'] || undefined
                })}
                disabled={isLoading}
                className={inputClass}
              >
                <option value="">All</option>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="classical">Classical</option>
              </select>
            </div>

            <Button onClick={handleCustomImport} loading={importing} disabled={isLoading}>
              Import with options
            </Button>
          </div>
        )}

        {showOptions && platform === 'chesscom' && (
          <div className="mt-4 p-4 bg-bg rounded-xl border border-primary/10 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label htmlFor="chesscom-max-games" className="min-w-[140px] font-medium text-text-muted">Number of games</label>
              <input
                id="chesscom-max-games"
                type="number"
                min={1}
                max={100}
                value={chesscomOptions.max || 20}
                onChange={(e) => setChesscomOptions({ ...chesscomOptions, max: parseInt(e.target.value) || 20 })}
                disabled={isLoading}
                className={`${inputClass} max-w-[100px]`}
              />
            </div>

            <div className="flex items-center gap-4">
              <label htmlFor="chesscom-time-class" className="min-w-[140px] font-medium text-text-muted">Time control</label>
              <select
                id="chesscom-time-class"
                value={chesscomOptions.timeClass || ''}
                onChange={(e) => setChesscomOptions({
                  ...chesscomOptions,
                  timeClass: e.target.value as ChesscomImportOptions['timeClass'] || undefined
                })}
                disabled={isLoading}
                className={inputClass}
              >
                <option value="">All</option>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <Button onClick={handleCustomChesscomImport} loading={chesscomImporting} disabled={isLoading}>
              Import with options
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center my-6 before:content-[''] before:flex-1 before:h-px before:bg-primary/10 after:content-[''] after:flex-1 after:h-px after:bg-primary/10">
        <span className="px-4 text-text-muted text-sm">or</span>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-150 ${
          dragOver ? 'border-primary bg-primary-light' : 'border-primary/20 hover:border-primary/40'
        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loading text="Uploading and analyzing..." />
        ) : (
          <>
            <div className="text-5xl mb-4">&#128193;</div>
            <p className="text-lg text-text mb-1">
              Drag &amp; drop a PGN file here, or click to select
            </p>
            <p className="text-text-muted text-sm">.pgn files only</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pgn"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </section>
  );
}
