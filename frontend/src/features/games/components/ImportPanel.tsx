import { useRef, useState, useCallback } from 'react';
import { Loading } from '../../../shared/components/UI';
import type { UseFileUploadReturn } from '../../analyse-tab/hooks/useFileUpload';
import type { UseLichessImportReturn } from '../../analyse-tab/hooks/useLichessImport';
import type { UseChesscomImportReturn } from '../../analyse-tab/hooks/useChesscomImport';
import type { LichessImportOptions, ChesscomImportOptions } from '../../../types';

type ImportTab = 'lichess' | 'chesscom' | 'pgn';

interface ImportPanelProps {
  username: string;
  onUsernameChange: (username: string) => void;
  fileUploadState: UseFileUploadReturn;
  lichessImportState: UseLichessImportReturn;
  chesscomImportState: UseChesscomImportReturn;
}

export function ImportPanel({ username, onUsernameChange, fileUploadState, lichessImportState, chesscomImportState }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, handleFileUpload } = fileUploadState;
  const { importing, handleLichessImport } = lichessImportState;
  const { importing: chesscomImporting, handleChesscomImport } = chesscomImportState;

  const [activeTab, setActiveTab] = useState<ImportTab>('lichess');
  const [lichessOptions, setLichessOptions] = useState<LichessImportOptions>({ max: 20, rated: undefined, perfType: undefined });
  const [showLichessOptions, setShowLichessOptions] = useState(false);
  const [chesscomOptions, setChesscomOptions] = useState<ChesscomImportOptions>({ max: 20, timeClass: undefined });
  const [showChesscomOptions, setShowChesscomOptions] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isLoading = uploading || importing || chesscomImporting;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleQuickLichess = useCallback(() => {
    handleLichessImport({ max: 20 });
  }, [handleLichessImport]);

  const handleCustomLichess = useCallback(() => {
    const opts: LichessImportOptions = { max: lichessOptions.max };
    if (lichessOptions.rated !== undefined) opts.rated = lichessOptions.rated;
    if (lichessOptions.perfType) opts.perfType = lichessOptions.perfType;
    handleLichessImport(opts);
  }, [handleLichessImport, lichessOptions]);

  const handleQuickChesscom = useCallback(() => {
    handleChesscomImport({ max: 20 });
  }, [handleChesscomImport]);

  const handleCustomChesscom = useCallback(() => {
    const opts: ChesscomImportOptions = { max: chesscomOptions.max };
    if (chesscomOptions.timeClass) opts.timeClass = chesscomOptions.timeClass;
    handleChesscomImport(opts);
  }, [handleChesscomImport, chesscomOptions]);

  return (
    <div className="import-panel">
      <div className="import-panel-tabs">
        <button
          className={`import-panel-tab${activeTab === 'lichess' ? ' active' : ''}`}
          onClick={() => setActiveTab('lichess')}
        >
          Lichess
        </button>
        <button
          className={`import-panel-tab${activeTab === 'chesscom' ? ' active' : ''}`}
          onClick={() => setActiveTab('chesscom')}
        >
          Chess.com
        </button>
        <button
          className={`import-panel-tab${activeTab === 'pgn' ? ' active' : ''}`}
          onClick={() => setActiveTab('pgn')}
        >
          PGN File
        </button>
      </div>

      <div className="import-panel-content">
        {(activeTab === 'lichess' || activeTab === 'chesscom') && (
          <div className="username-input">
            <label htmlFor="import-username">Username:</label>
            <input
              id="import-username"
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={`Enter your ${activeTab === 'lichess' ? 'Lichess' : 'Chess.com'} username`}
              disabled={isLoading}
            />
          </div>
        )}

        {activeTab === 'lichess' && (
          <div className="lichess-import">
            <div className="lichess-import-header">
              <button
                className="btn btn-primary btn-md lichess-import-btn"
                onClick={handleQuickLichess}
                disabled={isLoading}
              >
                {importing ? <Loading text="Importing..." size="sm" /> : 'Import 20 games'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowLichessOptions(!showLichessOptions)}
                disabled={isLoading}
              >
                {showLichessOptions ? 'Hide options' : 'Options'}
              </button>
            </div>

            {showLichessOptions && (
              <div className="lichess-options">
                <div className="lichess-option">
                  <label htmlFor="lichess-max">Number of games:</label>
                  <input
                    id="lichess-max"
                    type="number"
                    min={1}
                    max={100}
                    value={lichessOptions.max || 20}
                    onChange={(e) => setLichessOptions({ ...lichessOptions, max: parseInt(e.target.value) || 20 })}
                    disabled={isLoading}
                  />
                </div>
                <div className="lichess-option">
                  <label htmlFor="lichess-rated">Game type:</label>
                  <select
                    id="lichess-rated"
                    value={lichessOptions.rated === undefined ? '' : lichessOptions.rated ? 'rated' : 'casual'}
                    onChange={(e) => setLichessOptions({
                      ...lichessOptions,
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
                  <label htmlFor="lichess-perf">Time control:</label>
                  <select
                    id="lichess-perf"
                    value={lichessOptions.perfType || ''}
                    onChange={(e) => setLichessOptions({
                      ...lichessOptions,
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
                  onClick={handleCustomLichess}
                  disabled={isLoading}
                >
                  Import with options
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chesscom' && (
          <div className="lichess-import">
            <div className="lichess-import-header">
              <button
                className="btn btn-primary btn-md lichess-import-btn"
                onClick={handleQuickChesscom}
                disabled={isLoading}
              >
                {chesscomImporting ? <Loading text="Importing..." size="sm" /> : 'Import 20 games'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowChesscomOptions(!showChesscomOptions)}
                disabled={isLoading}
              >
                {showChesscomOptions ? 'Hide options' : 'Options'}
              </button>
            </div>

            {showChesscomOptions && (
              <div className="lichess-options">
                <div className="lichess-option">
                  <label htmlFor="chesscom-max">Number of games:</label>
                  <input
                    id="chesscom-max"
                    type="number"
                    min={1}
                    max={100}
                    value={chesscomOptions.max || 20}
                    onChange={(e) => setChesscomOptions({ ...chesscomOptions, max: parseInt(e.target.value) || 20 })}
                    disabled={isLoading}
                  />
                </div>
                <div className="lichess-option">
                  <label htmlFor="chesscom-time">Time control:</label>
                  <select
                    id="chesscom-time"
                    value={chesscomOptions.timeClass || ''}
                    onChange={(e) => setChesscomOptions({
                      ...chesscomOptions,
                      timeClass: e.target.value as ChesscomImportOptions['timeClass'] || undefined
                    })}
                    disabled={isLoading}
                  >
                    <option value="">All</option>
                    <option value="bullet">Bullet</option>
                    <option value="blitz">Blitz</option>
                    <option value="rapid">Rapid</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary btn-md"
                  onClick={handleCustomChesscom}
                  disabled={isLoading}
                >
                  Import with options
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pgn' && (
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !isLoading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loading text="Uploading and analyzing..." />
            ) : (
              <>
                <div className="drop-zone-icon">&#128193;</div>
                <p className="drop-zone-text">Drag & drop a PGN file here, or click to select</p>
                <p className="drop-zone-hint">.pgn files only</p>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
