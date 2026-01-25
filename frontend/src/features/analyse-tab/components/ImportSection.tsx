import { useRef, useState, useCallback } from 'react';
import { Loading } from '../../../shared/components/UI';
import type { UseFileUploadReturn } from '../hooks/useFileUpload';
import type { UseLichessImportReturn } from '../hooks/useLichessImport';
import type { LichessImportOptions } from '../../../types';

export interface ImportSectionProps {
  username: string;
  onUsernameChange: (username: string) => void;
  fileUploadState: UseFileUploadReturn;
  lichessImportState: UseLichessImportReturn;
}

export function ImportSection({ username, onUsernameChange, fileUploadState, lichessImportState }: ImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, handleFileUpload } = fileUploadState;
  const { importing, handleLichessImport } = lichessImportState;
  const [dragOver, setDragOver] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<LichessImportOptions>({
    max: 20,
    rated: undefined,
    perfType: undefined,
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
    handleLichessImport({ max: 20 });
  }, [handleLichessImport]);

  const handleCustomImport = useCallback(() => {
    const cleanedOptions: LichessImportOptions = { max: options.max };
    if (options.rated !== undefined) cleanedOptions.rated = options.rated;
    if (options.perfType) cleanedOptions.perfType = options.perfType;
    handleLichessImport(cleanedOptions);
  }, [handleLichessImport, options]);

  const isLoading = uploading || importing;

  return (
    <section className="import-section">
      <h2>Import games</h2>
      <div className="username-input">
        <label htmlFor="username">Your username:</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Enter your Lichess or Chess.com username"
          disabled={isLoading}
        />
      </div>

      <div className="lichess-import">
        <div className="lichess-import-header">
          <button
            className="btn btn-primary btn-md lichess-import-btn"
            onClick={handleQuickImport}
            disabled={isLoading}
          >
            {importing ? (
              <Loading text="Importing..." size="sm" />
            ) : (
              'Import from Lichess (20 games)'
            )}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowOptions(!showOptions)}
            disabled={isLoading}
          >
            {showOptions ? 'Hide options' : 'Options'}
          </button>
        </div>

        {showOptions && (
          <div className="lichess-options">
            <div className="lichess-option">
              <label htmlFor="max-games">Number of games:</label>
              <input
                id="max-games"
                type="number"
                min={1}
                max={100}
                value={options.max || 20}
                onChange={(e) => setOptions({ ...options, max: parseInt(e.target.value) || 20 })}
                disabled={isLoading}
              />
            </div>

            <div className="lichess-option">
              <label htmlFor="rated-only">Game type:</label>
              <select
                id="rated-only"
                value={options.rated === undefined ? '' : options.rated ? 'rated' : 'casual'}
                onChange={(e) => setOptions({
                  ...options,
                  rated: e.target.value === '' ? undefined : e.target.value === 'rated'
                })}
                disabled={isLoading}
              >
                <option value="">All games</option>
                <option value="rated">Rated only</option>
                <option value="casual">Casual only</option>
              </select>
            </div>

            <div className="lichess-option">
              <label htmlFor="perf-type">Time control:</label>
              <select
                id="perf-type"
                value={options.perfType || ''}
                onChange={(e) => setOptions({
                  ...options,
                  perfType: e.target.value as LichessImportOptions['perfType'] || undefined
                })}
                disabled={isLoading}
              >
                <option value="">All</option>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
                <option value="classical">Classical</option>
              </select>
            </div>

            <button
              className="btn btn-primary btn-md"
              onClick={handleCustomImport}
              disabled={isLoading}
            >
              Import with options
            </button>
          </div>
        )}
      </div>

      <div className="import-divider">
        <span>or</span>
      </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loading text="Uploading and analyzing..." />
        ) : (
          <>
            <div className="drop-zone-icon">📁</div>
            <p className="drop-zone-text">
              Drag & drop a PGN file here, or click to select
            </p>
            <p className="drop-zone-hint">.pgn files only</p>
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
