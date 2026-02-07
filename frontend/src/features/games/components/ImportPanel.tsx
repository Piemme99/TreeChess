import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Loading } from '../../../shared/components/UI';
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

  const tabClass = (tab: ImportTab) =>
    `flex-1 py-2 px-4 font-sans text-[0.9375rem] font-medium cursor-pointer transition-all duration-150 border-none border-b-2 ${
      activeTab === tab
        ? 'text-primary border-b-primary bg-transparent'
        : 'text-text-muted border-b-transparent bg-transparent hover:text-text hover:bg-bg'
    }`;

  return (
    <div className="bg-bg-card rounded-2xl shadow-sm overflow-hidden mb-6">
      <div className="flex border-b border-primary/10">
        <button className={tabClass('lichess')} onClick={() => setActiveTab('lichess')}>Lichess</button>
        <button className={tabClass('chesscom')} onClick={() => setActiveTab('chesscom')}>Chess.com</button>
        <button className={tabClass('pgn')} onClick={() => setActiveTab('pgn')}>PGN File</button>
      </div>

      <div className="p-6">
        {(activeTab === 'lichess' || activeTab === 'chesscom') && (
          <div className="mb-6">
            <label htmlFor="import-username" className="block mb-2 font-medium text-text-muted">Username:</label>
            <input
              id="import-username"
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={`Enter your ${activeTab === 'lichess' ? 'Lichess' : 'Chess.com'} username`}
              disabled={isLoading}
              className="w-full py-2 px-4 border border-primary/10 rounded-xl text-base font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
            />
          </div>
        )}

        {activeTab === 'lichess' && (
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={handleQuickLichess} disabled={isLoading}>
                {importing ? <Loading text="Importing..." size="sm" /> : 'Import 20 games'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowLichessOptions(!showLichessOptions)} disabled={isLoading}>
                {showLichessOptions ? 'Hide options' : 'Options'}
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {showLichessOptions && (
                <motion.div
                  key="lichess-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mt-4 p-4 bg-bg rounded-xl flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <label htmlFor="lichess-max" className="min-w-[140px] font-medium text-text-muted">Number of games:</label>
                      <input id="lichess-max" type="number" min={1} max={100} value={lichessOptions.max || 20}
                        onChange={(e) => setLichessOptions({ ...lichessOptions, max: parseInt(e.target.value) || 20 })}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-base font-sans max-w-[100px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label htmlFor="lichess-rated" className="min-w-[140px] font-medium text-text-muted">Game type:</label>
                      <select id="lichess-rated" value={lichessOptions.rated === undefined ? '' : lichessOptions.rated ? 'rated' : 'casual'}
                        onChange={(e) => setLichessOptions({ ...lichessOptions, rated: e.target.value === '' ? undefined : e.target.value === 'rated' })}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-base font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                      >
                        <option value="">All games</option>
                        <option value="rated">Rated only</option>
                        <option value="casual">Casual only</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label htmlFor="lichess-perf" className="min-w-[140px] font-medium text-text-muted">Time control:</label>
                      <select id="lichess-perf" value={lichessOptions.perfType || ''}
                        onChange={(e) => setLichessOptions({ ...lichessOptions, perfType: e.target.value as LichessImportOptions['perfType'] || undefined })}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-base font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                      >
                        <option value="">All</option>
                        <option value="bullet">Bullet</option>
                        <option value="blitz">Blitz</option>
                        <option value="rapid">Rapid</option>
                        <option value="classical">Classical</option>
                      </select>
                    </div>
                    <Button onClick={handleCustomLichess} disabled={isLoading}>Import with options</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'chesscom' && (
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={handleQuickChesscom} disabled={isLoading}>
                {chesscomImporting ? <Loading text="Importing..." size="sm" /> : 'Import 20 games'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowChesscomOptions(!showChesscomOptions)} disabled={isLoading}>
                {showChesscomOptions ? 'Hide options' : 'Options'}
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {showChesscomOptions && (
                <motion.div
                  key="chesscom-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mt-4 p-4 bg-bg rounded-xl flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <label htmlFor="chesscom-max" className="min-w-[140px] font-medium text-text-muted">Number of games:</label>
                      <input id="chesscom-max" type="number" min={1} max={100} value={chesscomOptions.max || 20}
                        onChange={(e) => setChesscomOptions({ ...chesscomOptions, max: parseInt(e.target.value) || 20 })}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-base font-sans max-w-[100px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label htmlFor="chesscom-time" className="min-w-[140px] font-medium text-text-muted">Time control:</label>
                      <select id="chesscom-time" value={chesscomOptions.timeClass || ''}
                        onChange={(e) => setChesscomOptions({ ...chesscomOptions, timeClass: e.target.value as ChesscomImportOptions['timeClass'] || undefined })}
                        disabled={isLoading}
                        className="flex-1 py-2 px-4 border border-primary/10 rounded-xl text-base font-sans focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light"
                      >
                        <option value="">All</option>
                        <option value="bullet">Bullet</option>
                        <option value="blitz">Blitz</option>
                        <option value="rapid">Rapid</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                    <Button onClick={handleCustomChesscom} disabled={isLoading}>Import with options</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'pgn' && (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-150 ${
              dragOver ? 'border-primary bg-primary-light' : 'border-primary/30'
            } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !isLoading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loading text="Uploading and analyzing..." />
            ) : (
              <>
                <div className="text-5xl mb-4">&#128193;</div>
                <p className="text-lg text-text mb-1">Drag & drop a PGN file here, or click to select</p>
                <p className="text-text-muted text-sm">.pgn files only</p>
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
