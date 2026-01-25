import { useRef, useState, useCallback } from 'react';
import { Loading } from '../../../shared/components/UI';
import type { UseFileUploadReturn } from '../hooks/useFileUpload';

export interface ImportSectionProps {
  username: string;
  onUsernameChange: (username: string) => void;
  fileUploadState: UseFileUploadReturn;
}

export function ImportSection({ username, onUsernameChange, fileUploadState }: ImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, handleFileUpload } = fileUploadState;
  const [dragOver, setDragOver] = useState(false);

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
        />
      </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
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